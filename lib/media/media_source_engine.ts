/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  /**
   * @summary
   * MediaSourceEngine wraps all operations on MediaSource and SourceBuffers.
   * All asynchronous operations return a Promise, and all operations are
   * internally synchronized and serialized as needed.  Operations that can
   * be done in parallel will be done in parallel.
   *
   */
  export class MediaSourceEngine implements IDestroyable {
    private video_: HTMLMediaElement;
    private textDisplayer_: shaka.extern.TextDisplayer;

    /** {!Object.<shaka.util.ManifestParserUtils.ContentType,
                               SourceBuffer>} */
    private sourceBuffers_: { [key: ContentType]: SourceBuffer } = {};

    /** {!Object.<shaka.util.ManifestParserUtils.ContentType,
                               string>} */
    private sourceBufferTypes_: { [key: ContentType]: string } = {};

    /** {!Object.<shaka.util.ManifestParserUtils.ContentType,
                               boolean>} */
    private expectedEncryption_: { [key: ContentType]: boolean } = {};
    private textEngine_: TextEngine = null;
    private segmentRelativeVttTiming_: boolean = false;

    /** {!function(!Array.<shaka.extern.ID3Metadata>,
                        number, ?number)} */
    private onMetadata_: (
      p1: shaka.extern.ID3Metadata[],
      p2: number,
      p3: number | null
    ) => any;

    /**
     * {!Object.<string,
     *                    !Array.<shaka.media.MediaSourceEngine.Operation>>}
     */
    private queues_: { [key: string]: Operation[] } = {};
    private eventManager_: EventManager;
    private transmuxers_: { [key: string]: Transmuxer } = {};
    private captionParser_: IClosedCaptionParser;
    private mediaSourceOpen_: PublicPromise;
    private mediaSource_: MediaSource;
    destroyer_: Destroyer;
    private url_: string = "";
    private sequenceMode_: boolean = false;
    private textSequenceModeOffset_: PublicPromise<number>;

    /**
     * @param video The video element, whose source is tied to
     *   MediaSource during the lifetime of the MediaSourceEngine.
     *    The closed caption parser that should be used to parser closed captions
     *    from the video stream. MediaSourceEngine takes ownership of the parser.
     *    When MediaSourceEngine is destroyed, it will destroy the parser.
     *    The text displayer that will be used with the text engine.
     *    MediaSourceEngine takes ownership of the displayer. When
     *    MediaSourceEngine is destroyed, it will destroy the displayer.
     * @param
     *    onMetadata
     */
    constructor(
      video: HTMLMediaElement,
      closedCaptionParser: IClosedCaptionParser,
      textDisplayer: shaka.extern.TextDisplayer,
      onMetadata?: (
        p1: shaka.extern.ID3Metadata[],
        p2: number,
        p3: number | null
      ) => any
    ) {
      this.video_ = video;
      this.textDisplayer_ = textDisplayer;
      const onMetadataNoOp = (metadata, timestampOffset, segmentEnd) => {};
      this.onMetadata_ = onMetadata || onMetadataNoOp;
      this.eventManager_ = new shaka.util.EventManager();
      this.captionParser_ = closedCaptionParser;
      this.mediaSourceOpen_ = new shaka.util.PublicPromise();
      this.mediaSource_ = this.createMediaSource(this.mediaSourceOpen_);
      this.destroyer_ = new shaka.util.Destroyer(() => this.doDestroy_());
      this.textSequenceModeOffset_ = new shaka.util.PublicPromise();
    }

    /**
     * Create a MediaSource object, attach it to the video element, and return it.
     * Resolves the given promise when the MediaSource is ready.
     *
     * Replaced by unit tests.
     *
     */
    createMediaSource(p: PublicPromise): MediaSource {
      const mediaSource = new MediaSource();

      // Set up MediaSource on the video element.
      this.eventManager_.listenOnce(mediaSource, "sourceopen", () =>
        this.onSourceOpen_(p)
      );

      // Store the object URL for releasing it later.
      this.url_ = shaka.media.MediaSourceEngine.createObjectURL(mediaSource);
      this.video_.src = this.url_;
      return mediaSource;
    }

    private onSourceOpen_(p: PublicPromise) {
      // Release the object URL that was previously created, to prevent memory
      // leak.
      // createObjectURL creates a strong reference to the MediaSource object
      // inside the browser.  Setting the src of the video then creates another
      // reference within the video element.  revokeObjectURL will remove the
      // strong reference to the MediaSource object, and allow it to be
      // garbage-collected later.
      URL.revokeObjectURL(this.url_);
      p.resolve();
    }

    /**
     * Checks if a certain type is supported.
     *
     */
    static isStreamSupported(stream: shaka.extern.Stream): boolean {
      const fullMimeType = shaka.util.MimeUtils.getFullType(
        stream.mimeType,
        stream.codecs
      );
      const extendedMimeType = shaka.util.MimeUtils.getExtendedType(stream);
      return (
        shaka.text.TextEngine.isTypeSupported(fullMimeType) ||
        MediaSource.isTypeSupported(extendedMimeType) ||
        shaka.media.Transmuxer.isSupported(fullMimeType, stream.type)
      );
    }

    /**
     * Returns a map of MediaSource support for well-known types.
     *
     */
    static probeSupport(): { [key: string]: boolean } {
      const testMimeTypes = [
        // MP4 types
        'video/mp4; codecs="avc1.42E01E"',
        'video/mp4; codecs="avc3.42E01E"',
        'video/mp4; codecs="hev1.1.6.L93.90"',
        'video/mp4; codecs="hvc1.1.6.L93.90"',
        'video/mp4; codecs="hev1.2.4.L153.B0"; eotf="smpte2084"',
        // HDR HEVC
        'video/mp4; codecs="hvc1.2.4.L153.B0"; eotf="smpte2084"',
        // HDR HEVC
        'video/mp4; codecs="vp9"',
        'video/mp4; codecs="vp09.00.10.08"',
        'video/mp4; codecs="av01.0.01M.08"',
        'audio/mp4; codecs="mp4a.40.2"',
        'audio/mp4; codecs="ac-3"',
        'audio/mp4; codecs="ec-3"',
        'audio/mp4; codecs="opus"',
        'audio/mp4; codecs="flac"',
        // WebM types
        'video/webm; codecs="vp8"',
        'video/webm; codecs="vp9"',
        'video/webm; codecs="vp09.00.10.08"',
        'audio/webm; codecs="vorbis"',
        'audio/webm; codecs="opus"',
        // MPEG2 TS types (video/ is also used for audio: https://bit.ly/TsMse)
        'video/mp2t; codecs="avc1.42E01E"',
        'video/mp2t; codecs="avc3.42E01E"',
        'video/mp2t; codecs="hvc1.1.6.L93.90"',
        'video/mp2t; codecs="mp4a.40.2"',
        'video/mp2t; codecs="ac-3"',
        'video/mp2t; codecs="ec-3"',
        // WebVTT types
        "text/vtt",
        'application/mp4; codecs="wvtt"',
        // TTML types
        "application/ttml+xml",
        'application/mp4; codecs="stpp"',
        // Containerless types
        ...shaka.media.MediaSourceEngine.RAW_FORMATS,
      ];
      const support = {};
      for (const type of testMimeTypes) {
        if (shaka.util.Platform.supportsMediaSource()) {
          // Our TextEngine is only effective for MSE platforms at the moment.
          if (shaka.text.TextEngine.isTypeSupported(type)) {
            support[type] = true;
          } else {
            support[type] =
              MediaSource.isTypeSupported(type) ||
              shaka.media.Transmuxer.isSupported(type);
          }
        } else {
          support[type] = shaka.util.Platform.supportsMediaType(type);
        }
        const basicType = type.split(";")[0];
        support[basicType] = support[basicType] || support[type];
      }
      return support;
    }

    /** @override */
    destroy() {
      return this.destroyer_.destroy();
    }

    private async doDestroy_() {
      const Functional = shaka.util.Functional;
      const cleanup = [];
      for (const contentType in this.queues_) {
        // Make a local copy of the queue and the first item.
        const q = this.queues_[contentType];
        const inProgress = q[0];

        // Drop everything else out of the original queue.
        this.queues_[contentType] = q.slice(0, 1);

        // We will wait for this item to complete/fail.
        if (inProgress) {
          cleanup.push(inProgress.p.catch(Functional.noop));
        }

        // The rest will be rejected silently if possible.
        for (const item of q.slice(1)) {
          item.p.reject(shaka.util.Destroyer.destroyedError());
        }
      }
      if (this.textEngine_) {
        cleanup.push(this.textEngine_.destroy());
      }
      if (this.textDisplayer_) {
        cleanup.push(this.textDisplayer_.destroy());
      }
      for (const contentType in this.transmuxers_) {
        cleanup.push(this.transmuxers_[contentType].destroy());
      }
      await Promise.all(cleanup);
      if (this.eventManager_) {
        this.eventManager_.release();
        this.eventManager_ = null;
      }
      if (this.video_) {
        // "unload" the video element.
        this.video_.removeAttribute("src");
        this.video_.load();
        // @ts-ignore
        this.video_ = null;
      }
      // @ts-ignore
      this.mediaSource_ = null;
      this.textEngine_ = null;
      this.textDisplayer_ = null;
      this.sourceBuffers_ = {};
      this.transmuxers_ = {};
      this.captionParser_ = null;
      if (goog.DEBUG) {
        for (const contentType in this.queues_) {
          goog.asserts.assert(
            this.queues_[contentType].length == 0,
            contentType + " queue should be empty after destroy!"
          );
        }
      }
      this.queues_ = {};
    }

    /**
     * @return Resolved when MediaSource is open and attached to the
     *   media element.  This process is actually initiated by the constructor.
     */
    // @ts-ignore
    open(): Promise {
      return this.mediaSourceOpen_;
    }

    /**
     * Initialize MediaSourceEngine.
     *
     * Note that it is not valid to call this multiple times, except to add or
     * reinitialize text streams.
     *
     * @param {!Map.<shaka.util.ManifestParserUtils.ContentType,
     *               shaka.extern.Stream>} streamsByType
     *   A map of content types to streams.  All streams must be supported
     *   according to MediaSourceEngine.isStreamSupported.
     *   If true, this will transmux TS content even if it is natively supported.
     *   If true, the media segments are appended to the SourceBuffer in strict
     *   sequence.
     *
     */
    async init(
      streamsByType: Map<ContentType, shaka.extern.Stream>,
      forceTransmuxTS: boolean,
      sequenceMode: boolean = false
      // @ts-ignore
    ): Promise {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      await this.mediaSourceOpen_;
      this.sequenceMode_ = sequenceMode;
      for (const contentType of streamsByType.keys()) {
        const stream = streamsByType.get(contentType);
        goog.asserts.assert(
          shaka.media.MediaSourceEngine.isStreamSupported(stream),
          "Type negotiation should happen before MediaSourceEngine.init!"
        );
        let mimeType = shaka.util.MimeUtils.getFullType(
          stream.mimeType,
          stream.codecs
        );
        if (contentType == ContentType.TEXT) {
          this.reinitText(mimeType, sequenceMode);
        } else {
          if (
            (forceTransmuxTS || !MediaSource.isTypeSupported(mimeType)) &&
            shaka.media.Transmuxer.isSupported(mimeType, contentType)
          ) {
            this.transmuxers_[contentType] = new shaka.media.Transmuxer();
            mimeType = shaka.media.Transmuxer.convertTsCodecs(
              contentType,
              mimeType
            );
          }
          const sourceBuffer = this.mediaSource_.addSourceBuffer(mimeType);
          this.eventManager_.listen(sourceBuffer, "error", () =>
            this.onError_(contentType)
          );
          this.eventManager_.listen(sourceBuffer, "updateend", () =>
            this.onUpdateEnd_(contentType)
          );
          this.sourceBuffers_[contentType] = sourceBuffer;
          this.sourceBufferTypes_[contentType] = mimeType;
          this.queues_[contentType] = [];
          this.expectedEncryption_[contentType] = !!stream.drmInfos.length;
        }
      }
    }

    /**
     * Reinitialize the TextEngine for a new text type.
     */
    reinitText(mimeType: string, sequenceMode: boolean) {
      if (!this.textEngine_) {
        this.textEngine_ = new shaka.text.TextEngine(this.textDisplayer_);
      }
      this.textEngine_.initParser(
        mimeType,
        sequenceMode,
        this.segmentRelativeVttTiming_
      );
    }

    /**
     * @return True if the MediaSource is in an "ended" state, or if the
     *   object has been destroyed.
     */
    ended(): boolean {
      return this.mediaSource_ ? this.mediaSource_.readyState == "ended" : true;
    }

    /**
     * Gets the first timestamp in buffer for the given content type.
     *
     * @return The timestamp in seconds, or null if nothing is buffered.
     */
    bufferStart(contentType: ContentType): number | null {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        return this.textEngine_.bufferStart();
      }
      return shaka.media.TimeRangesUtils.bufferStart(
        this.getBuffered_(contentType)
      );
    }

    /**
     * Gets the last timestamp in buffer for the given content type.
     *
     * @return The timestamp in seconds, or null if nothing is buffered.
     */
    bufferEnd(contentType: ContentType): number | null {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        return this.textEngine_.bufferEnd();
      }
      return shaka.media.TimeRangesUtils.bufferEnd(
        this.getBuffered_(contentType)
      );
    }

    /**
     * Determines if the given time is inside the buffered range of the given
     * content type.
     *
     * @param time Playhead time
     */
    isBuffered(contentType: ContentType, time: number): boolean {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        return this.textEngine_.isBuffered(time);
      } else {
        const buffered = this.getBuffered_(contentType);
        return shaka.media.TimeRangesUtils.isBuffered(buffered, time);
      }
    }

    /**
     * Computes how far ahead of the given timestamp is buffered for the given
     * content type.
     *
     * @return The amount of time buffered ahead in seconds.
     */
    bufferedAheadOf(contentType: ContentType, time: number): number {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        return this.textEngine_.bufferedAheadOf(time);
      } else {
        const buffered = this.getBuffered_(contentType);
        return shaka.media.TimeRangesUtils.bufferedAheadOf(buffered, time);
      }
    }

    /**
     * Returns info about what is currently buffered.
     */
    getBufferedInfo(): shaka.extern.BufferedInfo {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      const TimeRangesUtils = shaka.media.TimeRangesUtils;
      const info = {
        total: TimeRangesUtils.getBufferedInfo(this.video_.buffered),
        audio: TimeRangesUtils.getBufferedInfo(
          this.getBuffered_(ContentType.AUDIO)
        ),
        video: TimeRangesUtils.getBufferedInfo(
          this.getBuffered_(ContentType.VIDEO)
        ),
        text: [],
      };
      if (this.textEngine_) {
        const start = this.textEngine_.bufferStart();
        const end = this.textEngine_.bufferEnd();
        if (start != null && end != null) {
          info.text.push({ start: start, end: end });
        }
      }
      return info;
    }

    /**
     * @return The buffered ranges for the given content type, or
     *   null if the buffered ranges could not be obtained.
     */
    private getBuffered_(contentType: ContentType): TimeRanges {
      try {
        return this.sourceBuffers_[contentType].buffered;
      } catch (exception) {
        if (contentType in this.sourceBuffers_) {
          // Note: previous MediaSource errors may cause access to |buffered| to
          // throw.
          shaka.log.error(
            "failed to get buffered range for " + contentType,
            exception
          );
        }
        // @ts-ignore
        return null;
      }
    }

    /**
     * Enqueue an operation to append data to the SourceBuffer.
     * Start and end times are needed for TextEngine, but not for MediaSource.
     * Start and end times may be null for initialization segments; if present
     * they are relative to the presentation timeline.
     *
     * @param reference The segment reference
     *   we are appending, or null for init segments
     * @param hasClosedCaptions True if the buffer contains CEA closed
     *   captions
     * @param seeked True if we just seeked
     */
    async appendBuffer(
      contentType: ContentType,
      data: BufferSource,
      reference: SegmentReference | null,
      hasClosedCaptions: boolean | null,
      seeked?: boolean
      // @ts-ignore
    ): Promise {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        if (this.sequenceMode_) {
          // This won't be known until the first video segment is appended.
          const offset = await this.textSequenceModeOffset_;
          this.textEngine_.setTimestampOffset(offset);
        }
        await this.textEngine_.appendBuffer(
          data,
          reference ? reference.startTime : null,
          reference ? reference.endTime : null
        );
        return;
      }
      if (this.transmuxers_[contentType]) {
        const transmuxedData = await this.transmuxers_[contentType].transmux(
          data
        );

        // For HLS CEA-608/708 CLOSED-CAPTIONS, text data is embedded in
        // the video stream, so textEngine may not have been initialized.
        if (!this.textEngine_) {
          this.reinitText("text/vtt", this.sequenceMode_);
        }
        if (transmuxedData.metadata) {
          const timestampOffset =
            this.sourceBuffers_[contentType].timestampOffset;
          this.onMetadata_(
            transmuxedData.metadata,
            timestampOffset,
            reference ? reference.endTime : null
          );
        }

        // This doesn't work for native TS support (ex. Edge/Chromecast),
        // since no transmuxing is needed for native TS.
        if (transmuxedData.captions && transmuxedData.captions.length) {
          const videoOffset =
            this.sourceBuffers_[ContentType.VIDEO].timestampOffset;
          const closedCaptions =
            this.textEngine_.convertMuxjsCaptionsToShakaCaptions(
              transmuxedData.captions
            );
          this.textEngine_.storeAndAppendClosedCaptions(
            closedCaptions,
            reference ? reference.startTime : null,
            reference ? reference.endTime : null,
            videoOffset
          );
        }
        data = transmuxedData.data;
      } else {
        if (hasClosedCaptions) {
          if (!this.textEngine_) {
            this.reinitText("text/vtt", this.sequenceMode_);
          }

          // If it is the init segment for closed captions, initialize the closed
          // caption parser.
          if (!reference) {
            this.captionParser_.init(data);
          } else {
            const closedCaptions = this.captionParser_.parseFrom(data);
            if (closedCaptions.length) {
              const videoOffset =
                this.sourceBuffers_[ContentType.VIDEO].timestampOffset;
              this.textEngine_.storeAndAppendClosedCaptions(
                closedCaptions,
                reference.startTime,
                reference.endTime,
                videoOffset
              );
            }
          }
        }
      }
      data = this.workAroundBrokenPlatforms_(
        data,
        reference ? reference.startTime : null,
        contentType
      );
      const sourceBuffer = this.sourceBuffers_[contentType];
      const SEQUENCE = shaka.media.MediaSourceEngine.SourceBufferMode_.SEQUENCE;
      if (this.sequenceMode_ && sourceBuffer.mode != SEQUENCE && reference) {
        // This is the first media segment to be appended to a SourceBuffer in
        // sequence mode.  We set the mode late so that we can trick MediaSource
        // into extracting a timestamp for us to align text segments in sequence
        // mode.

        // Timestamps can only be reliably extracted from video, not audio.
        // Packed audio formats do not have internal timestamps at all.
        // Prefer video for this when available.
        const isBestSourceBufferForTimestamps =
          contentType == ContentType.VIDEO ||
          !(ContentType.VIDEO in this.sourceBuffers_);
        if (isBestSourceBufferForTimestamps) {
          // Append the segment in segments mode first, with offset of 0 and an
          // open append window.
          const originalRange = [
            sourceBuffer.appendWindowStart,
            sourceBuffer.appendWindowEnd,
          ];
          sourceBuffer.appendWindowStart = 0;
          sourceBuffer.appendWindowEnd = Infinity;
          const originalOffset = sourceBuffer.timestampOffset;
          sourceBuffer.timestampOffset = 0;
          await this.enqueueOperation_(contentType, () =>
            this.append_(contentType, data)
          );

          // Reset the offset and append window.
          sourceBuffer.timestampOffset = originalOffset;
          sourceBuffer.appendWindowStart = originalRange[0];
          sourceBuffer.appendWindowEnd = originalRange[1];

          // Now get the timestamp of the segment and compute the offset for text
          // segments.
          const mediaStartTime = shaka.media.TimeRangesUtils.bufferStart(
            this.getBuffered_(contentType)
          );
          const textOffset = (reference.startTime || 0) - (mediaStartTime || 0);
          this.textSequenceModeOffset_.resolve(textOffset);

          // Finally, clear the buffer.
          await this.enqueueOperation_(contentType, () =>
            this.remove_(contentType, 0, this.mediaSource_.duration)
          );
        }

        // Now switch to sequence mode and fall through to our normal operations.
        sourceBuffer.mode = SEQUENCE;
      }
      if (reference && this.sequenceMode_ && contentType != ContentType.TEXT) {
        // In sequence mode, for non-text streams, if we just cleared the buffer
        // and are performing an unbuffered seek, we need to set a new
        // timestampOffset on the sourceBuffer.
        if (seeked) {
          const timestampOffset = reference.startTime;
          this.enqueueOperation_(contentType, () =>
            this.setTimestampOffset_(contentType, timestampOffset)
          );
        }
      }
      let bufferedBefore = null;
      await this.enqueueOperation_(contentType, () => {
        if (goog.DEBUG && reference) {
          // @ts-ignore
          bufferedBefore = this.getBuffered_(contentType);
        }
        this.append_(contentType, data);
      });
      if (goog.DEBUG && reference) {
        const bufferedAfter = this.getBuffered_(contentType);
        const newBuffered = shaka.media.TimeRangesUtils.computeAddedRange(
          bufferedBefore,
          bufferedAfter
        );
        if (newBuffered) {
          const segmentDuration = reference.endTime - reference.startTime;
          if (
            Math.abs(newBuffered.start - reference.startTime) >
            segmentDuration / 2
          ) {
            shaka.log.error(
              "Possible encoding problem detected!",
              "Unexpected buffered range for reference",
              reference,
              "from URIs",
              reference.getUris(),
              "should be",
              { start: reference.startTime, end: reference.endTime },
              "but got",
              newBuffered
            );
          }
        }
      }
    }

    /**
     * Set the selected closed captions Id and language.
     *
     */
    setSelectedClosedCaptionId(id: string) {
      const VIDEO = shaka.util.ManifestParserUtils.ContentType.VIDEO;
      const videoBufferEndTime = this.bufferEnd(VIDEO) || 0;
      this.textEngine_.setSelectedClosedCaptionId(id, videoBufferEndTime);
    }

    /** Disable embedded closed captions. */
    clearSelectedClosedCaptionId() {
      if (this.textEngine_) {
        this.textEngine_.setSelectedClosedCaptionId("", 0);
      }
    }

    /**
     * Enqueue an operation to remove data from the SourceBuffer.
     *
     * @param startTime relative to the start of the presentation
     * @param endTime relative to the start of the presentation
     */
    async remove(
      contentType: ContentType,
      startTime: number,
      endTime: number
      // @ts-ignore
    ): Promise {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        await this.textEngine_.remove(startTime, endTime);
      } else {
        await this.enqueueOperation_(contentType, () =>
          this.remove_(contentType, startTime, endTime)
        );
      }
    }

    /**
     * Enqueue an operation to clear the SourceBuffer.
     *
     */
    // @ts-ignore
    async clear(contentType: ContentType): Promise {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        if (!this.textEngine_) {
          return;
        }
        await this.textEngine_.remove(0, Infinity);
      } else {
        // Note that not all platforms allow clearing to Infinity.
        await this.enqueueOperation_(contentType, () =>
          this.remove_(contentType, 0, this.mediaSource_.duration)
        );
      }
    }

    /**
     * Fully reset the state of the caption parser owned by MediaSourceEngine.
     */
    resetCaptionParser() {
      this.captionParser_.reset();
    }

    /**
     * Enqueue an operation to flush the SourceBuffer.
     * This is a workaround for what we believe is a Chromecast bug.
     *
     */
    // @ts-ignore
    async flush(contentType: ContentType): Promise {
      // Flush the pipeline.  Necessary on Chromecast, even though we have removed
      // everything.
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        // Nothing to flush for text.
        return;
      }
      await this.enqueueOperation_(contentType, () => this.flush_(contentType));
    }

    /**
     * Sets the timestamp offset and append window end for the given content type.
     *
     * @param timestampOffset The timestamp offset.  Segments which start
     *   at time t will be inserted at time t + timestampOffset instead.  This
     *   value does not affect segments which have already been inserted.
     * @param appendWindowStart The timestamp to set the append window
     *   start to.  For future appends, frames/samples with timestamps less than
     *   this value will be dropped.
     * @param appendWindowEnd The timestamp to set the append window end
     *   to.  For future appends, frames/samples with timestamps greater than this
     *   value will be dropped.
     * @param sequenceMode  If true, the timestampOffset will not be
     *   applied in this step.
     */
    async setStreamProperties(
      contentType: ContentType,
      timestampOffset: number,
      appendWindowStart: number,
      appendWindowEnd: number,
      sequenceMode: boolean
      // @ts-ignore
    ): Promise {
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (contentType == ContentType.TEXT) {
        if (!sequenceMode) {
          this.textEngine_.setTimestampOffset(timestampOffset);
        }
        this.textEngine_.setAppendWindow(appendWindowStart, appendWindowEnd);
        return;
      }
      await Promise.all([
        // Queue an abort() to help MSE splice together overlapping segments.
        // We set appendWindowEnd when we change periods in DASH content, and the
        // period transition may result in overlap.
        // An abort() also helps with MPEG2-TS.  When we append a TS segment, we
        // always enter a PARSING_MEDIA_SEGMENT state and we can't change the
        // timestamp offset.  By calling abort(), we reset the state so we can
        // set it.
        this.enqueueOperation_(contentType, () => this.abort_(contentType)),
        // Don't set the timestampOffset here when in sequenceMode, since we
        // use timestampOffset for a different purpose in that mode (e.g. to
        // indicate where the current segment is).
        sequenceMode
          ? Promise.resolve()
          : this.enqueueOperation_(contentType, () =>
              this.setTimestampOffset_(contentType, timestampOffset)
            ),
        this.enqueueOperation_(contentType, () =>
          this.setAppendWindow_(contentType, appendWindowStart, appendWindowEnd)
        ),
      ]);
    }

    /**
     * @param reason Valid reasons are 'network' and 'decode'.
     * @see http://w3c.github.io/media-source/#idl-def-EndOfStreamError
     */
    // @ts-ignore
    async endOfStream(reason?: string): Promise {
      await this.enqueueBlockingOperation_(() => {
        // If endOfStream() has already been called on the media source,
        // don't call it again.
        if (this.ended()) {
          return;
        }

        // Tizen won't let us pass undefined, but it will let us omit the
        // argument.
        if (reason) {
          this.mediaSource_.endOfStream(reason);
        } else {
          this.mediaSource_.endOfStream();
        }
      });
    }

    // @ts-ignore
    async setDuration(duration: number): Promise {
      await this.enqueueBlockingOperation_(() => {
        // Reducing the duration causes the MSE removal algorithm to run, which
        // triggers an 'updateend' event to fire.  To handle this scenario, we
        // have to insert a dummy operation into the beginning of each queue,
        // which the 'updateend' handler will remove.
        if (duration < this.mediaSource_.duration) {
          for (const contentType in this.sourceBuffers_) {
            const dummyOperation = {
              start: () => {},
              p: new shaka.util.PublicPromise(),
            };
            this.queues_[contentType].unshift(dummyOperation);
          }
        }
        this.mediaSource_.duration = duration;
      });
    }

    /**
     * Get the current MediaSource duration.
     *
     */
    getDuration(): number {
      return this.mediaSource_.duration;
    }

    /**
     * Append data to the SourceBuffer.
     */
    private append_(contentType: ContentType, data: BufferSource) {
      // This will trigger an 'updateend' event.
      this.sourceBuffers_[contentType].appendBuffer(data);
    }

    /**
     * Remove data from the SourceBuffer.
     * @param startTime relative to the start of the presentation
     * @param endTime relative to the start of the presentation
     */
    private remove_(
      contentType: ContentType,
      startTime: number,
      endTime: number
    ) {
      if (endTime <= startTime) {
        // Ignore removal of inverted or empty ranges.
        // Fake 'updateend' event to resolve the operation.
        this.onUpdateEnd_(contentType);
        return;
      }

      // This will trigger an 'updateend' event.
      this.sourceBuffers_[contentType].remove(startTime, endTime);
    }

    /**
     * Call abort() on the SourceBuffer.
     * This resets MSE's last_decode_timestamp on all track buffers, which should
     * trigger the splicing logic for overlapping segments.
     */
    private abort_(contentType: ContentType) {
      // Save the append window, which is reset on abort().
      const appendWindowStart =
        this.sourceBuffers_[contentType].appendWindowStart;
      const appendWindowEnd = this.sourceBuffers_[contentType].appendWindowEnd;

      // This will not trigger an 'updateend' event, since nothing is happening.
      // This is only to reset MSE internals, not to abort an actual operation.
      this.sourceBuffers_[contentType].abort();

      // Restore the append window.
      this.sourceBuffers_[contentType].appendWindowStart = appendWindowStart;
      this.sourceBuffers_[contentType].appendWindowEnd = appendWindowEnd;

      // Fake an 'updateend' event to resolve the operation.
      this.onUpdateEnd_(contentType);
    }

    /**
     * Nudge the playhead to force the media pipeline to be flushed.
     * This seems to be necessary on Chromecast to get new content to replace old
     * content.
     */
    private flush_(contentType: ContentType) {
      // Never use flush_ if there's data.  It causes a hiccup in playback.
      goog.asserts.assert(
        this.video_.buffered.length == 0,
        "MediaSourceEngine.flush_ should " +
          "only be used after clearing all data!"
      );

      // Seeking forces the pipeline to be flushed.
      this.video_.currentTime -= 0.001;

      // Fake an 'updateend' event to resolve the operation.
      this.onUpdateEnd_(contentType);
    }

    /**
     * Set the SourceBuffer's timestamp offset.
     */
    private setTimestampOffset_(
      contentType: ContentType,
      timestampOffset: number
    ) {
      // Work around for
      // https://github.com/shaka-project/shaka-player/issues/1281:
      // TODO(https://bit.ly/2ttKiBU): follow up when this is fixed in Edge
      if (timestampOffset < 0) {
        // Try to prevent rounding errors in Edge from removing the first
        // keyframe.
        timestampOffset += 0.001;
      }
      this.sourceBuffers_[contentType].timestampOffset = timestampOffset;

      // Fake an 'updateend' event to resolve the operation.
      this.onUpdateEnd_(contentType);
    }

    /**
     * Set the SourceBuffer's append window end.
     */
    private setAppendWindow_(
      contentType: ContentType,
      appendWindowStart: number,
      appendWindowEnd: number
    ) {
      // You can't set start > end, so first set start to 0, then set the new
      // end, then set the new start.  That way, there are no intermediate
      // states which are invalid.
      this.sourceBuffers_[contentType].appendWindowStart = 0;
      this.sourceBuffers_[contentType].appendWindowEnd = appendWindowEnd;
      this.sourceBuffers_[contentType].appendWindowStart = appendWindowStart;

      // Fake an 'updateend' event to resolve the operation.
      this.onUpdateEnd_(contentType);
    }

    private onError_(contentType: ContentType) {
      const operation = this.queues_[contentType][0];
      goog.asserts.assert(operation, "Spurious error event!");
      goog.asserts.assert(
        !this.sourceBuffers_[contentType].updating,
        "SourceBuffer should not be updating on error!"
      );
      const code = this.video_.error ? this.video_.error.code : 0;
      operation.p.reject(
        new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.MEDIA_SOURCE_OPERATION_FAILED,
          code
        )
      );
    }

    // Do not pop from queue.  An 'updateend' event will fire next, and to
    // avoid synchronizing these two event handlers, we will allow that one to
    // pop from the queue as normal.  Note that because the operation has
    // already been rejected, the call to resolve() in the 'updateend' handler
    // will have no effect.
    private onUpdateEnd_(contentType: ContentType) {
      const operation = this.queues_[contentType][0];
      goog.asserts.assert(operation, "Spurious updateend event!");
      if (!operation) {
        return;
      }
      goog.asserts.assert(
        !this.sourceBuffers_[contentType].updating,
        "SourceBuffer should not be updating on updateend!"
      );
      operation.p.resolve();
      this.popFromQueue_(contentType);
    }

    /**
     * Enqueue an operation and start it if appropriate.
     *
     */
    private enqueueOperation_(
      contentType: ContentType,
      start: () => any
      // @ts-ignore
    ): Promise {
      this.destroyer_.ensureNotDestroyed();
      const operation = { start: start, p: new shaka.util.PublicPromise() };
      this.queues_[contentType].push(operation);
      if (this.queues_[contentType].length == 1) {
        this.startOperation_(contentType);
      }
      return operation.p;
    }

    /**
     * Enqueue an operation which must block all other operations on all
     * SourceBuffers.
     *
     */
    // @ts-ignore
    private async enqueueBlockingOperation_(run: () => any): Promise {
      this.destroyer_.ensureNotDestroyed();
      const allWaiters: PublicPromise[] = [];

      // Enqueue a 'wait' operation onto each queue.
      // This operation signals its readiness when it starts.
      // When all wait operations are ready, the real operation takes place.
      for (const contentType in this.sourceBuffers_) {
        const ready = new shaka.util.PublicPromise();
        const operation = { start: () => ready.resolve(), p: ready };
        this.queues_[contentType].push(operation);
        allWaiters.push(ready);
        if (this.queues_[contentType].length == 1) {
          operation.start();
        }
      }

      // Return a Promise to the real operation, which waits to begin until
      // there are no other in-progress operations on any SourceBuffers.
      try {
        await Promise.all(allWaiters);
      } catch (error) {
        // One of the waiters failed, which means we've been destroyed.
        goog.asserts.assert(
          this.destroyer_.destroyed(),
          "Should be destroyed by now"
        );

        // We haven't popped from the queue.  Canceled waiters have been removed
        // by destroy.  What's left now should just be resolved waiters.  In
        // uncompiled mode, we will maintain good hygiene and make sure the
        // assert at the end of destroy passes.  In compiled mode, the queues
        // are wiped in destroy.
        if (goog.DEBUG) {
          for (const contentType in this.sourceBuffers_) {
            if (this.queues_[contentType].length) {
              goog.asserts.assert(
                this.queues_[contentType].length == 1,
                "Should be at most one item in queue!"
              );
              goog.asserts.assert(
                allWaiters.includes(this.queues_[contentType][0].p),
                "The item in queue should be one of our waiters!"
              );
              this.queues_[contentType].shift();
            }
          }
        }
        throw error;
      }
      if (goog.DEBUG) {
        // If we did it correctly, nothing is updating.
        for (const contentType in this.sourceBuffers_) {
          goog.asserts.assert(
            this.sourceBuffers_[contentType].updating == false,
            "SourceBuffers should not be updating after a blocking op!"
          );
        }
      }

      // Run the real operation, which is synchronous.
      try {
        run();
      } catch (exception) {
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.MEDIA_SOURCE_OPERATION_THREW,
          exception
        );
      } finally {
        // Unblock the queues.
        for (const contentType in this.sourceBuffers_) {
          this.popFromQueue_(contentType);
        }
      }
    }

    /**
     * Pop from the front of the queue and start a new operation.
     */
    private popFromQueue_(contentType: ContentType) {
      // Remove the in-progress operation, which is now complete.
      this.queues_[contentType].shift();
      this.startOperation_(contentType);
    }

    /**
     * Starts the next operation in the queue.
     */
    private startOperation_(contentType: ContentType) {
      // Retrieve the next operation, if any, from the queue and start it.
      const next = this.queues_[contentType][0];
      if (next) {
        try {
          next.start();
        } catch (exception) {
          if (exception.name == "QuotaExceededError") {
            next.p.reject(
              new shaka.util.Error(
                shaka.util.Error.Severity.CRITICAL,
                shaka.util.Error.Category.MEDIA,
                shaka.util.Error.Code.QUOTA_EXCEEDED_ERROR,
                contentType
              )
            );
          } else {
            next.p.reject(
              new shaka.util.Error(
                shaka.util.Error.Severity.CRITICAL,
                shaka.util.Error.Category.MEDIA,
                shaka.util.Error.Code.MEDIA_SOURCE_OPERATION_THREW,
                exception
              )
            );
          }
          this.popFromQueue_(contentType);
        }
      }
    }

    getTextDisplayer(): shaka.extern.TextDisplayer {
      goog.asserts.assert(
        this.textDisplayer_,
        "TextDisplayer should only be null when this is destroyed"
      );
      return this.textDisplayer_;
    }

    setTextDisplayer(textDisplayer: shaka.extern.TextDisplayer) {
      const oldTextDisplayer = this.textDisplayer_;
      this.textDisplayer_ = textDisplayer;
      if (oldTextDisplayer) {
        textDisplayer.setTextVisibility(oldTextDisplayer.isTextVisible());
        oldTextDisplayer.destroy();
      }
      if (this.textEngine_) {
        this.textEngine_.setDisplayer(textDisplayer);
      }
    }

    setSegmentRelativeVttTiming(segmentRelativeVttTiming: boolean) {
      this.segmentRelativeVttTiming_ = segmentRelativeVttTiming;
    }

    /**
     * Apply platform-specific transformations to this segment to work around
     * issues in the platform.
     *
     */
    private workAroundBrokenPlatforms_(
      segment: BufferSource,
      startTime: number | null,
      contentType: ContentType
    ): BufferSource {
      const isInitSegment = startTime == null;
      const encryptionExpected = this.expectedEncryption_[contentType];

      // If:
      //   1. this is an init segment,
      //   2. and encryption is expected,
      //   3. and the platform requires encryption in all init segments,
      //   4. and the content is MP4 (mimeType == "video/mp4" or "audio/mp4"),
      // then insert fake encryption metadata for init segments that lack it.
      // The MP4 requirement is because we can currently only do this
      // transformation on MP4 containers.
      // See: https://github.com/shaka-project/shaka-player/issues/2759
      if (
        isInitSegment &&
        encryptionExpected &&
        shaka.util.Platform.requiresEncryptionInfoInAllInitSegments() &&
        shaka.util.MimeUtils.getContainerType(
          this.sourceBufferTypes_[contentType]
        ) == "mp4"
      ) {
        shaka.log.debug("Forcing fake encryption information in init segment.");
        segment = shaka.media.ContentWorkarounds.fakeEncryption(segment);
      }
      return segment;
    }
  }
}

namespace shaka.media.MediaSourceEngine {
  /**
   * Internal reference to window.URL.createObjectURL function to avoid
   * compatibility issues with other libraries and frameworks such as React
   * Native. For use in unit tests only, not meant for external use.
   *
   */
  export const createObjectURL: (p1: any) => string =
    window.URL.createObjectURL;
}

export interface Operation {
  start: () => any;
  p: PublicPromise;
}

export { Operation };

namespace shaka.media.MediaSourceEngine {
  export enum SourceBufferMode_ {
    SEQUENCE = "sequence",
    SEGMENTS = "segments",
  }
}

namespace shaka.media.MediaSourceEngine {
  /**
   * MIME types of raw formats.
   *
   */
  export const RAW_FORMATS: string[] = [
    "audio/aac",
    "audio/ac3",
    "audio/ec3",
    "audio/mpeg",
  ];
}
