/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.dash.DashParser");

namespace shaka.dash {
  /**
   * @summary A set of functions for parsing SegmentList elements.
   */
  export class SegmentList {
    /**
     * Creates a new StreamInfo object.
     * Updates the existing SegmentIndex, if any.
     *
     */
    static createStreamInfo(
      context: Context,
      streamMap: { [key: string]: shaka.extern.Stream }
    ): StreamInfo {
      goog.asserts.assert(
        context.representation.segmentList,
        "Should only be called with SegmentList"
      );
      const SegmentList = shaka.dash.SegmentList;
      const initSegmentReference = shaka.dash.SegmentBase.createInitSegment(
        context,
        SegmentList.fromInheritance_
      );
      const info = SegmentList.parseSegmentListInfo_(context);
      SegmentList.checkSegmentListInfo_(context, info);
      let segmentIndex: SegmentIndex = null;
      let stream = null;
      if (context.period.id && context.representation.id) {
        // Only check/store the index if period and representation IDs are set.
        const id = context.period.id + "," + context.representation.id;
        stream = streamMap[id];
        if (stream) {
          segmentIndex = stream.segmentIndex;
        }
      }
      const references = SegmentList.createSegmentReferences_(
        context.periodInfo.start,
        context.periodInfo.duration,
        info.startNumber,
        context.representation.baseUris,
        info,
        initSegmentReference
      );
      const isNew = !segmentIndex;
      if (segmentIndex) {
        const start =
          context.presentationTimeline.getSegmentAvailabilityStart();
        segmentIndex.mergeAndEvict(references, start);
      } else {
        segmentIndex = new shaka.media.SegmentIndex(references);
      }
      context.presentationTimeline.notifySegments(references);
      if (!context.dynamic || !context.periodInfo.isLastPeriod) {
        const periodStart = context.periodInfo.start;
        const periodEnd = context.periodInfo.duration
          ? context.periodInfo.start + context.periodInfo.duration
          : Infinity;
        segmentIndex.fit(periodStart, periodEnd, isNew);
      }
      if (stream) {
        stream.segmentIndex = segmentIndex;
      }
      return {
        generateSegmentIndex: () => {
          if (!segmentIndex || segmentIndex.isEmpty()) {
            segmentIndex.merge(references);
          }
          return Promise.resolve(segmentIndex);
        },
      };
    }

    private static fromInheritance_(frame: InheritanceFrame | null): Element {
      return frame.segmentList;
    }

    /**
     * Parses the SegmentList items to create an info object.
     *
     */
    private static parseSegmentListInfo_(context: Context): SegmentListInfo {
      const SegmentList = shaka.dash.SegmentList;
      const MpdUtils = shaka.dash.MpdUtils;
      const mediaSegments = SegmentList.parseMediaSegments_(context);
      const segmentInfo = MpdUtils.parseSegmentInfo(
        context,
        SegmentList.fromInheritance_
      );
      let startNumber = segmentInfo.startNumber;
      if (startNumber == 0) {
        shaka.log.warning("SegmentList@startNumber must be > 0");
        startNumber = 1;
      }
      let startTime = 0;
      if (segmentInfo.segmentDuration) {
        // See DASH sec. 5.3.9.5.3
        // Don't use presentationTimeOffset for @duration.
        startTime = segmentInfo.segmentDuration * (startNumber - 1);
      } else {
        if (segmentInfo.timeline && segmentInfo.timeline.length > 0) {
          // The presentationTimeOffset was considered in timeline creation.
          startTime = segmentInfo.timeline[0].start;
        }
      }
      return {
        segmentDuration: segmentInfo.segmentDuration,
        startTime: startTime,
        startNumber: startNumber,
        scaledPresentationTimeOffset: segmentInfo.scaledPresentationTimeOffset,
        timeline: segmentInfo.timeline,
        mediaSegments: mediaSegments,
      };
    }

    /**
     * Checks whether a SegmentListInfo object is valid.
     *
     */
    private static checkSegmentListInfo_(
      context: Context,
      info: SegmentListInfo
    ) {
      if (
        !info.segmentDuration &&
        !info.timeline &&
        info.mediaSegments.length > 1
      ) {
        shaka.log.warning(
          "SegmentList does not contain sufficient segment information:",
          "the SegmentList specifies multiple segments,",
          "but does not specify a segment duration or timeline.",
          context.representation
        );
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MANIFEST,
          shaka.util.Error.Code.DASH_NO_SEGMENT_INFO
        );
      }
      if (
        !info.segmentDuration &&
        !context.periodInfo.duration &&
        !info.timeline &&
        info.mediaSegments.length == 1
      ) {
        shaka.log.warning(
          "SegmentList does not contain sufficient segment information:",
          "the SegmentList specifies one segment,",
          "but does not specify a segment duration, period duration,",
          "or timeline.",
          context.representation
        );
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MANIFEST,
          shaka.util.Error.Code.DASH_NO_SEGMENT_INFO
        );
      }
      if (info.timeline && info.timeline.length == 0) {
        shaka.log.warning(
          "SegmentList does not contain sufficient segment information:",
          "the SegmentList has an empty timeline.",
          context.representation
        );
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MANIFEST,
          shaka.util.Error.Code.DASH_NO_SEGMENT_INFO
        );
      }
    }

    /**
     * Creates an array of segment references for the given data.
     *
     * @param periodStart in seconds.
     * @param periodDuration in seconds.
     */
    private static createSegmentReferences_(
      periodStart: number,
      periodDuration: number | null,
      startNumber: number,
      baseUris: string[],
      info: SegmentListInfo,
      initSegmentReference: InitSegmentReference
    ): SegmentReference[] {
      const ManifestParserUtils = shaka.util.ManifestParserUtils;
      let max = info.mediaSegments.length;
      if (info.timeline && info.timeline.length != info.mediaSegments.length) {
        max = Math.min(info.timeline.length, info.mediaSegments.length);
        shaka.log.warning(
          "The number of items in the segment timeline and the number of ",
          "segment URLs do not match, truncating",
          info.mediaSegments.length,
          "to",
          max
        );
      }
      const timestampOffset = periodStart - info.scaledPresentationTimeOffset;
      const appendWindowStart = periodStart;
      const appendWindowEnd = periodDuration
        ? periodStart + periodDuration
        : Infinity;
      const references: SegmentReference[] = [];
      let prevEndTime = info.startTime;
      for (let i = 0; i < max; i++) {
        const segment = info.mediaSegments[i];
        const mediaUri = ManifestParserUtils.resolveUris(baseUris, [
          segment.mediaUri,
        ]);
        const startTime = prevEndTime;
        let endTime;
        if (info.segmentDuration != null) {
          endTime = startTime + info.segmentDuration;
        } else {
          if (info.timeline) {
            // Ignore the timepoint start since they are continuous.
            endTime = info.timeline[i].end;
          } else {
            // If segmentDuration and timeline are null then there must
            // be exactly one segment.
            goog.asserts.assert(
              info.mediaSegments.length == 1 && periodDuration,
              "There should be exactly one segment with a Period duration."
            );
            endTime = startTime + periodDuration;
          }
        }
        const getUris = () => mediaUri;
        references.push(
          new shaka.media.SegmentReference(
            periodStart + startTime,
            periodStart + endTime,
            getUris,
            segment.start,
            segment.end,
            initSegmentReference,
            timestampOffset,
            appendWindowStart,
            appendWindowEnd
          )
        );
        prevEndTime = endTime;
      }
      return references;
    }

    /**
     * Parses the media URIs from the context.
     *
     */
    private static parseMediaSegments_(context: Context): MediaSegment[] {
      const Functional = shaka.util.Functional;
      const segmentLists: Element[] = [
        context.representation.segmentList,
        context.adaptationSet.segmentList,
        context.period.segmentList,
      ].filter(Functional.isNotNull);
      const XmlUtils = shaka.util.XmlUtils;

      // Search each SegmentList for one with at least one SegmentURL element,
      // select the first one, and convert each SegmentURL element to a tuple.
      return segmentLists
        .map((node) => {
          return XmlUtils.findChildren(node, "SegmentURL");
        })
        .reduce((all, part) => {
          return all.length > 0 ? all : part;
        })
        .map((urlNode) => {
          if (
            urlNode.getAttribute("indexRange") &&
            !context.indexRangeWarningGiven
          ) {
            context.indexRangeWarningGiven = true;
            shaka.log.warning(
              "We do not support the SegmentURL@indexRange attribute on " +
                "SegmentList.  We only use the SegmentList@duration " +
                "attribute or SegmentTimeline, which must be accurate."
            );
          }
          const uri = urlNode.getAttribute("media");
          const range = XmlUtils.parseAttr(
            urlNode,
            "mediaRange",
            XmlUtils.parseRange,
            { start: 0, end: null }
          );
          return { mediaUri: uri, start: range.start, end: range.end };
        });
    }
  }
}

export interface MediaSegment {
  mediaUri: string;
  start: number;
  end: number | null;
}

export { MediaSegment };

export interface SegmentListInfo {
  segmentDuration: number | null;
  startTime: number;
  startNumber: number;
  scaledPresentationTimeOffset: number;
  timeline: TimeRange[];
  mediaSegments: MediaSegment[];
}

export { SegmentListInfo };
