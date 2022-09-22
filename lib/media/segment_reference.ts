/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {ArrayUtils} from './dev-workspace.shaka-player-fork.lib.util.array_utils';

/**
 * Creates an InitSegmentReference, which provides the location to an
 * initialization segment.
 *
 * @export
 */
export class InitSegmentReference {
  getUris: () => string[];
  mediaQuality: shaka.extern.MediaQualityInfo|null;
  timescale: number|undefined;

  /**
   * @param uris A function that creates the URIs
   *   of the resource containing the segment.
   * @param startByte The offset from the start of the resource to the
   *   start of the segment.
   * @param endByte The offset from the start of the resource
   *   to the end of the segment, inclusive.  A value of null indicates that the
   *   segment extends to the end of the resource.
   * @param mediaQuality Information about
   *   the quality of the media associated with this init segment.
   */
  constructor(
      uris: () => string[], public readonly startByte: number,
      public readonly endByte: number|null,
      mediaQuality: null|shaka.extern.MediaQualityInfo = null,
      timescale?: number) {
    this.getUris = uris;
    this.mediaQuality = mediaQuality;
    this.timescale = timescale;
  }

  /**
   * Returns the offset from the start of the resource to the
   * start of the segment.
   *
   * @export
   */
  getStartByte(): number {
    return this.startByte;
  }

  /**
   * Returns the offset from the start of the resource to the end of the
   * segment, inclusive.  A value of null indicates that the segment extends
   * to the end of the resource.
   *
   * @export
   */
  getEndByte(): number|null {
    return this.endByte;
  }

  /**
   * Returns the size of the init segment.
   */
  getSize(): number|null {
    if (this.endByte) {
      return this.endByte - this.startByte;
    } else {
      return null;
    }
  }

  /**
   * Returns media quality information for the segments associated with
   * this init segment.
   *
   */
  getMediaQuality(): shaka.extern.MediaQualityInfo|null {
    return this.mediaQuality;
  }

  /**
   * Check if two initSegmentReference have all the same values.
   */
  static equal(
      reference1: InitSegmentReference|null,
      reference2: InitSegmentReference|null): boolean {
    const ArrayUtils = ArrayUtils;
    if (!reference1 || !reference2) {
      return reference1 == reference2;
    } else {
      return reference1.getStartByte() == reference2.getStartByte() &&
          reference1.getEndByte() == reference2.getEndByte() &&
          ArrayUtils.equal(reference1.getUris(), reference2.getUris());
    }
  }
}

/**
 * SegmentReference provides the start time, end time, and location to a media
 * segment.
 *
 * @export
 */
export class SegmentReference {
  /**
   * The "true" end time of the segment, without considering the period end
   * time.  This is necessary for thumbnail segments, where timing requires us
   * to know the original segment duration as described in the manifest.
   */
  trueEndTime: number;
  getUrisInner: () => string[];
  status: any;

  /**
   * @param startTime The segment's start time in seconds.
   * @param endTime The segment's end time in seconds.  The segment
   *   ends the instant before this time, so |endTime| must be strictly greater
   *   than |startTime|.
   *   A function that creates the URIs of the resource containing the segment.
   * @param startByte The offset from the start of the resource to the
   *   start of the segment.
   * @param endByte The offset from the start of the resource to the
   *   end of the segment, inclusive.  A value of null indicates that the
   *   segment extends to the end of the resource.
   *   The segment's initialization segment metadata, or null if the segments
   *   are self-initializing.
   *   The amount of time, in seconds, that must be added to the segment's
   *   internal timestamps to align it to the presentation timeline.
   *   <br>
   *   For DASH, this value should equal the Period start time minus the first
   *   presentation timestamp of the first frame/sample in the Period.  For
   *   example, for MP4 based streams, this value should equal Period start
   *   minus the first segment's tfdt box's 'baseMediaDecodeTime' field (after
   *   it has been converted to seconds).
   *   <br>
   *   For HLS, this value should be 0 to keep the presentation time at the most
   *   recent discontinuity minus the corresponding media time.
   *   The start of the append window for this reference, relative to the
   *   presentation.  Any content from before this time will be removed by
   *   MediaSource.
   *   The end of the append window for this reference, relative to the
   *   presentation.  Any content from after this time will be removed by
   *   MediaSource.
   *   A list of SegmentReferences for the partial segments.
   *   The value is a grid-item-dimension consisting of two positive decimal
   *   integers in the format: column-x-row ('4x3'). It describes the
   *   arrangement of Images in a Grid. The minimum valid LAYOUT is '1x1'.
   *  The explicit duration of an individual tile within the tiles grid.
   *  If not provided, the duration should be automatically calculated based on
   *  the duration of the reference.
   *  A time value, expressed in seconds since 1970, which is used to
   *  synchronize between streams.  Both produced and consumed by the HLS
   *  parser.  Other components should not need this value.
   *  The segment status is used to indicate that a segment does not exist or is
   *  not available.
   *  The segment's AES-128-CBC full segment encryption key and iv.
   */
  constructor(
      public startTime: number, public endTime: number, uris: () => string[],
      public readonly startByte: number, public readonly endByte: number|null,
      public initSegmentReference: InitSegmentReference,
      public timestampOffset: number, public appendWindowStart: number,
      public appendWindowEnd: number,
      public partialReferences: SegmentReference[] = [],
      public tilesLayout: string|null = '',
      public tileDuration: number|null = null,
      public syncTime: number|null = null,
      public status: Status = Status.AVAILABLE,
      public hlsAes128Key: shaka.extern.HlsAes128Key|null = null) {
    // A preload hinted Partial Segment has the same startTime and endTime.
    asserts.assert(
        startTime <= endTime,
        'startTime must be less than or equal to endTime');
    asserts.assert(
        endByte == null || startByte < endByte, 'startByte must be < endByte');
    this.trueEndTime = endTime;
    this.getUrisInner = uris;
  }

  /**
   * Creates and returns the URIs of the resource containing the segment.
   *
   * @export
   */
  getUris(): string[] {
    return this.getUrisInner();
  }

  /**
   * Returns the segment's start time in seconds.
   *
   * @export
   */
  getStartTime(): number {
    return this.startTime;
  }

  /**
   * Returns the segment's end time in seconds.
   *
   * @export
   */
  getEndTime(): number {
    return this.endTime;
  }

  /**
   * Returns the offset from the start of the resource to the
   * start of the segment.
   *
   * @export
   */
  getStartByte(): number {
    return this.startByte;
  }

  /**
   * Returns the offset from the start of the resource to the end of the
   * segment, inclusive.  A value of null indicates that the segment extends to
   * the end of the resource.
   *
   * @export
   */
  getEndByte(): number|null {
    return this.endByte;
  }

  /**
   * Returns the size of the segment.
   */
  getSize(): number|null {
    if (this.endByte) {
      return this.endByte - this.startByte;
    } else {
      return null;
    }
  }

  /**
   * Returns true if it contains partial SegmentReferences.
   */
  hasPartialSegments(): boolean {
    return this.partialReferences.length > 0;
  }

  /**
   * Returns the segment's tiles layout. Only defined in image segments.
   *
   * @export
   */
  getTilesLayout(): string|null {
    return this.tilesLayout;
  }

  /**
   * Returns the segment's explicit tile duration.
   * Only defined in image segments.
   *
   * @export
   */
  getTileDuration(): number|null {
    return this.tileDuration;
  }

  /**
   * Returns the segment's status.
   *
   * @export
   */
  getStatus(): Status {
    return this.status;
  }

  /**
   * Mark the reference as unavailable.
   *
   * @export
   */
  markAsUnavailable() {
    this.status = Status.UNAVAILABLE;
  }
}

/**
 * Rather than using booleans to communicate what the state of the reference,
 * we have this enum.
 *
 * @export
 */
export enum Status {
  AVAILABLE,
  UNAVAILABLE,
  MISSING
}
type AnySegmentReference = InitSegmentReference|SegmentReference;
