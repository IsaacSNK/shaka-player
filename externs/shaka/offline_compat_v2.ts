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
  export interface ManifestDBV2 {
    originalManifestUri: string;
    duration: number;
    size: number;
    expiration: number;
    periods: shaka.extern.PeriodDBV2[];
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
  export interface PeriodDBV2 {
    startTime: number;
    streams: shaka.extern.StreamDBV2[];
  }
}
/**
 *  variantIds
 *   An array of ids of variants the stream is a part of.
 */
declare namespace shaka.extern {
  export interface StreamDBV2 {
    id: number;
    originalId: string | null;
    primary: boolean;
    presentationTimeOffset: number;
    contentType: string;
    mimeType: string;
    codecs: string;
    frameRate: number | undefined;
    pixelAspectRatio: string | undefined;
    kind: string | undefined;
    language: string;
    label: string | null;
    width: number | null;
    height: number | null;
    initSegmentKey: number | null;
    encrypted: boolean;
    keyId: string | null;
    segments: shaka.extern.SegmentDBV2[];
    variantIds: number[];
  }
}
/**
 *  dataKey
 *   The key to the data in storage.
 */
declare namespace shaka.extern {
  export interface SegmentDBV2 {
    startTime: number;
    endTime: number;
    dataKey: number;
  }
}
/**
 *  data
 *   The data contents of the segment.
 */
declare namespace shaka.extern {
  export interface SegmentDataDBV2 {
    data: ArrayBuffer;
  }
}
