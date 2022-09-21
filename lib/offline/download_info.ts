/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as SegmentReferenceExports from './media___segment_reference';
import {InitSegmentReference, SegmentReference} from './media___segment_reference';
import {Networking} from './util___networking';

/**
 * An object that represents a single segment, that the storage system will soon
 * download, but has not yet started downloading.
 */
export class DownloadInfo {
  constructor(
      public ref: SegmentReference|InitSegmentReference,
      public estimateId: number, public groupId: number,
      public isInitSegment: boolean) {}

  /**
   * Creates an ID that encapsulates all important information in the ref, which
   * can then be used to check for equality.
   */
  static idForSegmentRef(ref: SegmentReference|InitSegmentReference): string {
    // Escape the URIs using encodeURI, to make sure that a weirdly formed URI
    // cannot cause two unrelated refs to be considered equivalent.
    return ref.getUris().map((uri) => '{' + encodeURI(uri) + '}').join('') +
        ':' + ref.startByte + ':' + ref.endByte;
  }

  getRefId(): string {
    return DownloadInfo.idForSegmentRef(this.ref);
  }

  makeSegmentRequest(config: shaka.extern.PlayerConfiguration):
      shaka.extern.Request {
    return Networking.createSegmentRequest(
        this.ref.getUris(), this.ref.startByte, this.ref.endByte,
        config.streaming.retryParameters);
  }
}
