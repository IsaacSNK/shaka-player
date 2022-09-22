/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './../debug/asserts';
import {asserts} from './../debug/asserts';
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import * as SegmentReferenceExports from './/segment_reference';
import {InitSegmentReference, SegmentReference} from './/segment_reference';
import * as EbmlParserExports from './../util/ebml_parser';
import {EbmlElement, EbmlParser} from './../util/ebml_parser';
import * as ErrorExports from './../util/error';
import {Error} from './../util/error';

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
      cuesData: BufferSource, initData: BufferSource, uris: string[],
      initSegmentReference: InitSegmentReference, timestampOffset: number,
      appendWindowStart: number, appendWindowEnd: number): SegmentReference[] {
    const tuple = WebmSegmentIndexParser.parseWebmContainer_(initData);
    const parser = new EbmlParser(cuesData);
    const cuesElement = parser.parseElement();
    if (cuesElement.id != CUES_ID) {
      log.error('Not a Cues element.');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.WEBM_CUES_ELEMENT_MISSING);
    }
    return WebmSegmentIndexParser.parseCues_(
        cuesElement, tuple.segmentOffset, tuple.timecodeScale, tuple.duration,
        uris, initSegmentReference, timestampOffset, appendWindowStart,
        appendWindowEnd);
  }

  /**
   * Parses a WebM container to get the segment's offset, timecode scale, and
   * duration.
   *
   *   The segment's offset in bytes, the segment's timecode scale in seconds,
   *   and the duration in seconds.
   */
  private static parseWebmContainer_(initData: BufferSource):
      {segmentOffset: number, timecodeScale: number, duration: number} {
    const parser = new EbmlParser(initData);

    // Check that the WebM container data starts with the EBML header, but
    // skip its contents.
    const ebmlElement = parser.parseElement();
    if (ebmlElement.id != EBML_ID) {
      log.error('Not an EBML element.');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.WEBM_EBML_HEADER_ELEMENT_MISSING);
    }
    const segmentElement = parser.parseElement();
    if (segmentElement.id != SEGMENT_ID) {
      log.error('Not a Segment element.');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.WEBM_SEGMENT_ELEMENT_MISSING);
    }

    // This value is used as the initial offset to the first referenced segment.
    const segmentOffset = segmentElement.getOffset();

    // Parse the Segment element to get the segment info.
    const segmentInfo = WebmSegmentIndexParser.parseSegment_(segmentElement);
    return {
      segmentOffset: segmentOffset,
      timecodeScale: segmentInfo.timecodeScale,
      duration: segmentInfo.duration
    };
  }

  /**
   * Parses a WebM Info element to get the segment's timecode scale and
   * duration.
   * @return The segment's timecode
   *   scale in seconds and duration in seconds.
   */
  private static parseSegment_(segmentElement: EbmlElement):
      {timecodeScale: number, duration: number} {
    const parser = segmentElement.createParser();

    // Find the Info element.
    let infoElement = null;
    while (parser.hasMoreData()) {
      const elem = parser.parseElement();
      if (elem.id != INFO_ID) {
        continue;
      }
      infoElement = elem;
      break;
    }
    if (!infoElement) {
      log.error('Not an Info element.');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.WEBM_INFO_ELEMENT_MISSING);
    }
    return WebmSegmentIndexParser.parseInfo_(infoElement);
  }

  /**
   * Parses a WebM Info element to get the segment's timecode scale and
   * duration.
   * @return The segment's timecode
   *   scale in seconds and duration in seconds.
   */
  private static parseInfo_(infoElement: EbmlElement):
      {timecodeScale: number, duration: number} {
    const parser = infoElement.createParser();

    // The timecode scale factor in units of [nanoseconds / T], where [T] are
    // the units used to express all other time values in the WebM container.
    // By default it's assumed that [T] == [milliseconds].
    let timecodeScaleNanoseconds = 1000000;
    let durationScale: number|null = null;
    while (parser.hasMoreData()) {
      const elem = parser.parseElement();
      if (elem.id == TIMECODE_SCALE_ID) {
        timecodeScaleNanoseconds = elem.getUint();
      } else {
        if (elem.id == DURATION_ID) {
          durationScale = elem.getFloat();
        }
      }
    }
    if (durationScale == null) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.WEBM_DURATION_ELEMENT_MISSING);
    }

    // The timecode scale factor in units of [seconds / T].
    const timecodeScale = timecodeScaleNanoseconds / 1000000000;

    // The duration is stored in units of [T]
    const durationSeconds = durationScale * timecodeScale;
    return {timecodeScale: timecodeScale, duration: durationSeconds};
  }

  /**
   * Parses a WebM CuesElement.
   */
  private static parseCues_(
      cuesElement: EbmlElement, segmentOffset: number, timecodeScale: number,
      duration: number, uris: string[],
      initSegmentReference: InitSegmentReference, timestampOffset: number,
      appendWindowStart: number, appendWindowEnd: number): SegmentReference[] {
    const references = [];
    const getUris = () => uris;
    const parser = cuesElement.createParser();
    let lastTime = null;
    let lastOffset = null;
    while (parser.hasMoreData()) {
      const elem = parser.parseElement();
      if (elem.id != CUE_POINT_ID) {
        continue;
      }
      const tuple = WebmSegmentIndexParser.parseCuePoint_(elem);
      if (!tuple) {
        continue;
      }

      // Subtract the presentation time offset from the unscaled time
      const currentTime = timecodeScale * tuple.unscaledTime;
      const currentOffset = segmentOffset + tuple.relativeOffset;
      if (lastTime != null) {
        asserts.assert(lastOffset != null, 'last offset cannot be null');
        references.push(new SegmentReference(
            lastTime + timestampOffset, currentTime + timestampOffset, getUris,
            /* startByte= */
            lastOffset,
            /* endByte= */
            currentOffset - 1, initSegmentReference, timestampOffset,
            appendWindowStart, appendWindowEnd));
      }
      lastTime = currentTime;
      lastOffset = currentOffset;
    }
    if (lastTime != null) {
      asserts.assert(lastOffset != null, 'last offset cannot be null');
      references.push(new SegmentReference(
          lastTime + timestampOffset, duration + timestampOffset, getUris,
          /* startByte= */
          lastOffset,
          /* endByte= */
          null, initSegmentReference, timestampOffset, appendWindowStart,
          appendWindowEnd));
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
  private static parseCuePoint_(cuePointElement: EbmlElement):
      {unscaledTime: number, relativeOffset: number} {
    const parser = cuePointElement.createParser();

    // Parse CueTime element.
    const cueTimeElement = parser.parseElement();
    if (cueTimeElement.id != CUE_TIME_ID) {
      log.warning('Not a CueTime element.');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.WEBM_CUE_TIME_ELEMENT_MISSING);
    }
    const unscaledTime = cueTimeElement.getUint();

    // Parse CueTrackPositions element.
    const cueTrackPositionsElement = parser.parseElement();
    if (cueTrackPositionsElement.id != CUE_TRACK_POSITIONS_ID) {
      log.warning('Not a CueTrackPositions element.');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.WEBM_CUE_TRACK_POSITIONS_ELEMENT_MISSING);
    }
    const cueTrackParser = cueTrackPositionsElement.createParser();
    let relativeOffset = 0;
    while (cueTrackParser.hasMoreData()) {
      const elem = cueTrackParser.parseElement();
      if (elem.id != CUE_CLUSTER_POSITION) {
        continue;
      }
      relativeOffset = elem.getUint();
      break;
    }
    return {unscaledTime: unscaledTime, relativeOffset: relativeOffset};
  }
}

export const EBML_ID: number = 440786851;

export const SEGMENT_ID: number = 408125543;

export const INFO_ID: number = 357149030;

export const TIMECODE_SCALE_ID: number = 2807729;

export const DURATION_ID: number = 17545;

export const CUES_ID: number = 475249515;

export const CUE_POINT_ID: number = 187;

export const CUE_TIME_ID: number = 179;

export const CUE_TRACK_POSITIONS_ID: number = 183;

export const CUE_CLUSTER_POSITION: number = 241;
