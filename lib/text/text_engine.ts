/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.cea.ICaptionDecoder");

namespace shaka.text {
  // TODO: revisit this when Closure Compiler supports partially-exported classes.
  /**
   * @summary Manages text parsers and cues.
   * @export
   */
  export class TextEngine implements IDestroyable {
    private parser_: shaka.extern.TextParser | null = null;
    private displayer_: shaka.extern.TextDisplayer;
    private segmentRelativeVttTiming_: boolean = false;
    private timestampOffset_: number = 0;
    private appendWindowStart_: number = 0;
    private appendWindowEnd_: number = Infinity;
    private bufferStart_: number | null = null;
    private bufferEnd_: number | null = null;
    private selectedClosedCaptionId_: string = "";

    /**
     * The closed captions map stores the CEA closed captions by closed captions
     * id and start and end time.
     * It's used as the buffer of closed caption text streams, to show captions
     * when we start displaying captions or switch caption tracks, we need to be
     * able to get the cues for the other language and display them without
     * re-fetching the video segments they were embedded in.
     * Structure of closed caption map:
     * closed caption id -> {start and end time -> cues}
     * */
    private closedCaptionsMap_: Map<string, Map<string, Cue[]>>;

    constructor(displayer: shaka.extern.TextDisplayer) {
      this.displayer_ = displayer;
      this.closedCaptionsMap_ = new Map();
    }

    /**
     * @export
     */
    static registerParser(
      mimeType: string,
      plugin: shaka.extern.TextParserPlugin
    ) {
      shaka.text.TextEngine.parserMap_[mimeType] = plugin;
    }

    /**
     * @export
     */
    static unregisterParser(mimeType: string) {
      delete shaka.text.TextEngine.parserMap_[mimeType];
    }

    /**
     * @export
     */
    static findParser(mimeType): shaka.extern.TextParserPlugin | null {
      return shaka.text.TextEngine.parserMap_[mimeType];
    }

    static isTypeSupported(mimeType: string): boolean {
      if (shaka.text.TextEngine.parserMap_[mimeType]) {
        // An actual parser is available.
        return true;
      }
      if (
        mimeType == shaka.util.MimeUtils.CEA608_CLOSED_CAPTION_MIMETYPE ||
        mimeType == shaka.util.MimeUtils.CEA708_CLOSED_CAPTION_MIMETYPE
      ) {
        // Closed captions.
        return true;
      }
      return false;
    }

    // TODO: revisit this when the compiler supports partially-exported classes.
    /**
     * @override
     * @export
     */
    destroy() {
      this.parser_ = null;
      this.displayer_ = null;
      this.closedCaptionsMap_.clear();
      return Promise.resolve();
    }

    setDisplayer(displayer: shaka.extern.TextDisplayer) {
      this.displayer_ = displayer;
    }

    /**
     * Initialize the parser.  This can be called multiple times, but must be
     * called at least once before appendBuffer.
     *
     */
    initParser(
      mimeType: string,
      sequenceMode: boolean,
      segmentRelativeVttTiming: boolean
    ) {
      // No parser for CEA, which is extracted from video and side-loaded
      // into TextEngine and TextDisplayer.
      if (
        mimeType == shaka.util.MimeUtils.CEA608_CLOSED_CAPTION_MIMETYPE ||
        mimeType == shaka.util.MimeUtils.CEA708_CLOSED_CAPTION_MIMETYPE
      ) {
        return;
      }
      const factory = shaka.text.TextEngine.parserMap_[mimeType];
      goog.asserts.assert(
        factory,
        "Text type negotiation should have happened already"
      );
      this.parser_ = factory();
      if (this.parser_.setSequenceMode) {
        this.parser_.setSequenceMode(sequenceMode);
      } else {
        shaka.log.alwaysWarn(
          'Text parsers should have a "setSequenceMode" method!'
        );
      }
      this.segmentRelativeVttTiming_ = segmentRelativeVttTiming;
    }

    /**
     * @param startTime relative to the start of the presentation
     * @param endTime relative to the start of the presentation
     */
    async appendBuffer(
      buffer: BufferSource,
      startTime: number | null,
      endTime: number | null
    ): Promise {
      goog.asserts.assert(
        this.parser_,
        "The parser should already be initialized"
      );

      // Start the operation asynchronously to avoid blocking the caller.
      await Promise.resolve();

      // Check that TextEngine hasn't been destroyed.
      if (!this.parser_ || !this.displayer_) {
        return;
      }
      if (startTime == null || endTime == null) {
        this.parser_.parseInit(shaka.util.BufferUtils.toUint8(buffer));
        return;
      }
      const vttOffset = this.segmentRelativeVttTiming_
        ? startTime
        : this.timestampOffset_;
      const time: shaka.extern.TextParser.TimeContext = {
        periodStart: this.timestampOffset_,
        segmentStart: startTime,
        segmentEnd: endTime,
        vttOffset: vttOffset,
      };

      // Parse the buffer and add the new cues.
      const allCues = this.parser_.parseMedia(
        shaka.util.BufferUtils.toUint8(buffer),
        time
      );
      const cuesToAppend = allCues.filter((cue) => {
        return (
          cue.startTime >= this.appendWindowStart_ &&
          cue.startTime < this.appendWindowEnd_
        );
      });
      this.displayer_.append(cuesToAppend);

      // NOTE: We update the buffered range from the start and end times
      // passed down from the segment reference, not with the start and end
      // times of the parsed cues.  This is important because some segments
      // may contain no cues, but we must still consider those ranges
      // buffered.
      if (this.bufferStart_ == null) {
        this.bufferStart_ = Math.max(startTime, this.appendWindowStart_);
      } else {
        // We already had something in buffer, and we assume we are extending
        // the range from the end.
        goog.asserts.assert(
          this.bufferEnd_ != null,
          "There should already be a buffered range end."
        );
        goog.asserts.assert(
          startTime - this.bufferEnd_ <= 1,
          "There should not be a gap in text references >1s"
        );
      }
      this.bufferEnd_ = Math.min(endTime, this.appendWindowEnd_);
    }

    /**
     * @param startTime relative to the start of the presentation
     * @param endTime relative to the start of the presentation
     */
    async remove(startTime: number, endTime: number): Promise {
      // Start the operation asynchronously to avoid blocking the caller.
      await Promise.resolve();
      if (this.displayer_ && this.displayer_.remove(startTime, endTime)) {
        if (this.bufferStart_ == null) {
          goog.asserts.assert(
            this.bufferEnd_ == null,
            "end must be null if startTime is null"
          );
        } else {
          goog.asserts.assert(
            this.bufferEnd_ != null,
            "end must be non-null if startTime is non-null"
          );

          // Update buffered range.
          // No intersection.  Nothing was removed.
          if (endTime <= this.bufferStart_ || startTime >= this.bufferEnd_) {
          } else {
            if (startTime <= this.bufferStart_ && endTime >= this.bufferEnd_) {
              // We wiped out everything.
              this.bufferStart_ = this.bufferEnd_ = null;
            } else {
              if (startTime <= this.bufferStart_ && endTime < this.bufferEnd_) {
                // We removed from the beginning of the range.
                this.bufferStart_ = endTime;
              } else {
                if (
                  startTime > this.bufferStart_ &&
                  endTime >= this.bufferEnd_
                ) {
                  // We removed from the end of the range.
                  this.bufferEnd_ = startTime;
                } else {
                  // We removed from the middle?  StreamingEngine isn't supposed to.
                  goog.asserts.assert(
                    false,
                    "removal from the middle is not supported by TextEngine"
                  );
                }
              }
            }
          }
        }
      }
    }

    setTimestampOffset(timestampOffset: number) {
      this.timestampOffset_ = timestampOffset;
    }

    setAppendWindow(appendWindowStart: number, appendWindowEnd: number) {
      this.appendWindowStart_ = appendWindowStart;
      this.appendWindowEnd_ = appendWindowEnd;
    }

    /**
     * @return Time in seconds of the beginning of the buffered range,
     *   or null if nothing is buffered.
     */
    bufferStart(): number | null {
      return this.bufferStart_;
    }

    /**
     * @return Time in seconds of the end of the buffered range,
     *   or null if nothing is buffered.
     */
    bufferEnd(): number | null {
      return this.bufferEnd_;
    }

    /**
     * @param t A timestamp
     */
    isBuffered(t: number): boolean {
      if (this.bufferStart_ == null || this.bufferEnd_ == null) {
        return false;
      }
      return t >= this.bufferStart_ && t < this.bufferEnd_;
    }

    /**
     * @param t A timestamp
     * @return Number of seconds ahead of 't' we have buffered
     */
    bufferedAheadOf(t: number): number {
      if (this.bufferEnd_ == null || this.bufferEnd_ < t) {
        return 0;
      }
      goog.asserts.assert(
        this.bufferStart_ != null,
        "start should not be null if end is not null"
      );
      return this.bufferEnd_ - Math.max(t, this.bufferStart_);
    }

    /**
     * Set the selected closed captions id.
     * Append the cues stored in the closed captions map until buffer end time.
     * This is to fill the gap between buffered and unbuffered captions, and to
     * avoid duplicates that would be caused by any future video segments parsed
     * for captions.
     *
     * @param bufferEndTime Load any stored cues up to this time.
     */
    setSelectedClosedCaptionId(id: string, bufferEndTime: number) {
      this.selectedClosedCaptionId_ = id;
      const captionsMap = this.closedCaptionsMap_.get(id);
      if (captionsMap) {
        for (const startAndEndTime of captionsMap.keys()) {
          const cues: Cue[] = captionsMap
            .get(startAndEndTime)
            .filter((c) => c.endTime <= bufferEndTime);
          if (cues) {
            this.displayer_.append(cues);
          }
        }
      }
    }

    convertMuxjsCaptionsToShakaCaptions(
      closedCaptions: muxjs.mp4.ClosedCaption[]
    ): ClosedCaption[] {
      const cues = [];
      for (const caption of closedCaptions) {
        const cue = new shaka.text.Cue(
          caption.startTime,
          caption.endTime,
          caption.text
        );
        cues.push({ stream: caption.stream, cue });
      }
      return cues;
    }

    /**
     * @param cue the cue to apply the timestamp to recursively
     * @param videoTimestampOffset the timestamp offset of the video
     */
    private applyVideoTimestampOffsetRecursive_(
      cue: Cue,
      videoTimestampOffset: number
    ) {
      cue.startTime += videoTimestampOffset;
      cue.endTime += videoTimestampOffset;
      for (const nested of cue.nestedCues) {
        this.applyVideoTimestampOffsetRecursive_(nested, videoTimestampOffset);
      }
    }

    /**
     * Store the closed captions in the text engine, and append the cues to the
     * text displayer.  This is a side-channel used for embedded text only.
     *
     * @param startTime relative to the start of the presentation
     * @param endTime relative to the start of the presentation
     * @param videoTimestampOffset the timestamp offset of the video
     *   stream in which these captions were embedded
     */
    storeAndAppendClosedCaptions(
      closedCaptions: ClosedCaption[],
      startTime: number | null,
      endTime: number | null,
      videoTimestampOffset: number
    ) {
      const startAndEndTime = startTime + " " + endTime;
      const captionsMap: Map<string, Map<string, Cue[]>> = new Map();
      for (const caption of closedCaptions) {
        const id = caption.stream;
        const cue = caption.cue;
        if (!captionsMap.has(id)) {
          captionsMap.set(id, new Map());
        }
        if (!captionsMap.get(id).has(startAndEndTime)) {
          captionsMap.get(id).set(startAndEndTime, []);
        }

        // Adjust CEA captions with respect to the timestamp offset of the video
        // stream in which they were embedded.
        this.applyVideoTimestampOffsetRecursive_(cue, videoTimestampOffset);
        const keepThisCue =
          cue.startTime >= this.appendWindowStart_ &&
          cue.startTime < this.appendWindowEnd_;
        if (!keepThisCue) {
          continue;
        }
        captionsMap.get(id).get(startAndEndTime).push(cue);
        if (id == this.selectedClosedCaptionId_) {
          this.displayer_.append([cue]);
        }
      }
      for (const id of captionsMap.keys()) {
        if (!this.closedCaptionsMap_.has(id)) {
          this.closedCaptionsMap_.set(id, new Map());
        }
        for (const startAndEndTime of captionsMap.get(id).keys()) {
          const cues = captionsMap.get(id).get(startAndEndTime);
          this.closedCaptionsMap_.get(id).set(startAndEndTime, cues);
        }
      }
      if (this.bufferStart_ == null) {
        this.bufferStart_ = Math.max(startTime, this.appendWindowStart_);
      } else {
        this.bufferStart_ = Math.min(
          this.bufferStart_,
          Math.max(startTime, this.appendWindowStart_)
        );
      }
      this.bufferEnd_ = Math.max(
        this.bufferEnd_,
        Math.min(endTime, this.appendWindowEnd_)
      );
    }

    /**
     * Get the number of closed caption channels.
     *
     * This function is for TESTING ONLY. DO NOT USE in the library.
     *
     */
    getNumberOfClosedCaptionChannels(): number {
      return this.closedCaptionsMap_.size;
    }

    /**
     * Get the number of closed caption cues for a given channel. If there is
     * no channel for the given channel id, this will return 0.
     *
     * This function is for TESTING ONLY. DO NOT USE in the library.
     *
     */
    getNumberOfClosedCaptionsInChannel(channelId: string): number {
      const channel = this.closedCaptionsMap_.get(channelId);
      return channel ? channel.size : 0;
    }
  }
}
