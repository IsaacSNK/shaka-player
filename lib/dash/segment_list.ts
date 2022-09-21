/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as DashParserExports from './dash___dash_parser';
import {DashParser} from './dash___dash_parser';
import * as MpdUtilsExports from './dash___mpd_utils';
import {MpdUtils} from './dash___mpd_utils';
import {SegmentBase} from './dash___segment_base';
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as logExports from './debug___log';
import {log} from './debug___log';
import {SegmentIndex} from './media___segment_index';
import * as SegmentReferenceExports from './media___segment_reference';
import {InitSegmentReference, SegmentReference} from './media___segment_reference';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import {Functional} from './util___functional';
import * as ManifestParserUtilsExports from './util___manifest_parser_utils';
import {ManifestParserUtils} from './util___manifest_parser_utils';
import {XmlUtils} from './util___xml_utils';

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
      context: DashParserExports.Context,
      streamMap: {[key: string]: shaka.extern.Stream}):
      DashParserExports.StreamInfo {
    asserts.assert(
        context.representation.segmentList,
        'Should only be called with SegmentList');
    const SegmentList = SegmentList;
    const initSegmentReference =
        SegmentBase.createInitSegment(context, SegmentList.fromInheritance_);
    const info = SegmentList.parseSegmentListInfo_(context);
    SegmentList.checkSegmentListInfo_(context, info);
    let segmentIndex: SegmentIndex = null;
    let stream = null;
    if (context.period.id && context.representation.id) {
      // Only check/store the index if period and representation IDs are set.
      const id = context.period.id + ',' + context.representation.id;
      stream = streamMap[id];
      if (stream) {
        segmentIndex = stream.segmentIndex;
      }
    }
    const references = SegmentList.createSegmentReferences_(
        context.periodInfo.start, context.periodInfo.duration, info.startNumber,
        context.representation.baseUris, info, initSegmentReference);
    const isNew = !segmentIndex;
    if (segmentIndex) {
      const start = context.presentationTimeline.getSegmentAvailabilityStart();
      segmentIndex.mergeAndEvict(references, start);
    } else {
      segmentIndex = new SegmentIndex(references);
    }
    context.presentationTimeline.notifySegments(references);
    if (!context.dynamic || !context.periodInfo.isLastPeriod) {
      const periodStart = context.periodInfo.start;
      const periodEnd = context.periodInfo.duration ?
          context.periodInfo.start + context.periodInfo.duration :
          Infinity;
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
      }
    };
  }

  private static fromInheritance_(frame: DashParserExports.InheritanceFrame|
                                  null): Element {
    return frame.segmentList;
  }

  /**
   * Parses the SegmentList items to create an info object.
   *
   */
  private static parseSegmentListInfo_(context: DashParserExports.Context):
      SegmentListInfo {
    const SegmentList = SegmentList;
    const MpdUtils = MpdUtils;
    const mediaSegments = SegmentList.parseMediaSegments_(context);
    const segmentInfo =
        MpdUtils.parseSegmentInfo(context, SegmentList.fromInheritance_);
    let startNumber = segmentInfo.startNumber;
    if (startNumber == 0) {
      log.warning('SegmentList@startNumber must be > 0');
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
      mediaSegments: mediaSegments
    };
  }

  /**
   * Checks whether a SegmentListInfo object is valid.
   *
   */
  private static checkSegmentListInfo_(
      context: DashParserExports.Context, info: SegmentListInfo) {
    if (!info.segmentDuration && !info.timeline &&
        info.mediaSegments.length > 1) {
      log.warning(
          'SegmentList does not contain sufficient segment information:',
          'the SegmentList specifies multiple segments,',
          'but does not specify a segment duration or timeline.',
          context.representation);
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.DASH_NO_SEGMENT_INFO);
    }
    if (!info.segmentDuration && !context.periodInfo.duration &&
        !info.timeline && info.mediaSegments.length == 1) {
      log.warning(
          'SegmentList does not contain sufficient segment information:',
          'the SegmentList specifies one segment,',
          'but does not specify a segment duration, period duration,',
          'or timeline.', context.representation);
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.DASH_NO_SEGMENT_INFO);
    }
    if (info.timeline && info.timeline.length == 0) {
      log.warning(
          'SegmentList does not contain sufficient segment information:',
          'the SegmentList has an empty timeline.', context.representation);
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.DASH_NO_SEGMENT_INFO);
    }
  }

  /**
   * Creates an array of segment references for the given data.
   *
   * @param periodStart in seconds.
   * @param periodDuration in seconds.
   */
  private static createSegmentReferences_(
      periodStart: number, periodDuration: number|null, startNumber: number,
      baseUris: string[], info: SegmentListInfo,
      initSegmentReference: InitSegmentReference): SegmentReference[] {
    const ManifestParserUtils = ManifestParserUtils;
    let max = info.mediaSegments.length;
    if (info.timeline && info.timeline.length != info.mediaSegments.length) {
      max = Math.min(info.timeline.length, info.mediaSegments.length);
      log.warning(
          'The number of items in the segment timeline and the number of ',
          'segment URLs do not match, truncating', info.mediaSegments.length,
          'to', max);
    }
    const timestampOffset = periodStart - info.scaledPresentationTimeOffset;
    const appendWindowStart = periodStart;
    const appendWindowEnd =
        periodDuration ? periodStart + periodDuration : Infinity;
    const references: SegmentReference[] = [];
    let prevEndTime = info.startTime;
    for (let i = 0; i < max; i++) {
      const segment = info.mediaSegments[i];
      const mediaUri =
          ManifestParserUtils.resolveUris(baseUris, [segment.mediaUri]);
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
          asserts.assert(
              info.mediaSegments.length == 1 && periodDuration,
              'There should be exactly one segment with a Period duration.');
          endTime = startTime + periodDuration;
        }
      }
      const getUris = () => mediaUri;
      references.push(new SegmentReference(
          periodStart + startTime, periodStart + endTime, getUris,
          segment.start, segment.end, initSegmentReference, timestampOffset,
          appendWindowStart, appendWindowEnd));
      prevEndTime = endTime;
    }
    return references;
  }

  /**
   * Parses the media URIs from the context.
   *
   */
  private static parseMediaSegments_(context: DashParserExports.Context):
      MediaSegment[] {
    const Functional = Functional;
    const segmentLists: Element[] = [
      context.representation.segmentList, context.adaptationSet.segmentList,
      context.period.segmentList
    ].filter(Functional.isNotNull);
    const XmlUtils = XmlUtils;

    // Search each SegmentList for one with at least one SegmentURL element,
    // select the first one, and convert each SegmentURL element to a tuple.
    return segmentLists
        .map((node) => {
          return XmlUtils.findChildren(node, 'SegmentURL');
        })
        .reduce((all, part) => {
          return all.length > 0 ? all : part;
        })
        .map((urlNode) => {
          if (urlNode.getAttribute('indexRange') &&
              !context.indexRangeWarningGiven) {
            context.indexRangeWarningGiven = true;
            log.warning(
                'We do not support the SegmentURL@indexRange attribute on ' +
                'SegmentList.  We only use the SegmentList@duration ' +
                'attribute or SegmentTimeline, which must be accurate.');
          }
          const uri = urlNode.getAttribute('media');
          const range = XmlUtils.parseAttr(
              urlNode, 'mediaRange', XmlUtils.parseRange,
              {start: 0, end: null});
          return {mediaUri: uri, start: range.start, end: range.end};
        });
  }
}
type MediaSegment = {
  mediaUri: string,
  start: number,
  end: number|null
};

export {MediaSegment};
type SegmentListInfo = {
  segmentDuration: number|null,
  startTime: number,
  startNumber: number,
  scaledPresentationTimeOffset: number,
  timeline: MpdUtilsExports.TimeRange[],
  mediaSegments: MediaSegment[]
};

export {SegmentListInfo};
