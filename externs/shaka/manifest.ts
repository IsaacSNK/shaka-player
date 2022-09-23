/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PresentationTimeline } from "../../lib/media/presentation_timeline";
import { SegmentIndex } from "../../lib/media/segment_index";
import { StreamDB } from "./offline";

export interface Manifest {
  presentationTimeline: PresentationTimeline;
  variants: Variant[];
  textStreams:  Stream[];
  imageStreams: Stream[];
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
  initData: InitDataOverride[];
  keyIds: Set<string>;
}

export interface Variant {
  id: number;
  language: string;
  disabledUntilTime: number;
  primary: boolean;
  audio: Stream|null;
  video: Stream|null;
  bandwidth: number;
  allowedByApplication: boolean;
  allowedByKeySystem: boolean;
  decodingInfos: MediaCapabilitiesDecodingInfo[];
}
type CreateSegmentIndexFunction = () => Promise<any>;

export interface HlsAes128Key {
  method: string;
  //@ts-ignore
  cryptoKey: webCrypto.CryptoKey|undefined;
  fetchKey: CreateSegmentIndexFunction|undefined;
  iv: Uint8Array|undefined;
  firstMediaSequenceNumber: number;
}
type FetchCryptoKeysFunction = () => Promise<any>;

export interface Stream {
  id: number;
  originalId: string|null;
  createSegmentIndex: CreateSegmentIndexFunction;
  closeSegmentIndex: (() => any)|undefined;
  segmentIndex: SegmentIndex;
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
  drmInfos: DrmInfo[];
  keyIds: Set<string>;
  language: string;
  label: string|null;
  type: string;
  primary: boolean;
  trickModeVideo: Stream|null;
  emsgSchemeIdUris: string[]|null;
  roles: string[];
  forced: boolean;
  channelsCount: number|null;
  audioSamplingRate: number|null;
  spatialAudio: boolean;
  closedCaptions: Map<string, string>;
  tilesLayout: string|undefined;
  matchedStreams: Stream[]|StreamDB[]|undefined;
}
