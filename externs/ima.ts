/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for IMA SDK.
 */
declare namespace google.ima {
    let settings: ImaSdkSettings;

    class AdsLoader implements EventTarget {
        constructor(container: AdDisplayContainer);

        contentComplete();

        requestAds(request: AdsRequest);

        getSettings(): ImaSdkSettings;

        /** @override */
        addEventListener();

        /** @override */
        removeEventListener();

        /** @override */
        dispatchEvent(): any;

        destroy();
    }

    class AdsManager implements EventTarget {
        start();

        init(width: number, height: number, viewMode: ViewMode);

        getRemainingTime(): number;

        pause();

        resume();

        getVolume();

        getAdSkippableState(): boolean;

        skip();

        stop();

        destroy();

        setVolume(volume: number);

        resize(width: number, height: number, viewMode: ViewMode);

        getCuePoints(): Array<number>;

        /** @override */
        addEventListener();

        /** @override */
        removeEventListener();

        /** @override */
        dispatchEvent(): any;
    }

    class AdsManagerLoadedEvent extends Event {
        //@ts-ignore
        getAdsManager(video: HTMLElement): AdsManager;
    }

    class AdDisplayContainer {
        constructor(adContainer: HTMLElement, video: HTMLMediaElement);

        initialize();
    }

    interface Ad {
        getDuration(): number;

        getMinSuggestedDuration(): number;

        getSkipTimeOffset(): number;

        getAdPodInfo(): AdPodInfo;

        getAdvertiserName(): string;

        isLinear(): boolean;
    }


    interface AdPodInfo {
        getAdPosition(): number;

        getTotalAds(): number;
    }

    interface ImaSdkSettings {
        setLocale(locale: string);

        setPlayerType(player: string);

        setPlayerVersion(version: string);

        setVpaidMode(vpaidMode: ImaSdkSettings.VpaidMode);
    }

    /**
     * @description Request for the ad server
     * @property adTagUrl
     *   Specifies the ad tag url that is requested from the ad server.
     *   This parameter is optional if adsReponse is given.
     * @property adsResponse
     *   Specifies a VAST 2.0 document to be used as the ads response instead of
     *   making a request via an ad tag url. This can be useful for debugging
     *   and other situations where a VAST response is already available.
     *   This parameter is optional if adTagUrl is given.
     * @Doc
     */
    type AdsRequest = {
        adsResponse?: string,
        adTagUrl?: string;
    }

    class AdError { }


    class AdErrorEvent extends Event {
        //@ts-ignore
        getError(): AdError;
    }

    namespace AdErrorEvent {
        enum Type {
            AD_ERROR = 'adError',
        }
    }

    /**
     * @enum {string}
     */
    const enum ViewMode {
        FULLSCREEN = 'FULLSCREEN',
        NORMAL = 'NORMAL'
    }

    namespace google.ima.AdsManagerLoadedEvent {
        enum Type {
            ADS_MANAGER_LOADED = 'ADS_MANAGER_LOADED',
        }
    }

    namespace ImaSdkSettings {
        const enum VpaidMode {
            DISABLED = 0,
            ENABLED = 1,
            INSECURE = 2,
        }
    }

    namespace AdEvent {
        class AdEvent extends Event {
            getAd(): Ad;
        }

        enum Type {
            CONTENT_PAUSE_REQUESTED = 'CONTENT_PAUSE_REQUESTED',
            CONTENT_RESUME_REQUESTED = 'CONTENT_RESUME_REQUESTED',
            AD_ERROR = 'AD_ERROR',
            PAUSED = 'PAUSED',
            RESUMED = 'RESUMED',
            VOLUME_CHANGED = 'VOLUME_CHANGED',
            VOLUME_MUTED = 'VOLUME_MUTED',
            SKIPPABLE_STATE_CHANGED = 'SKIPPABLE_STATE_CHANGED',
            STARTED = 'STARTED',
            FIRST_QUARTILE = 'FIRST_QUARTILE',
            MIDPOINT = 'MIDPOINT',
            THIRD_QUARTILE = 'THIRD_QUARTILE',
            COMPLETE = 'COMPLETE',
            ALL_ADS_COMPLETED = 'ALL_ADS_COMPLETED',
            SKIPPED = 'SKIPPED',
            INTERACTION = 'INTERACTION',
            LOG = 'LOG',
            AD_BREAK_READY = 'AD_BREAK_READY',
            AD_METADATA = 'AD_METADATA',
            LINEAR_CHANGED = 'LINEAR_CHANGED',
            LOADED = 'LOADED',
            USER_CLOSE = 'USER_CLOSE',
            DURATION_CHANGE = 'DURATION_CHANGE',
            IMPRESSION = 'IMPRESSION',
            AD_BUFFERING = 'AD_BUFFERING',
            AD_PROGRESS = 'AD_PROGRESS',
            CLICK = 'CLICK',
        }
    }

    namespace dai.api {
        export class StreamManager implements EventTarget {
            /**
             * @param {HTMLMediaElement} videoElement
             * @param {HTMLElement=} adUiElement
             * @param {google.ima.dai.api.UiSettings=} uiSettings
             */
            constructor(videoElement: HTMLMediaElement, adUiElement?: HTMLElement, uiSettings?: UiSettings);

            /** @param {number} streamTime */
            contentTimeForStreamTime(streamTime);

            /** @param {Object} metadata */
            onTimedMetadata(metadata);

            /**
             * @param {?Element} clickElement the element used as the ad click through.
             */
            setClickElement(clickElement);


            /** @param {number} streamTime */
            previousCuePointForStreamTime(streamTime);

            /**
             * @param {string} type
             * @param {Uint8Array|string} data
             * @param {number} timestamp
             */
            processMetadata(type, data, timestamp);

            /** @param {Object} adTagParameters */
            replaceAdTagParameters(adTagParameters);

            /** @param {google.ima.dai.api.StreamRequest} streamRequest */
            requestStream(streamRequest);

            reset();

            /** @param {number} contentTime */
            streamTimeForContentTime(contentTime);

            addEventListener(type: string | any[] | null, handler: null | object, capture?: boolean | AddEventListenerOptions, handlerScope?: object | null): any;

            /** @override */
            removeEventListener();

            /** @override */
            dispatchEvent();
        }

        class UiSettings {
            getLocale(): number;

            setLocale(locale: string);
        }

        export class Ad {
            getDuration(): number;

            getSkipTimeOffset(): number;

            getAdPodInfo(): AdPodInfo;

            getAdvertiserName(): string;

            isSkippable(): boolean;
        }

        class AdPodInfo {
            getAdPosition(): number;

            getTotalAds(): number;
        }

        class CuePoint {
            start(): number;
            end(): number;
            played: boolean;
        }

        class AdProgressData {
            currentTime: number;

            duration: number;

            url: number;

            totalAds: number;

            adPosition: number;
        }

        class StreamData {
            adProgressData: AdProgressData;

            url: string;

            cuepoints: Array<CuePoint>;

            errorMessage: string;

            streamId: string;

            subtitles?: Array<{ url: string, language: string, language_name: string }>;

        }

        class StreamEvent extends Event {
            getAd(): Ad;

            getStreamData(): StreamData;
        }

        class StreamRequest {
            adTagParameters: Object;

            apiKey: string;

            authToken: string;

            streamActivityMonitorId: string;

            format: string | undefined;
        }

        class VODStreamRequest extends StreamRequest {

            contentSourceId: string;


            videoId: string;
        }

        class LiveStreamRequest extends StreamRequest {
            assetKey: string;
        }

        namespace StreamEvent {
            const enum Type {
                LOADED = 'loaded',
                AD_BREAK_STARTED = 'adBreakStarted',
                AD_BREAK_ENDED = 'adBreakEnded',
                AD_PERIOD_STARTED = 'adPeriodStarted',
                AD_PERIOD_ENDED = 'adPeriodEnded',
                AD_PROGRESS = 'adProgress',
                CUEPOINTS_CHANGED = 'cuepointsChanged',
                CLICK = 'click',
                ERROR = 'error',
                STARTED = 'started',
                FIRST_QUARTILE = 'firstquartile',
                MIDPOINT = 'midpoint',
                STREAM_INITIALIZED = 'streamInitialized',
                THIRD_QUARTILE = 'thirdquartile',
                COMPLETE = 'complete',
                SKIPPABLE_STATE_CHANGED = 'skippableStateChanged',
                SKIPPED = 'skip',
                VIDEO_CLICKED = 'videoClicked',
            }
        }
    }
}
