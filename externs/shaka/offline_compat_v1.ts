/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface ManifestDBV1 {
  key: number;
  originalManifestUri: string;
  duration: number;
  size: number;
  expiration: number;
  periods: shaka.extern.PeriodDBV1[];
  sessionIds: string[];
  drmInfo: shaka.extern.DrmInfo|null;
  appMetadata: Object;
}

export interface PeriodDBV1 {
  startTime: number;
  streams: shaka.extern.StreamDBV1[];
}

export interface StreamDBV1 {
  id: number;
  primary: boolean;
  presentationTimeOffset: number;
  contentType: string;
  mimeType: string;
  codecs: string;
  frameRate: number|undefined;
  kind: string|undefined;
  language: string;
  label: string|null;
  width: number|null;
  height: number|null;
  initSegmentUri: string|null;
  encrypted: boolean;
  keyId: string|null;
  segments: shaka.extern.SegmentDBV1[];
  variantIds: number[];
}

export interface SegmentDBV1 {
  startTime: number;
  endTime: number;
  uri: string;
}

export interface SegmentDataDBV1 {
  key: number;
  data: ArrayBuffer;
}
