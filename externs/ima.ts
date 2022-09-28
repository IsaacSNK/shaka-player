/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for IMA SDK.
 *
 */
declare namespace google.ima {
  class AdsLoader {
    constructor(container: google.ima.AdDisplayContainer);

    contentComplete();

    requestAds(request: google.ima.AdsRequest);

    getSettings(): google.ima.ImaSdkSettings;

    /** @override */
    addEventListener();

    /** @override */
    removeEventListener();

    /** @override */
    dispatchEvent();

    destroy();
  }
}
declare namespace google.ima {
  class AdsManager {
    start();

    init(width: number, height: number, viewMode: google.ima.ViewMode);

    getRemainingTime(): number;

    pause();

    resume();

    getVolume();

    getAdSkippableState(): boolean;

    skip();

    stop();

    destroy();

    setVolume(volume: number);

    resize(width: number, height: number, viewMode: google.ima.ViewMode);

    getCuePoints(): number[];

    /** @override */
    addEventListener();

    /** @override */
    removeEventListener();

    /** @override */
    dispatchEvent();
  }
}
declare namespace google.ima {
  class AdsManagerLoadedEvent extends Event {
    getAdsManager(video: HTMLElement): google.ima.AdsManager;
  }
}
declare namespace google.ima {
  class AdDisplayContainer {
    constructor(adContainer: HTMLElement, video: HTMLMediaElement);

    initialize();
  }
}
declare namespace google.ima.AdsManagerLoadedEvent {
  enum Type {
    ADS_MANAGER_LOADED = "ADS_MANAGER_LOADED",
  }
}

declare namespace google.ima {
  class AdEvent extends Event {
    getAd(): google.ima.Ad | null;
  }
}

declare namespace google.ima {
  class Ad {
    getDuration(): number;

    getMinSuggestedDuration(): number;

    getSkipTimeOffset(): number;

    getAdPodInfo(): google.ima.AdPodInfo;

    getAdvertiserName(): string;

    isLinear(): boolean;
  }
}
declare namespace google.ima {
  class AdPodInfo {
    getAdPosition(): number;

    getTotalAds(): number;
  }
}
declare namespace google.ima {
  class ImaSdkSettings {
    setLocale(locale: string);

    setPlayerType(player: string);

    setPlayerVersion(version: string);

    setVpaidMode(vpaidMode: google.ima.ImaSdkSettings.VpaidMode);
  }
}

declare namespace google.ima.ImaSdkSettings {
  enum VpaidMode {
    DISABLED,
    ENABLED,
    INSECURE,
  }
}

declare namespace google.ima.AdEvent {
  enum Type {
    CONTENT_PAUSE_REQUESTED = "CONTENT_PAUSE_REQUESTED",
    CONTENT_RESUME_REQUESTED = "CONTENT_RESUME_REQUESTED",
    AD_ERROR = "AD_ERROR",
    PAUSED = "PAUSED",
    RESUMED = "RESUMED",
    VOLUME_CHANGED = "VOLUME_CHANGED",
    VOLUME_MUTED = "VOLUME_MUTED",
    SKIPPABLE_STATE_CHANGED = "SKIPPABLE_STATE_CHANGED",
    STARTED = "STARTED",
    FIRST_QUARTILE = "FIRST_QUARTILE",
    MIDPOINT = "MIDPOINT",
    THIRD_QUARTILE = "THIRD_QUARTILE",
    COMPLETE = "COMPLETE",
    ALL_ADS_COMPLETED = "ALL_ADS_COMPLETED",
    SKIPPED = "SKIPPED",
    INTERACTION = "INTERACTION",
    LOG = "LOG",
    AD_BREAK_READY = "AD_BREAK_READY",
    AD_METADATA = "AD_METADATA",
    LINEAR_CHANGED = "LINEAR_CHANGED",
    LOADED = "LOADED",
    USER_CLOSE = "USER_CLOSE",
    DURATION_CHANGE = "DURATION_CHANGE",
    IMPRESSION = "IMPRESSION",
    AD_BUFFERING = "AD_BUFFERING",
    AD_PROGRESS = "AD_PROGRESS",
    CLICK = "CLICK",
  }
}

/**
 *  adsResponse
 *   Specifies a VAST 2.0 document to be used as the ads response instead of
 *   making a request via an ad tag url. This can be useful for debugging
 *   and other situations where a VAST response is already available.
 *   This parameter is optional if adTagUrl is given.
 * @exportDoc
 */
declare namespace google.ima {
  export interface AdsRequest {
    adsResponse: string | undefined;
    adTagUrl: string | undefined;
  }
}
declare namespace google.ima {
  class AdError {}
}
declare namespace google.ima {
  class AdErrorEvent extends Event {
    getError(): google.ima.AdError;
  }

  enum ViewMode {
    FULLSCREEN = "FULLSCREEN",
    NORMAL = "NORMAL",
  }
}

declare namespace google.ima.AddErrorEvent {
  enum Type {
    AD_ERROR = "AD_ERROR",
  }
}

declare namespace google.ima.dai.api {
  class StreamManager {
    constructor(
      videoElement: HTMLMediaElement,
      adUiElement: HTMLElement | undefined,
      uiSettings: google.ima.dai.api.UiSettings | undefined
    );

    contentTimeForStreamTime(streamTime: number);

    onTimedMetadata(metadata: Object);

    /**
     * @param clickElement the element used as the ad click through.
     */
    setClickElement(clickElement: Element | null);

    previousCuePointForStreamTime(streamTime: number);

    processMetadata(type: string, data: Uint8Array | string, timestamp: number);

    replaceAdTagParameters(adTagParameters: Object);

    requestStream(streamRequest: google.ima.dai.api.StreamRequest);

    reset();

    streamTimeForContentTime(contentTime: number);

    /**
     * @override
     */
    addEventListener(
      type: string | Array,
      handler: Function | Object,
      capture?: boolean | AddEventListenerOptions,
      handlerScope?: Object
    );

    /** @override */
    removeEventListener();

    /** @override */
    dispatchEvent();
  }
}
declare namespace google.ima.dai.api {
  class UiSettings {
    getLocale(): number;

    setLocale(locale: string);
  }
}
declare namespace google.ima.dai.api {
  class Ad {
    getDuration(): number;

    getSkipTimeOffset(): number;

    getAdPodInfo(): google.ima.AdPodInfo;

    getAdvertiserName(): string;

    isSkippable(): boolean;
  }
}
declare namespace google.ima.dai.api {
  class AdPodInfo {
    getAdPosition(): number;

    getTotalAds(): number;
  }
}
declare namespace google.ima.dai.api {
  class CuePoint {
    start: number;
    end: number;
    played: boolean;
  }
}

declare namespace google.ima.dai.api {
  class AdProgressData {
    currentTime: number;
    duration: number;
    url: number;
    totalAds: number;
    adPosition: number;
  }
}

declare namespace google.ima.dai.api {
  class StreamData {
    adProgressData: google.ima.dai.api.AdProgressData;
    url: string;
    cuepoints: Array<google.ima.dai.api.CuePoint>;
    errorMessage: string;
    streamId: string;
    subtitles: Array<{url: string, language: string, language_name: string}>;
  }
}

declare namespace google.ima.dai.api {
  class StreamEvent extends Event {
    getAd(): google.ima.dai.api.Ad;

    getStreamData(): google.ima.dai.api.StreamData;
  }
}

declare namespace google.ima.dai.api {
  class StreamRequest {
    adTagParameters: Object;
    apiKey: string;
    authToken: string;
    streamActivityMonitorId: string;
    format: string;
  }
}

declare namespace google.ima.dai.api {
  class VODStreamRequest extends google.ima.dai.api.StreamRequest {
    contentSourceId: string;
    streamActivityMonitorId: string;
    videoId: string;
  }
}

declare namespace google.ima.dai.api {
  class LiveStreamRequest extends google.ima.dai.api.StreamRequest {
    assetKey: string;
  }
}

declare namespace google.ima.dai.api.StreamEvent {
  enum Type {
    LOADED = "loaded",
    AD_BREAK_STARTED = "adBreakStarted",
    AD_BREAK_ENDED = "adBreakEnded",
    AD_PERIOD_STARTED = "adPeriodStarted",
    AD_PERIOD_ENDED = "adPeriodEnded",
    AD_PROGRESS = "adProgress",
    CUEPOINTS_CHANGED = "cuepointsChanged",
    CLICK = "click",
    ERROR = "error",
    STARTED = "started",
    FIRST_QUARTILE = "firstquartile",
    MIDPOINT = "midpoint",
    STREAM_INITIALIZED = "streamInitialized",
    THIRD_QUARTILE = "thirdquartile",
    COMPLETE = "complete",
    SKIPPABLE_STATE_CHANGED = "skippableStateChanged",
    SKIPPED = "skip",
    VIDEO_CLICKED = "videoClicked",
  }
}
