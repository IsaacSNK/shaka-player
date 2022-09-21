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
import * as ManifestParserUtilsExports from './util___manifest_parser_utils';
import {ManifestParserUtils} from './util___manifest_parser_utils';
import {ObjectUtils} from './util___object_utils';

/**
 * @summary A set of functions for parsing SegmentTemplate elements.
 */
export class SegmentTemplate {
  /**
   * Creates a new StreamInfo object.
   * Updates the existing SegmentIndex, if any.
   *
   * @param
   *   requestInitSegment
   * @param isUpdate True if the manifest is being updated.
   * @param segmentLimit The maximum number of segments to generate for
   *   a SegmentTemplate with fixed duration.
   */
  static createStreamInfo(
      context: DashParserExports.Context,
      requestInitSegment: DashParserExports.RequestInitSegmentCallback,
      streamMap: {[key: string]: shaka.extern.Stream}, isUpdate: boolean,
      segmentLimit: number, periodDurationMap: {[key: string]: number}):
      DashParserExports.StreamInfo {
    asserts.assert(
        context.representation.segmentTemplate,
        'Should only be called with SegmentTemplate');
    const SegmentTemplate = SegmentTemplate;
    const initSegmentReference = SegmentTemplate.createInitSegment_(context);
    const info = SegmentTemplate.parseSegmentTemplateInfo_(context);
    SegmentTemplate.checkSegmentTemplateInfo_(context, info);

    // Direct fields of context will be reassigned by the parser before
    // generateSegmentIndex is called.  So we must make a shallow copy first,
    // and use that in the generateSegmentIndex callbacks.
    const shallowCopyOfContext = ObjectUtils.shallowCloneObject(context);
    if (info.indexTemplate) {
      SegmentBase.checkSegmentIndexSupport(context, initSegmentReference);
      return {
        generateSegmentIndex: () => {
          return SegmentTemplate.generateSegmentIndexFromIndexTemplate_(
              shallowCopyOfContext, requestInitSegment, initSegmentReference,
              info);
        }
      };
    } else {
      if (info.segmentDuration) {
        if (!isUpdate) {
          context.presentationTimeline.notifyMaxSegmentDuration(
              info.segmentDuration);
          context.presentationTimeline.notifyMinSegmentStartTime(
              context.periodInfo.start);
        }
        return {
          generateSegmentIndex: () => {
            return SegmentTemplate.generateSegmentIndexFromDuration_(
                shallowCopyOfContext, info, segmentLimit, initSegmentReference,
                periodDurationMap);
          }
        };
      } else {
        let segmentIndex: SegmentIndex = null;
        let id = null;
        let stream = null;
        if (context.period.id && context.representation.id) {
          // Only check/store the index if period and representation IDs are
          // set.
          id = context.period.id + ',' + context.representation.id;
          stream = streamMap[id];
          if (stream) {
            segmentIndex = stream.segmentIndex;
          }
        }
        const references = SegmentTemplate.createFromTimeline_(
            shallowCopyOfContext, info, initSegmentReference);
        const periodStart = context.periodInfo.start;
        const periodEnd = context.periodInfo.duration ?
            context.periodInfo.start + context.periodInfo.duration :
            Infinity;

        // Don't fit live content, since it might receive more segments.
        // Unless that live content is multi-period; it's safe to fit every
        // period but the last one, since only the last period might receive new
        // segments.
        const shouldFit = periodEnd != Infinity;
        if (segmentIndex) {
          if (shouldFit) {
            // Fit the new references before merging them, so that the merge
            // algorithm has a more accurate view of their start and end times.
            const wrapper = new SegmentIndex(references);
            wrapper.fit(
                periodStart, periodEnd,
                /* isNew= */
                true);
          }
          segmentIndex.mergeAndEvict(
              references,
              context.presentationTimeline.getSegmentAvailabilityStart());
        } else {
          segmentIndex = new SegmentIndex(references);
        }
        context.presentationTimeline.notifySegments(references);
        if (shouldFit) {
          segmentIndex.fit(periodStart, periodEnd);
        }
        if (stream && context.dynamic) {
          stream.segmentIndex = segmentIndex;
        }
        return {
          generateSegmentIndex: () => {
            // If segmentIndex is deleted, or segmentIndex's references are
            // released by closeSegmentIndex(), we should set the value of
            // segmentIndex again.
            if (!segmentIndex || segmentIndex.isEmpty()) {
              segmentIndex.merge(references);
            }
            return Promise.resolve(segmentIndex);
          }
        };
      }
    }
  }

  private static fromInheritance_(frame: DashParserExports.InheritanceFrame|
                                  null): Element {
    return frame.segmentTemplate;
  }

  /**
   * Parses a SegmentTemplate element into an info object.
   *
   */
  private static parseSegmentTemplateInfo_(context: DashParserExports.Context):
      SegmentTemplateInfo {
    const SegmentTemplate = SegmentTemplate;
    const MpdUtils = MpdUtils;
    const segmentInfo =
        MpdUtils.parseSegmentInfo(context, SegmentTemplate.fromInheritance_);
    const media = MpdUtils.inheritAttribute(
        context, SegmentTemplate.fromInheritance_, 'media');
    const index = MpdUtils.inheritAttribute(
        context, SegmentTemplate.fromInheritance_, 'index');
    return {
      segmentDuration: segmentInfo.segmentDuration,
      timescale: segmentInfo.timescale,
      startNumber: segmentInfo.startNumber,
      scaledPresentationTimeOffset: segmentInfo.scaledPresentationTimeOffset,
      unscaledPresentationTimeOffset:
          segmentInfo.unscaledPresentationTimeOffset,
      timeline: segmentInfo.timeline,
      mediaTemplate: media,
      indexTemplate: index
    };
  }

  /**
   * Verifies a SegmentTemplate info object.
   *
   */
  private static checkSegmentTemplateInfo_(
      context: DashParserExports.Context, info: SegmentTemplateInfo) {
    let n = 0;
    n += info.indexTemplate ? 1 : 0;
    n += info.timeline ? 1 : 0;
    n += info.segmentDuration ? 1 : 0;
    if (n == 0) {
      log.error(
          'SegmentTemplate does not contain any segment information:',
          'the SegmentTemplate must contain either an index URL template',
          'a SegmentTimeline, or a segment duration.', context.representation);
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.DASH_NO_SEGMENT_INFO);
    } else {
      if (n != 1) {
        log.warning(
            'SegmentTemplate containes multiple segment information sources:',
            'the SegmentTemplate should only contain an index URL template,',
            'a SegmentTimeline or a segment duration.', context.representation);
        if (info.indexTemplate) {
          log.info('Using the index URL template by default.');
          info.timeline = null;
          info.segmentDuration = null;
        } else {
          asserts.assert(info.timeline, 'There should be a timeline');
          log.info('Using the SegmentTimeline by default.');
          info.segmentDuration = null;
        }
      }
    }
    if (!info.indexTemplate && !info.mediaTemplate) {
      log.error(
          'SegmentTemplate does not contain sufficient segment information:',
          'the SegmentTemplate\'s media URL template is missing.',
          context.representation);
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.DASH_NO_SEGMENT_INFO);
    }
  }

  /**
   * Generates a SegmentIndex from an index URL template.
   *
   * @param
   *     requestInitSegment
   */
  private static generateSegmentIndexFromIndexTemplate_(
      context: DashParserExports.Context,
      requestInitSegment: DashParserExports.RequestInitSegmentCallback,
      init: InitSegmentReference,
      info: SegmentTemplateInfo): Promise<SegmentIndex> {
    const MpdUtils = MpdUtils;
    const ManifestParserUtils = ManifestParserUtils;
    asserts.assert(info.indexTemplate, 'must be using index template');
    const filledTemplate = MpdUtils.fillUriTemplate(
        info.indexTemplate, context.representation.id, null,
        context.bandwidth || null, null);
    const resolvedUris = ManifestParserUtils.resolveUris(
        context.representation.baseUris, [filledTemplate]);
    return SegmentBase.generateSegmentIndexFromUris(
        context, requestInitSegment, init, resolvedUris, 0, null,
        info.scaledPresentationTimeOffset);
  }

  /**
   * Generates a SegmentIndex from fixed-duration segments.
   *
   * @param segmentLimit The maximum number of segments to generate.
   */
  private static generateSegmentIndexFromDuration_(
      context: DashParserExports.Context, info: SegmentTemplateInfo,
      segmentLimit: number, initSegmentReference: InitSegmentReference,
      periodDurationMap: {[key: string]: number}): Promise<SegmentIndex> {
    asserts.assert(
        info.mediaTemplate, 'There should be a media template with duration');
    const MpdUtils = MpdUtils;
    const ManifestParserUtils = ManifestParserUtils;
    const presentationTimeline = context.presentationTimeline;

    // Capture values that could change as the parsing context moves on to
    // other parts of the manifest.
    const periodStart = context.periodInfo.start;
    const periodId = context.period.id;
    const initialPeriodDuration = context.periodInfo.duration;

    // For multi-period live streams the period duration may not be known until
    // the following period appears in an updated manifest. periodDurationMap
    // provides the updated period duration.
    const getPeriodEnd = () => {
      const periodDuration = periodId != null && periodDurationMap[periodId] ||
          initialPeriodDuration;
      const periodEnd =
          periodDuration ? periodStart + periodDuration : Infinity;
      return periodEnd;
    };
    const segmentDuration = info.segmentDuration;
    asserts.assert(
        segmentDuration != null, 'Segment duration must not be null!');
    const startNumber = info.startNumber;
    const timescale = info.timescale;
    const template = info.mediaTemplate;
    const bandwidth = context.bandwidth || null;
    const id = context.representation.id;
    const baseUris = context.representation.baseUris;
    const timestampOffset = periodStart - info.scaledPresentationTimeOffset;

    // Computes the range of presentation timestamps both within the period and
    // available.  This is an intersection of the period range and the
    // availability window.
    const computeAvailablePeriodRange = () => {
      return [
        Math.max(
            presentationTimeline.getSegmentAvailabilityStart(), periodStart),
        Math.min(
            presentationTimeline.getSegmentAvailabilityEnd(), getPeriodEnd())
      ];
    };

    // Computes the range of absolute positions both within the period and
    // available.  The range is inclusive.  These are the positions for which we
    // will generate segment references.
    const computeAvailablePositionRange = () => {
      // In presentation timestamps.
      const availablePresentationTimes = computeAvailablePeriodRange();
      asserts.assert(
          availablePresentationTimes.every(isFinite),
          'Available presentation times must be finite!');
      asserts.assert(
          availablePresentationTimes.every((x) => x >= 0),
          'Available presentation times must be positive!');
      asserts.assert(
          segmentDuration != null, 'Segment duration must not be null!');

      // In period-relative timestamps.
      const availablePeriodTimes =
          availablePresentationTimes.map((x) => x - periodStart);

      // These may sometimes be reversed ([1] <= [0]) if the period is
      // completely unavailable.  The logic will still work if this happens,
      // because we will simply generate no references.

      // In period-relative positions (0-based).
      const availablePeriodPositions = [
        Math.ceil(availablePeriodTimes[0] / segmentDuration),
        Math.ceil(availablePeriodTimes[1] / segmentDuration) - 1
      ];

      // In absolute positions.
      const availablePresentationPositions =
          availablePeriodPositions.map((x) => x + startNumber);
      return availablePresentationPositions;
    };

    // For Live, we must limit the initial SegmentIndex in size, to avoid
    // consuming too much CPU or memory for content with gigantic
    // timeShiftBufferDepth (which can have values up to and including
    // Infinity).
    const range = computeAvailablePositionRange();
    const minPosition = context.dynamic ?
        Math.max(range[0], range[1] - segmentLimit + 1) :
        range[0];
    const maxPosition = range[1];
    const references = [];
    const createReference = (position) => {
      // These inner variables are all scoped to the inner loop, and can be used
      // safely in the callback below.
      asserts.assert(
          segmentDuration != null, 'Segment duration must not be null!');

      // Relative to the period start.
      const positionWithinPeriod = position - startNumber;
      const segmentPeriodTime = positionWithinPeriod * segmentDuration;

      // What will appear in the actual segment files.  The media timestamp is
      // what is expected in the $Time$ template.
      const segmentMediaTime =
          segmentPeriodTime + info.scaledPresentationTimeOffset;
      const getUris = () => {
        const mediaUri = MpdUtils.fillUriTemplate(
            template, id, position, bandwidth, segmentMediaTime * timescale);
        return ManifestParserUtils.resolveUris(baseUris, [mediaUri]);
      };

      // Relative to the presentation.
      const segmentStart = segmentPeriodTime + periodStart;
      const trueSegmentEnd = segmentStart + segmentDuration;

      // Cap the segment end at the period end so that references from the
      // next period will fit neatly after it.
      const segmentEnd = Math.min(trueSegmentEnd, getPeriodEnd());

      // This condition will be true unless the segmentStart was >= periodEnd.
      // If we've done the position calculations correctly, this won't happen.
      asserts.assert(
          segmentStart < segmentEnd,
          'Generated a segment outside of the period!');
      const ref = new SegmentReference(
          segmentStart, segmentEnd, getUris,
          /* startByte= */
          0,
          /* endByte= */
          null, initSegmentReference, timestampOffset,
          /* appendWindowStart= */
          periodStart,
          /* appendWindowEnd= */
          getPeriodEnd());

      // This is necessary information for thumbnail streams:
      ref.trueEndTime = trueSegmentEnd;
      return ref;
    };
    for (let position = minPosition; position <= maxPosition; ++position) {
      const reference = createReference(position);
      references.push(reference);
    }
    const segmentIndex: SegmentIndex = new SegmentIndex(references);

    // If the availability timeline currently ends before the period, we will
    // need to add references over time.
    const willNeedToAddReferences =
        presentationTimeline.getSegmentAvailabilityEnd() < getPeriodEnd();

    // When we start a live stream with a period that ends within the
    // availability window we will not need to add more references, but we will
    // need to evict old references.
    const willNeedToEvictReferences = presentationTimeline.isLive();
    if (willNeedToAddReferences || willNeedToEvictReferences) {
      // The period continues to get longer over time, so check for new
      // references once every |segmentDuration| seconds.
      // We clamp to |minPosition| in case the initial range was reversed and no
      // references were generated.  Otherwise, the update would start creating
      // negative positions for segments in periods which begin in the future.
      let nextPosition = Math.max(minPosition, maxPosition + 1);
      segmentIndex.updateEvery(segmentDuration, () => {
        // Evict any references outside the window.
        const availabilityStartTime =
            presentationTimeline.getSegmentAvailabilityStart();
        segmentIndex.evict(availabilityStartTime);

        // Compute any new references that need to be added.
        const [_, maxPosition] = computeAvailablePositionRange();
        const references = [];
        while (nextPosition <= maxPosition) {
          const reference = createReference(nextPosition);
          references.push(reference);
          nextPosition++;
        }

        // The timer must continue firing until the entire period is
        // unavailable, so that all references will be evicted.
        if (availabilityStartTime > getPeriodEnd() && !references.length) {
          // Signal stop.
          return null;
        }
        return references;
      });
    }
    return Promise.resolve(segmentIndex);
  }

  /**
   * Creates segment references from a timeline.
   *
   */
  private static createFromTimeline_(
      context: DashParserExports.Context, info: SegmentTemplateInfo,
      initSegmentReference: InitSegmentReference): SegmentReference[] {
    const MpdUtils = MpdUtils;
    const ManifestParserUtils = ManifestParserUtils;
    const periodStart = context.periodInfo.start;
    const periodDuration = context.periodInfo.duration;
    const timestampOffset = periodStart - info.scaledPresentationTimeOffset;
    const appendWindowStart = periodStart;
    const appendWindowEnd =
        periodDuration ? periodStart + periodDuration : Infinity;
    const references: SegmentReference[] = [];
    for (let i = 0; i < info.timeline.length; i++) {
      const {start, unscaledStart, end} = info.timeline[i];

      // Note: i = k - 1, where k indicates the k'th segment listed in the MPD.
      // (See section 5.3.9.5.3 of the DASH spec.)
      const segmentReplacement = i + info.startNumber;

      // Consider the presentation time offset in segment uri computation
      const timeReplacement =
          unscaledStart + info.unscaledPresentationTimeOffset;
      const repId = context.representation.id;
      const bandwidth = context.bandwidth || null;
      const mediaTemplate = info.mediaTemplate;
      const baseUris = context.representation.baseUris;

      // This callback must not capture any non-local
      // variables, such as info, context, etc.  Make
      // sure any values you reference here have
      // been assigned to local variables within the
      // loop, or else we will end up with a leak.
      const createUris = () => {
        asserts.assert(
            mediaTemplate, 'There should be a media template with a timeline');
        const mediaUri = MpdUtils.fillUriTemplate(
            mediaTemplate, repId, segmentReplacement, bandwidth || null,
            timeReplacement);
        return ManifestParserUtils.resolveUris(baseUris, [mediaUri])
            .map((g) => {
              return g.toString();
            });
      };
      references.push(new SegmentReference(
          periodStart + start, periodStart + end, createUris,
          /* startByte= */
          0,
          /* endByte= */
          null, initSegmentReference, timestampOffset, appendWindowStart,
          appendWindowEnd));
    }
    return references;
  }

  /**
   * Creates an init segment reference from a context object.
   *
   */
  private static createInitSegment_(context: DashParserExports.Context):
      InitSegmentReference {
    const MpdUtils = MpdUtils;
    const ManifestParserUtils = ManifestParserUtils;
    const SegmentTemplate = SegmentTemplate;
    const initialization = MpdUtils.inheritAttribute(
        context, SegmentTemplate.fromInheritance_, 'initialization');
    if (!initialization) {
      return null;
    }
    const repId = context.representation.id;
    const bandwidth = context.bandwidth || null;
    const baseUris = context.representation.baseUris;
    const getUris = () => {
      asserts.assert(initialization, 'Should have returned earler');
      const filledTemplate = MpdUtils.fillUriTemplate(
          initialization, repId, null, bandwidth, null);
      const resolvedUris =
          ManifestParserUtils.resolveUris(baseUris, [filledTemplate]);
      return resolvedUris;
    };
    const qualityInfo = SegmentBase.createQualityInfo(context);
    return new InitSegmentReference(getUris, 0, null, qualityInfo);
  }
}
type SegmentTemplateInfo = {
  timescale: number,
  segmentDuration: number|null,
  startNumber: number,
  scaledPresentationTimeOffset: number,
  unscaledPresentationTimeOffset: number,
  timeline: MpdUtilsExports.TimeRange[],
  mediaTemplate: string|null,
  indexTemplate: string|null
};

export {SegmentTemplateInfo};
