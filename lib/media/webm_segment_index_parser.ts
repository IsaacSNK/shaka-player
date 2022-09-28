/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  export class WebmSegmentIndexParser {
    /**
     * Parses SegmentReferences from a WebM container.
     * @param cuesData The WebM container's "Cueing Data" section.
     * @param initData The WebM container's headers.
     * @param uris The possible locations of the WebM file that
     *   contains the segments.
     * @see http://www.matroska.org/technical/specs/index.html
     * @see http://www.webmproject.org/docs/container/
     */
    static parse(
      cuesData: BufferSource,
      initData: BufferSource,
      uris: string[],
      initSegmentReference: InitSegmentReference,
      timestampOffset: number,
      appendWindowStart: number,
      appendWindowEnd: number
    ): SegmentReference[] {
      const tuple =
        shaka.media.WebmSegmentIndexParser.parseWebmContainer_(initData);
      const parser = new shaka.util.EbmlParser(cuesData);
      const cuesElement = parser.parseElement();
      if (cuesElement.id != shaka.media.WebmSegmentIndexParser.CUES_ID) {
        shaka.log.error("Not a Cues element.");
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.WEBM_CUES_ELEMENT_MISSING
        );
      }
      return shaka.media.WebmSegmentIndexParser.parseCues_(
        cuesElement,
        tuple.segmentOffset,
        tuple.timecodeScale,
        tuple.duration,
        uris,
        initSegmentReference,
        timestampOffset,
        appendWindowStart,
        appendWindowEnd
      );
    }

    /**
     * Parses a WebM container to get the segment's offset, timecode scale, and
     * duration.
     *
     *   The segment's offset in bytes, the segment's timecode scale in seconds,
     *   and the duration in seconds.
     */
    private static parseWebmContainer_(initData: BufferSource): {
      segmentOffset: number;
      timecodeScale: number;
      duration: number;
    } {
      const parser = new shaka.util.EbmlParser(initData);

      // Check that the WebM container data starts with the EBML header, but
      // skip its contents.
      const ebmlElement = parser.parseElement();
      if (ebmlElement.id != shaka.media.WebmSegmentIndexParser.EBML_ID) {
        shaka.log.error("Not an EBML element.");
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.WEBM_EBML_HEADER_ELEMENT_MISSING
        );
      }
      const segmentElement = parser.parseElement();
      if (segmentElement.id != shaka.media.WebmSegmentIndexParser.SEGMENT_ID) {
        shaka.log.error("Not a Segment element.");
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.WEBM_SEGMENT_ELEMENT_MISSING
        );
      }

      // This value is used as the initial offset to the first referenced segment.
      const segmentOffset = segmentElement.getOffset();

      // Parse the Segment element to get the segment info.
      const segmentInfo =
        shaka.media.WebmSegmentIndexParser.parseSegment_(segmentElement);
      return {
        segmentOffset: segmentOffset,
        timecodeScale: segmentInfo.timecodeScale,
        duration: segmentInfo.duration,
      };
    }

    /**
     * Parses a WebM Info element to get the segment's timecode scale and
     * duration.
     * @return The segment's timecode
     *   scale in seconds and duration in seconds.
     */
    private static parseSegment_(segmentElement: EbmlElement): {
      timecodeScale: number;
      duration: number;
    } {
      const parser = segmentElement.createParser();

      // Find the Info element.
      let infoElement = null;
      while (parser.hasMoreData()) {
        const elem = parser.parseElement();
        if (elem.id != shaka.media.WebmSegmentIndexParser.INFO_ID) {
          continue;
        }
        infoElement = elem;
        break;
      }
      if (!infoElement) {
        shaka.log.error("Not an Info element.");
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.WEBM_INFO_ELEMENT_MISSING
        );
      }
      return shaka.media.WebmSegmentIndexParser.parseInfo_(infoElement);
    }

    /**
     * Parses a WebM Info element to get the segment's timecode scale and
     * duration.
     * @return The segment's timecode
     *   scale in seconds and duration in seconds.
     */
    private static parseInfo_(infoElement: EbmlElement): {
      timecodeScale: number;
      duration: number;
    } {
      const parser = infoElement.createParser();

      // The timecode scale factor in units of [nanoseconds / T], where [T] are
      // the units used to express all other time values in the WebM container.
      // By default it's assumed that [T] == [milliseconds].
      let timecodeScaleNanoseconds = 1000000;
      let durationScale: number | null = null;
      while (parser.hasMoreData()) {
        const elem = parser.parseElement();
        if (elem.id == shaka.media.WebmSegmentIndexParser.TIMECODE_SCALE_ID) {
          timecodeScaleNanoseconds = elem.getUint();
        } else {
          if (elem.id == shaka.media.WebmSegmentIndexParser.DURATION_ID) {
            durationScale = elem.getFloat();
          }
        }
      }
      if (durationScale == null) {
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.WEBM_DURATION_ELEMENT_MISSING
        );
      }

      // The timecode scale factor in units of [seconds / T].
      const timecodeScale = timecodeScaleNanoseconds / 1000000000;

      // The duration is stored in units of [T]
      const durationSeconds = durationScale * timecodeScale;
      return { timecodeScale: timecodeScale, duration: durationSeconds };
    }

    /**
     * Parses a WebM CuesElement.
     */
    private static parseCues_(
      cuesElement: EbmlElement,
      segmentOffset: number,
      timecodeScale: number,
      duration: number,
      uris: string[],
      initSegmentReference: InitSegmentReference,
      timestampOffset: number,
      appendWindowStart: number,
      appendWindowEnd: number
    ): SegmentReference[] {
      const references = [];
      const getUris = () => uris;
      const parser = cuesElement.createParser();
      let lastTime = null;
      let lastOffset = null;
      while (parser.hasMoreData()) {
        const elem = parser.parseElement();
        if (elem.id != shaka.media.WebmSegmentIndexParser.CUE_POINT_ID) {
          continue;
        }
        const tuple = shaka.media.WebmSegmentIndexParser.parseCuePoint_(elem);
        if (!tuple) {
          continue;
        }

        // Subtract the presentation time offset from the unscaled time
        const currentTime = timecodeScale * tuple.unscaledTime;
        const currentOffset = segmentOffset + tuple.relativeOffset;
        if (lastTime != null) {
          goog.asserts.assert(lastOffset != null, "last offset cannot be null");
          references.push(
            new shaka.media.SegmentReference(
              lastTime + timestampOffset,
              currentTime + timestampOffset,
              getUris,
              /* startByte= */
              lastOffset,
              /* endByte= */
              currentOffset - 1,
              initSegmentReference,
              timestampOffset,
              appendWindowStart,
              appendWindowEnd
            )
          );
        }
        lastTime = currentTime;
        lastOffset = currentOffset;
      }
      if (lastTime != null) {
        goog.asserts.assert(lastOffset != null, "last offset cannot be null");
        references.push(
          new shaka.media.SegmentReference(
            lastTime + timestampOffset,
            duration + timestampOffset,
            getUris,
            /* startByte= */
            lastOffset,
            /* endByte= */
            null,
            initSegmentReference,
            timestampOffset,
            appendWindowStart,
            appendWindowEnd
          )
        );
      }
      return references;
    }

    /**
     * Parses a WebM CuePointElement to get an "unadjusted" segment reference.
     * @return The referenced
     *   segment's start time in units of [T] (see parseInfo_()), and the
     *   referenced segment's offset in bytes, relative to a WebM Segment
     *   element.
     */
    private static parseCuePoint_(cuePointElement: EbmlElement): {
      unscaledTime: number;
      relativeOffset: number;
    } {
      const parser = cuePointElement.createParser();

      // Parse CueTime element.
      const cueTimeElement = parser.parseElement();
      if (cueTimeElement.id != shaka.media.WebmSegmentIndexParser.CUE_TIME_ID) {
        shaka.log.warning("Not a CueTime element.");
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.WEBM_CUE_TIME_ELEMENT_MISSING
        );
      }
      const unscaledTime = cueTimeElement.getUint();

      // Parse CueTrackPositions element.
      const cueTrackPositionsElement = parser.parseElement();
      if (
        cueTrackPositionsElement.id !=
        shaka.media.WebmSegmentIndexParser.CUE_TRACK_POSITIONS_ID
      ) {
        shaka.log.warning("Not a CueTrackPositions element.");
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.WEBM_CUE_TRACK_POSITIONS_ELEMENT_MISSING
        );
      }
      const cueTrackParser = cueTrackPositionsElement.createParser();
      let relativeOffset = 0;
      while (cueTrackParser.hasMoreData()) {
        const elem = cueTrackParser.parseElement();
        if (
          elem.id != shaka.media.WebmSegmentIndexParser.CUE_CLUSTER_POSITION
        ) {
          continue;
        }
        relativeOffset = elem.getUint();
        break;
      }
      return { unscaledTime: unscaledTime, relativeOffset: relativeOffset };
    }
  }
}

namespace shaka.media.WebmSegmentIndexParser {
  export const EBML_ID: number = 440786851;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const SEGMENT_ID: number = 408125543;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const INFO_ID: number = 357149030;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const TIMECODE_SCALE_ID: number = 2807729;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const DURATION_ID: number = 17545;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const CUES_ID: number = 475249515;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const CUE_POINT_ID: number = 187;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const CUE_TIME_ID: number = 179;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const CUE_TRACK_POSITIONS_ID: number = 183;
}

namespace shaka.media.WebmSegmentIndexParser {
  export const CUE_CLUSTER_POSITION: number = 241;
}
