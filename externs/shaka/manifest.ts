/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface Manifest {
  presentationTimeline: shaka.media.PresentationTimeline;
  variants: shaka.extern.Variant[];
  textStreams: shaka.extern.Stream[];
  imageStreams: shaka.extern.Stream[];
  offlineSessionIds: string[];
  minBufferTime: number;
  sequenceMode: boolean;
}

export interface InitDataOverride {
  initData: Uint8Array;
  initDataType: string;
  keyId: string|null;
}

export interface DrmInfo {
  keySystem: string;
  licenseServerUri: string;
  distinctiveIdentifierRequired: boolean;
  persistentStateRequired: boolean;
  audioRobustness: string;
  videoRobustness: string;
  serverCertificate: Uint8Array;
  serverCertificateUri: string;
  sessionType: string;
  initData: shaka.extern.InitDataOverride[];
  keyIds: Set<string>;
}

export interface Variant {
  id: number;
  language: string;
  disabledUntilTime: number;
  primary: boolean;
  audio: shaka.extern.Stream|null;
  video: shaka.extern.Stream|null;
  bandwidth: number;
  allowedByApplication: boolean;
  allowedByKeySystem: boolean;
  decodingInfos: MediaCapabilitiesDecodingInfo[];
}
type CreateSegmentIndexFunction = () => Promise;

export interface HlsAes128Key {
  method: string;
  cryptoKey: webCrypto.CryptoKey|undefined;
  fetchKey: shaka.extern.CreateSegmentIndexFunction|undefined;
  iv: Uint8Array|undefined;
  firstMediaSequenceNumber: number;
}
type FetchCryptoKeysFunction = () => Promise;

export interface Stream {
  id: number;
  originalId: string|null;
  createSegmentIndex: shaka.extern.CreateSegmentIndexFunction;
  closeSegmentIndex: (() => any)|undefined;
  segmentIndex: shaka.media.SegmentIndex;
  mimeType: string;
  codecs: string;
  frameRate: number|undefined;
  pixelAspectRatio: string|undefined;
  hdr: string|undefined;
  bandwidth: number|undefined;
  width: number|undefined;
  height: number|undefined;
  kind: string|undefined;
  encrypted: boolean;
  drmInfos: shaka.extern.DrmInfo[];
  keyIds: Set<string>;
  language: string;
  label: string|null;
  type: string;
  primary: boolean;
  trickModeVideo: shaka.extern.Stream|null;
  emsgSchemeIdUris: string[]|null;
  roles: string[];
  forced: boolean;
  channelsCount: number|null;
  audioSamplingRate: number|null;
  spatialAudio: boolean;
  closedCaptions: Map<string, string>;
  tilesLayout: string|undefined;
  matchedStreams: shaka.extern.Stream[]|shaka.extern.StreamDB[]|undefined;
}
