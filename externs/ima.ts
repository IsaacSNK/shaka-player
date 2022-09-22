/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for IMA SDK.
 *
 */
const google = {};
google.ima = {};
google.ima.settings;
google.ima.AdsLoader = class implements EventTarget {
  constructor(container: google.ima.AdDisplayContainer) {}

  contentComplete() {}

  requestAds(request: google.ima.AdsRequest) {}

  getSettings(): google.ima.ImaSdkSettings {}

  /** @override */
  addEventListener() {}

  /** @override */
  removeEventListener() {}

  /** @override */
  dispatchEvent() {}

  destroy() {}
};
google.ima.AdsManager = class implements EventTarget {
  start() {}

  init(width: number, height: number, viewMode: google.ima.ViewMode) {}

  getRemainingTime(): number {}

  pause() {}

  resume() {}

  getVolume() {}

  getAdSkippableState(): boolean {}

  skip() {}

  stop() {}

  destroy() {}

  setVolume(volume: number) {}

  resize(width: number, height: number, viewMode: google.ima.ViewMode) {}

  getCuePoints(): number[] {}

  /** @override */
  addEventListener() {}

  /** @override */
  removeEventListener() {}

  /** @override */
  dispatchEvent() {}
};
google.ima.AdsManagerLoadedEvent = class extends Event {
  getAdsManager(video: HTMLElement): google.ima.AdsManager {}
};
google.ima.AdDisplayContainer = class {
  constructor(adContainer: HTMLElement, video: HTMLMediaElement) {}

  initialize() {}
};
google.ima.AdsManagerLoadedEvent.Type = {
  ADS_MANAGER_LOADED: 'ADS_MANAGER_LOADED'
};
google.ima.AdEvent = class extends Event {
  getAd(): google.ima.Ad|null {}
};
google.ima.Ad = class {
  getDuration(): number {}

  getMinSuggestedDuration(): number {}

  getSkipTimeOffset(): number {}

  getAdPodInfo(): google.ima.AdPodInfo {}

  getAdvertiserName(): string {}

  isLinear(): boolean {}
};
google.ima.AdPodInfo = class {
  getAdPosition(): number {}

  getTotalAds(): number {}
};
google.ima.ImaSdkSettings = class {
  setLocale(locale: string) {}

  setPlayerType(player: string) {}

  setPlayerVersion(version: string) {}

  setVpaidMode(vpaidMode: google.ima.ImaSdkSettings.VpaidMode) {}
};
google.ima.ImaSdkSettings.VpaidMode = {
  DISABLED: 0,
  ENABLED: 1,
  INSECURE: 2
};
google.ima.AdEvent.Type = {
  CONTENT_PAUSE_REQUESTED: 'CONTENT_PAUSE_REQUESTED',
  CONTENT_RESUME_REQUESTED: 'CONTENT_RESUME_REQUESTED',
  AD_ERROR: 'AD_ERROR',
  PAUSED: 'PAUSED',
  RESUMED: 'RESUMED',
  VOLUME_CHANGED: 'VOLUME_CHANGED',
  VOLUME_MUTED: 'VOLUME_MUTED',
  SKIPPABLE_STATE_CHANGED: 'SKIPPABLE_STATE_CHANGED',
  STARTED: 'STARTED',
  FIRST_QUARTILE: 'FIRST_QUARTILE',
  MIDPOINT: 'MIDPOINT',
  THIRD_QUARTILE: 'THIRD_QUARTILE',
  COMPLETE: 'COMPLETE',
  ALL_ADS_COMPLETED: 'ALL_ADS_COMPLETED',
  SKIPPED: 'SKIPPED',
  INTERACTION: 'INTERACTION',
  LOG: 'LOG',
  AD_BREAK_READY: 'AD_BREAK_READY',
  AD_METADATA: 'AD_METADATA',
  LINEAR_CHANGED: 'LINEAR_CHANGED',
  LOADED: 'LOADED',
  USER_CLOSE: 'USER_CLOSE',
  DURATION_CHANGE: 'DURATION_CHANGE',
  IMPRESSION: 'IMPRESSION',
  AD_BUFFERING: 'AD_BUFFERING',
  AD_PROGRESS: 'AD_PROGRESS',
  CLICK: 'CLICK'
};

export interface AdsRequest {
  adsResponse: string|undefined;
  adTagUrl: string|undefined;
}
google.ima.AdError = class {};
google.ima.AdErrorEvent = class extends Event {
  getError(): google.ima.AdError {}
};
google.ima.AdErrorEvent.Type = {
  AD_ERROR: 'AD_ERROR'
};
google.ima.ViewMode = {
  FULLSCREEN: 'FULLSCREEN',
  NORMAL: 'NORMAL'
};
google.ima.dai = {};
google.ima.dai.api = {};
google.ima.dai.api.StreamManager = class implements EventTarget {
  constructor(
      videoElement: HTMLMediaElement,
      adUiElement: HTMLElement|undefined = undefined,
      uiSettings: google.ima.dai.api.UiSettings|undefined = undefined) {}

  contentTimeForStreamTime(streamTime: number) {}

  onTimedMetadata(metadata: Object) {}

  /**
   * @param clickElement the element used as the ad click through.
   */
  setClickElement(clickElement: Element|null) {}

  previousCuePointForStreamTime(streamTime: number) {}

  processMetadata(type: string, data: Uint8Array|string, timestamp: number) {}

  replaceAdTagParameters(adTagParameters: Object) {}

  requestStream(streamRequest: google.ima.dai.api.StreamRequest) {}

  reset() {}

  streamTimeForContentTime(contentTime: number) {}

  /**
   * @override
   */
  addEventListener(
      type: string|Array, handler: Function|Object,
      capture?: boolean|AddEventListenerOptions, handlerScope?: Object) {}

  /** @override */
  removeEventListener() {}

  /** @override */
  dispatchEvent() {}
};
google.ima.dai.api.UiSettings = class {
  getLocale(): number {}

  setLocale(locale: string) {}
};
google.ima.dai.api.Ad = class {
  getDuration(): number {}

  getSkipTimeOffset(): number {}

  getAdPodInfo(): google.ima.AdPodInfo {}

  getAdvertiserName(): string {}

  isSkippable(): boolean {}
};
google.ima.dai.api.AdPodInfo = class {
  getAdPosition(): number {}

  getTotalAds(): number {}
};
google.ima.dai.api.CuePoint = class {
  start: number;
  end: number;
  played: boolean;
};
google.ima.dai.api.AdProgressData = class {
  currentTime: number;
  duration: number;
  url: number;
  totalAds: number;
  adPosition: number;
};
google.ima.dai.api.StreamData = class {
  adProgressData: google.ima.dai.api.AdProgressData;
  url: string;
  cuepoints: google.ima.dai.api.CuePoint[];
  errorMessage: string;
  streamId: string;
  subtitles: {url: string, language: string, language_name: string}[]|null;
};
google.ima.dai.api.StreamEvent = class extends Event {
  getAd(): google.ima.dai.api.Ad {}

  getStreamData(): google.ima.dai.api.StreamData {}
};
google.ima.dai.api.StreamRequest = class {
  adTagParameters: Object;
  apiKey: string;
  authToken: string;
  streamActivityMonitorId: string;
  format: string|null;
};
google.ima.dai.api.VODStreamRequest =
    class extends google.ima.dai.api.StreamRequest {
  adTagParameters: Object;
  apiKey: string;
  authToken: string;
  contentSourceId: string;
  streamActivityMonitorId: string;
  videoId: string;
};
google.ima.dai.api.LiveStreamRequest =
    class extends google.ima.dai.api.StreamRequest {
  adTagParameters: Object;
  apiKey: string;
  assetKey: string;
  authToken: string;
  streamActivityMonitorId: string;
};
google.ima.dai.api.StreamEvent.Type = {
  LOADED: 'loaded',
  AD_BREAK_STARTED: 'adBreakStarted',
  AD_BREAK_ENDED: 'adBreakEnded',
  AD_PERIOD_STARTED: 'adPeriodStarted',
  AD_PERIOD_ENDED: 'adPeriodEnded',
  AD_PROGRESS: 'adProgress',
  CUEPOINTS_CHANGED: 'cuepointsChanged',
  CLICK: 'click',
  ERROR: 'error',
  STARTED: 'started',
  FIRST_QUARTILE: 'firstquartile',
  MIDPOINT: 'midpoint',
  STREAM_INITIALIZED: 'streamInitialized',
  THIRD_QUARTILE: 'thirdquartile',
  COMPLETE: 'complete',
  SKIPPABLE_STATE_CHANGED: 'skippableStateChanged',
  SKIPPED: 'skip',
  VIDEO_CLICKED: 'videoClicked'
};
