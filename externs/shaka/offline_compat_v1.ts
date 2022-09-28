/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  appMetadata
 *   A metadata object passed from the application.
 */
declare namespace shaka.extern {
  export interface ManifestDBV1 {
    key: number;
    originalManifestUri: string;
    duration: number;
    size: number;
    expiration: number;
    periods: shaka.extern.PeriodDBV1[];
    sessionIds: string[];
    drmInfo: shaka.extern.DrmInfo | null;
    appMetadata: Object;
  }
}
/**
 *  streams
 *   The streams that define the Period.
 */
declare namespace shaka.extern {
  export interface PeriodDBV1 {
    startTime: number;
    streams: shaka.extern.StreamDBV1[];
  }
}
/**
 *  variantIds
 *   An array of ids of variants the stream is a part of.
 */
declare namespace shaka.extern {
  export interface StreamDBV1 {
    id: number;
    primary: boolean;
    presentationTimeOffset: number;
    contentType: string;
    mimeType: string;
    codecs: string;
    frameRate: number | undefined;
    kind: string | undefined;
    language: string;
    label: string | null;
    width: number | null;
    height: number | null;
    initSegmentUri: string | null;
    encrypted: boolean;
    keyId: string | null;
    segments: shaka.extern.SegmentDBV1[];
    variantIds: number[];
  }
}
/**
 *  uri
 *   The offline URI of the segment.
 */
declare namespace shaka.extern {
  export interface SegmentDBV1 {
    startTime: number;
    endTime: number;
    uri: string;
  }
}
/**
 *  data
 *   The data contents of the segment.
 */
declare namespace shaka.extern {
  export interface SegmentDataDBV1 {
    key: number;
    data: ArrayBuffer;
  }
}
