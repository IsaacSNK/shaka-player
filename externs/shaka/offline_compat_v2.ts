/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmInfo } from "./manifest";

export interface ManifestDBV2 {
  originalManifestUri: string;
  duration: number;
  size: number;
  expiration: number;
  periods: PeriodDBV2[];
  sessionIds: string[];
  drmInfo: DrmInfo|null;
  appMetadata: Object;
}

export interface PeriodDBV2 {
  startTime: number;
  streams: StreamDBV2[];
}

export interface StreamDBV2 {
  id: number;
  originalId: string|null;
  primary: boolean;
  presentationTimeOffset: number;
  contentType: string;
  mimeType: string;
  codecs: string;
  frameRate: number|undefined;
  pixelAspectRatio: string|undefined;
  kind: string|undefined;
  language: string;
  label: string|null;
  width: number|null;
  height: number|null;
  initSegmentKey: number|null;
  encrypted: boolean;
  keyId: string|null;
  segments: SegmentDBV2[];
  variantIds: number[];
}

export interface SegmentDBV2 {
  startTime: number;
  endTime: number;
  dataKey: number;
}

export interface SegmentDataDBV2 {
  data: ArrayBuffer;
}
