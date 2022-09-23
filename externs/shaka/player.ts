/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AutoShowText } from "../../lib/config/auto_show_text";
import { ShakaError } from "../../lib/util/error";
import { Factory } from "./abr_manager";
import { DrmInfo } from "./manifest";
import { RetryParameters } from "./net";
import { StoredContent } from "./offline";

export interface TrackChoice {
  timestamp: number;
  id: number;
  type: string;
  fromAdaptation: boolean;
  bandwidth: number|null;
}

export interface StateChange {
  timestamp: number;
  state: string;
  duration: number;
}

export interface Stats {
  width: number;
  height: number;
  streamBandwidth: number;
  decodedFrames: number;
  droppedFrames: number;
  corruptedFrames: number;
  estimatedBandwidth: number;
  completionPercent: number;
  loadLatency: number;
  manifestTimeSeconds: number;
  drmTimeSeconds: number;
  playTime: number;
  pauseTime: number;
  bufferingTime: number;
  licenseTime: number;
  liveLatency: number;
  maxSegmentDuration: number;
  gapsJumped: number;
  stallsDetected: number;
  switchHistory: TrackChoice[];
  stateHistory: StateChange[];
}

export interface BufferedRange {
  start: number;
  end: number;
}

export interface BufferedInfo {
  total: BufferedRange[];
  audio: BufferedRange[];
  video: BufferedRange[];
  text: BufferedRange[];
}

export interface Track {
  id: number;
  active: boolean;
  type: string;
  bandwidth: number;
  language: string;
  label: string|null;
  kind: string|null;
  width: number|null;
  height: number|null;
  frameRate: number|null;
  pixelAspectRatio: string|null;
  hdr: string|null;
  mimeType: string|null;
  audioMimeType: string|null;
  videoMimeType: string|null;
  codecs: string|null;
  audioCodec: string|null;
  videoCodec: string|null;
  primary: boolean;
  roles: string[];
  audioRoles: string[];
  forced: boolean;
  videoId: number|null;
  audioId: number|null;
  channelsCount: number|null;
  audioSamplingRate: number|null;
  tilesLayout: string|null;
  audioBandwidth: number|null;
  videoBandwidth: number|null;
  spatialAudio: boolean;
  originalVideoId: string|null;
  originalAudioId: string|null;
  originalTextId: string|null;
  originalImageId: string|null;
}
type TrackList = Track[];

export interface Restrictions {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  minPixels: number;
  maxPixels: number;
  minFrameRate: number;
  maxFrameRate: number;
  minBandwidth: number;
  maxBandwidth: number;
}

export interface DrmSupportType {
  persistentState: boolean;
}

export interface SupportType {
  manifest: {[key: string]: boolean};
  media: {[key: string]: boolean};
  drm: {[key: string]: DrmSupportType|null};
}
export type ID3Metadata = {
  [key: string]: any
};

export interface TimelineRegionInfo {
  schemeIdUri: string;
  value: string;
  startTime: number;
  endTime: number;
  id: string;
  eventElement: Element;
}

export interface MediaQualityInfo {
  audioSamplingRate: number|null;
  bandwidth: number;
  codecs: string;
  contentType: string;
  frameRate: number|null;
  height: number|null;
  mimeType: string|null;
  channelsCount: number|null;
  pixelAspectRatio: string|null;
  width: number|null;
}

export interface EmsgInfo {
  schemeIdUri: string;
  value: string;
  startTime: number;
  endTime: number;
  timescale: number;
  presentationTimeDelta: number;
  eventDuration: number;
  id: number;
  messageData: Uint8Array;
}

export interface ProducerReferenceTime {
  wallClockTime: number;
  programStartDate: Date;
}

export interface AdvancedDrmConfiguration {
  distinctiveIdentifierRequired: boolean;
  persistentStateRequired: boolean;
  videoRobustness: string;
  audioRobustness: string;
  serverCertificate: Uint8Array;
  serverCertificateUri: string;
  individualizationServer: string;
  sessionType: string;
}

export interface DrmConfiguration {
  retryParameters: RetryParameters;
  servers: {[key: string]: string};
  clearKeys: {[key: string]: string};
  delayLicenseRequestUntilPlayed: boolean;
  advanced: {[key: string]: AdvancedDrmConfiguration};
  initDataTransform:
      ((p1: Uint8Array, p2: string,
        p3: DrmInfo|null) => Uint8Array)|undefined;
  logLicenseExchange: boolean;
  updateExpirationTime: number;
  preferredKeySystems: string[];
  keySystemsMapping: {[key: string]: string};
}

export interface DashManifestConfiguration {
  clockSyncUri: string;
  ignoreDrmInfo: boolean;
  disableXlinkProcessing: boolean;
  xlinkFailGracefully: boolean;
  ignoreMinBufferTime: boolean;
  autoCorrectDrift: boolean;
  initialSegmentLimit: number;
  ignoreSuggestedPresentationDelay: boolean;
  ignoreEmptyAdaptationSet: boolean;
  ignoreMaxSegmentDuration: boolean;
  keySystemsByURI: {[key: string]: string};
  manifestPreprocessor: (p1: Element) => any;
}

export interface HlsManifestConfiguration {
  ignoreTextStreamFailures: boolean;
  ignoreImageStreamFailures: boolean;
  defaultAudioCodec: string;
  defaultVideoCodec: string;
  ignoreManifestProgramDateTime: boolean;
  mediaPlaylistFullMimeType: string;
}

export interface ManifestConfiguration {
  retryParameters: RetryParameters;
  availabilityWindowOverride: number;
  disableAudio: boolean;
  disableVideo: boolean;
  disableText: boolean;
  disableThumbnails: boolean;
  defaultPresentationDelay: number;
  segmentRelativeVttTiming: boolean;
  dash: DashManifestConfiguration;
  hls: HlsManifestConfiguration;
}

export interface StreamingConfiguration {
  retryParameters: RetryParameters;
  failureCallback: (p1: ShakaError) => any;
  rebufferingGoal: number;
  bufferingGoal: number;
  bufferBehind: number;
  ignoreTextStreamFailures: boolean;
  alwaysStreamText: boolean;
  startAtSegmentBoundary: boolean;
  gapDetectionThreshold: number;
  durationBackoff: number;
  forceTransmuxTS: boolean;
  safeSeekOffset: number;
  stallEnabled: boolean;
  stallThreshold: number;
  stallSkip: number;
  useNativeHlsOnSafari: boolean;
  inaccurateManifestTolerance: number;
  lowLatencyMode: boolean;
  autoLowLatencyMode: boolean;
  forceHTTPS: boolean;
  preferNativeHls: boolean;
  updateIntervalSeconds: number;
  dispatchAllEmsgBoxes: boolean;
  observeQualityChanges: boolean;
  maxDisabledTime: number;
  parsePrftBox: boolean;
}

export interface AbrConfiguration {
  enabled: boolean;
  useNetworkInformation: boolean;
  defaultBandwidthEstimate: number;
  restrictions: Restrictions;
  switchInterval: number;
  bandwidthUpgradeTarget: number;
  bandwidthDowngradeTarget: number;
  advanced: AdvancedAbrConfiguration;
  restrictToElementSize: boolean;
  ignoreDevicePixelRatio: boolean;
}

export interface AdvancedAbrConfiguration {
  minTotalBytes: number;
  minBytes: number;
  fastHalfLife: number;
  slowHalfLife: number;
}

export interface CmcdConfiguration {
  enabled: boolean;
  useHeaders: boolean;
  sessionId: string;
  contentId: string;
}

export interface OfflineConfiguration {
  trackSelectionCallback:
      (p1: TrackList) => Promise<TrackList>;
  downloadSizeCallback: (p1: number) => Promise<boolean>;
  progressCallback: (p1: StoredContent, p2: number) => any;
  usePersistentLicense: boolean;
  numberOfParallelDownloads: number;
}

export interface PlayerConfiguration {
  autoShowText: AutoShowText;
  drm: DrmConfiguration;
  manifest: ManifestConfiguration;
  streaming: StreamingConfiguration;
  abrFactory: Factory;
  abr: AbrConfiguration;
  cmcd: CmcdConfiguration;
  offline: OfflineConfiguration;
  preferredAudioLanguage: string;
  preferredTextLanguage: string;
  preferredVariantRole: string;
  preferredTextRole: string;
  preferredVideoCodecs: string[];
  preferredAudioCodecs: string[];
  preferredAudioChannelCount: number;
  preferredDecodingAttributes: string[];
  preferForcedSubs: boolean;
  restrictions: Restrictions;
  playRangeStart: number;
  playRangeEnd: number;
  textDisplayFactory: Factory;
}

export interface LanguageRole {
  language: string;
  role: string;
  label: string|null;
}

export interface Thumbnail {
  imageHeight: number;
  imageWidth: number;
  height: number;
  positionX: number;
  positionY: number;
  startTime: number;
  duration: number;
  uris: string[];
  width: number;
}

export interface Chapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
}
