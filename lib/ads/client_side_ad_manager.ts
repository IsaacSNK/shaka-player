/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 * @suppress {missingRequire} TODO(b/152540451): this shouldn't be needed
 */
import {ClientSideAd} from './client_side_ad';
import * as assertsExports from './../debug/asserts';
import {asserts} from './../debug/asserts';
import {EventManager} from './../util/event_manager';
import {FakeEvent} from './../util/fake_event';
import {IReleasable} from './../util/i_releasable';
import { log } from '../debug/log';
import { AdManager, ADS_LOADED, AD_BREAK_READY, AD_BUFFERING, AD_CLICKED, AD_CLOSED, AD_COMPLETE, AD_DURATION_CHANGED, AD_FIRST_QUARTILE, AD_IMPRESSION, AD_INTERACTION, AD_LINEAR_CHANGED, AD_LOADED, AD_METADATA, AD_MIDPOINT, AD_MUTED, AD_PAUSED, AD_PROGRESS, AD_RECOVERABLE_ERROR, AD_RESUMED, AD_SKIPPED, AD_SKIP_STATE_CHANGED, AD_STARTED, AD_STOPPED, AD_THIRD_QUARTILE, AD_VOLUME_CHANGED, ALL_ADS_COMPLETED, CUEPOINTS_CHANGED, IMA_AD_MANAGER_LOADED } from './ad_manager';
import { version } from '../player';
import { Dom } from '../util/dom_utils';
import { AdCuePoint } from '../../externs/shaka/ads';

/**
 * A class responsible for client-side ad interactions.
 */
export class ClientSideAdManager implements IReleasable {
  private adContainer_: HTMLElement;
  private video_: HTMLMediaElement;
  private resizeObserver_: ResizeObserver |null = null;
  private requestAdsStartTime_: number = NaN;
  private onEvent_: (p1: FakeEvent) => any;
  private ad_: ClientSideAd |null = null;
  private eventManager_: EventManager;

  // IMA: This instance should be re-used for the entire lifecycle of
  // the page.
  adsLoader_: any;

  //@ts-ignore
  private imaAdsManager_: google.ima.AdsManager = null;

  constructor(
      adContainer: HTMLElement, video: HTMLMediaElement, locale: string,
      onEvent: (p1: FakeEvent) => any) {
    this.adContainer_ = adContainer;
    this.video_ = video;
    this.onEvent_ = onEvent;
    this.eventManager_ = new EventManager();
    google.ima.settings.setLocale(locale);
    const adDisplayContainer =
        new google.ima.AdDisplayContainer(this.adContainer_, this.video_);

    // TODO: IMA: Must be done as the result of a user action on mobile
    adDisplayContainer.initialize();
    this.adsLoader_ = new google.ima.AdsLoader(adDisplayContainer);
    this.adsLoader_.getSettings().setPlayerType('shaka-player');
    this.adsLoader_.getSettings().setPlayerVersion(version);
    this.eventManager_.listenOnce(
        this.adsLoader_,
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e) => {
          this.onAdsManagerLoaded_((e as google.ima.AdsManagerLoadedEvent));
        });
    this.eventManager_.listen(
        this.adsLoader_, google.ima.AdErrorEvent.Type.AD_ERROR, (e) => {
          this.onAdError_((e as google.ima.AdErrorEvent));
        });

    // Notify the SDK when the video has ended, so it can play post-roll ads.
    this.video_.onended = () => {
      this.adsLoader_.contentComplete();
    };
  }

  requestAds(imaRequest: google.ima.AdsRequest) {
    asserts.assert(
        imaRequest.adTagUrl || imaRequest.adsResponse,
        'The ad tag needs to be set up before requesting ads, ' +
            'or adsResponse must be filled.');
    this.requestAdsStartTime_ = Date.now() / 1000;
    this.adsLoader_.requestAds(imaRequest);
  }

  /**
   * Stop all currently playing ads.
   */
  stop() {
    // this.imaAdsManager_ might not be set yet... if, for example, an ad
    // blocker prevented the ads from ever loading.
    if (this.imaAdsManager_) {
      this.imaAdsManager_.stop();
    }
    if (this.adContainer_) {
      Dom.removeAllChildren(this.adContainer_);
    }
  }

  /** @override */
  release() {
    this.stop();
    if (this.resizeObserver_) {
      this.resizeObserver_.disconnect();
    }
    if (this.eventManager_) {
      this.eventManager_.release();
    }
    if (this.imaAdsManager_) {
      this.imaAdsManager_.destroy();
    }
    this.adsLoader_.destroy();
  }

  private onAdError_(e: google.ima.AdErrorEvent) {
    log.warning(
        'There was an ad error from the IMA SDK: ' + e.getError());
    log.warning('Resuming playback.');
    this.onAdComplete_(
        /* adEvent= */
        null);

    // Remove ad breaks from the timeline
    this.onEvent_(new FakeEvent(
         CUEPOINTS_CHANGED,
        (new Map()).set('cuepoints', [])));
  }

  private onAdsManagerLoaded_(e: google.ima.AdsManagerLoadedEvent) {
    asserts.assert(this.video_ != null, 'Video should not be null!');
    const now = Date.now() / 1000;
    const loadTime = now - this.requestAdsStartTime_;
    this.onEvent_(new FakeEvent(
        ADS_LOADED, (new Map()).set('loadTime', loadTime)));
    this.imaAdsManager_ = e.getAdsManager(this.video_);
    this.onEvent_(new FakeEvent(
       IMA_AD_MANAGER_LOADED,
        (new Map()).set('imaAdManager', this.imaAdsManager_)));
    const cuePointStarts = this.imaAdsManager_.getCuePoints();
    if (cuePointStarts.length) {
      const cuePoints: AdCuePoint[] = [];
      for (const start of cuePointStarts) {
        const shakaCuePoint:
            AdCuePoint = {start: start, end: null};
        cuePoints.push(shakaCuePoint);
      }
      this.onEvent_(new FakeEvent(
          CUEPOINTS_CHANGED,
          (new Map()).set('cuepoints', cuePoints)));
    }
    this.addImaEventListeners_();
    try {
      const viewMode = this.isFullScreenEnabled_() ?
          google.ima.ViewMode.FULLSCREEN :
          google.ima.ViewMode.NORMAL;
      this.imaAdsManager_.init(
          this.video_.offsetWidth, this.video_.offsetHeight, viewMode);

      // Wait on the 'loadeddata' event rather than the 'loadedmetadata' event
      // because 'loadedmetadata' is sometimes called before the video resizes
      // on some platforms (e.g. Safari).
      this.eventManager_.listen(this.video_, 'loadeddata', () => {
        const viewMode = this.isFullScreenEnabled_() ?
            google.ima.ViewMode.FULLSCREEN :
            google.ima.ViewMode.NORMAL;
        this.imaAdsManager_.resize(
            this.video_.offsetWidth, this.video_.offsetHeight, viewMode);
      });
      if ('ResizeObserver' in window) {
        this.resizeObserver_ = new ResizeObserver(() => {
          const viewMode = this.isFullScreenEnabled_() ?
              google.ima.ViewMode.FULLSCREEN :
              google.ima.ViewMode.NORMAL;
          this.imaAdsManager_.resize(
              this.video_.offsetWidth, this.video_.offsetHeight, viewMode);
        });
        this.resizeObserver_.observe(this.video_);
      }

      // Single video and overlay ads will start at this time
      // TODO (ismena): Need a better inderstanding of what this does.
      // The docs say it's called to 'start playing the ads,' but I haven't
      // seen the ads actually play until requestAds() is called.
      this.imaAdsManager_.start();
    } catch (adError) {
      // If there was a problem with the VAST response,
      // we we won't be getting an ad. Hide ad UI if we showed it already
      // and get back to the presentation.
      this.onAdComplete_(
          /* adEvent= */
          null);
    }
  }

  private isFullScreenEnabled_(): boolean {
    if (document.fullscreenEnabled) {
      return !!document.fullscreenElement;
    } else {
      const video = (this.video_ as HTMLVideoElement);
      if (video['webkitSupportsFullscreen']) {
        return video['webkitDisplayingFullscreen'];
      }
    }
    return false;
  }

  private addImaEventListeners_() {
    const convertEventAndSend = (e: Event, type: string) => {
      const data = (new Map()).set('originalEvent', e);
      this.onEvent_(new FakeEvent(type, data));
    };
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdErrorEvent.Type.AD_ERROR, (error) => {
          this.onAdError_((error as google.ima.AdErrorEvent));
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
        (e) => {
          this.onAdStart_((e as google.ima.AdEvent));
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.STARTED, (e) => {
          this.onAdStart_((e as google.ima.AdEvent));
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.FIRST_QUARTILE, (e) => {
          convertEventAndSend(e, AD_FIRST_QUARTILE);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.MIDPOINT, (e) => {
          convertEventAndSend(e, AD_MIDPOINT);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.THIRD_QUARTILE, (e) => {
          convertEventAndSend(e, AD_THIRD_QUARTILE);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.COMPLETE, (e) => {
          convertEventAndSend(e, AD_COMPLETE);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
        (e) => {
          this.onAdComplete_((e as google.ima.AdEvent));
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.ALL_ADS_COMPLETED, (e) => {
          this.onAdComplete_((e as google.ima.AdEvent));
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.SKIPPED, (e) => {
          convertEventAndSend(e, AD_SKIPPED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.VOLUME_CHANGED, (e) => {
          convertEventAndSend(e, AD_VOLUME_CHANGED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.VOLUME_MUTED, (e) => {
          convertEventAndSend(e, AD_MUTED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.PAUSED, (e) => {
          if (this.ad_) {
            this.ad_.setPaused(true);
            convertEventAndSend(e, AD_PAUSED);
          }
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.RESUMED, (e) => {
          if (this.ad_) {
            this.ad_.setPaused(false);
            convertEventAndSend(e, AD_RESUMED);
          }
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.SKIPPABLE_STATE_CHANGED,
        (e) => {
          if (this.ad_) {
            convertEventAndSend(e, AD_SKIP_STATE_CHANGED);
          }
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.CLICK, (e) => {
          convertEventAndSend(e, AD_CLICKED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.AD_PROGRESS, (e) => {
          convertEventAndSend(e, AD_PROGRESS);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.AD_BUFFERING, (e) => {
          convertEventAndSend(e, AD_BUFFERING);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.IMPRESSION, (e) => {
          convertEventAndSend(e, AD_IMPRESSION);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.DURATION_CHANGE, (e) => {
          convertEventAndSend(e, AD_DURATION_CHANGED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.USER_CLOSE, (e) => {
          convertEventAndSend(e, AD_CLOSED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.LOADED, (e) => {
          convertEventAndSend(e, AD_LOADED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.ALL_ADS_COMPLETED, (e) => {
          convertEventAndSend(e, ALL_ADS_COMPLETED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.LINEAR_CHANGED, (e) => {
          convertEventAndSend(e, AD_LINEAR_CHANGED);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.AD_METADATA, (e) => {
          convertEventAndSend(e, AD_METADATA);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.LOG, (e) => {
          convertEventAndSend(e, AD_RECOVERABLE_ERROR);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.AD_BREAK_READY, (e) => {
          convertEventAndSend(e, AD_BREAK_READY);
        });
    this.eventManager_.listen(
        this.imaAdsManager_, google.ima.AdEvent.Type.INTERACTION, (e) => {
          convertEventAndSend(e, AD_INTERACTION);
        });
  }

  private onAdStart_(e: google.ima.AdEvent) {
    asserts.assert(
        this.imaAdsManager_, 'Should have an ads manager at this point!');
    const imaAd = e.getAd();
    if (!imaAd) {
      // Sometimes the IMA SDK will fire a CONTENT_PAUSE_REQUESTED or STARTED
      // event with no associated ad object.
      // We can't really play an ad in that situation, so just ignore the event.
      log.alwaysWarn(
          'The IMA SDK fired a ' + e.type + ' event with no associated ad. ' +
          'Unable to play ad!');
      return;
    }
    this.ad_ = new ClientSideAd(imaAd, this.imaAdsManager_, this.video_);
    const data = (new Map())
                     .set('ad', this.ad_)
                     .set('sdkAdObject', imaAd)
                     .set('originalEvent', e);
    this.onEvent_(
        new FakeEvent(AD_STARTED, data));
    if (this.ad_.isLinear()) {
      this.adContainer_.setAttribute('ad-active', 'true');
      this.video_.pause();
    }
  }

  private onAdComplete_(e: google.ima.AdEvent|null) {
    this.onEvent_(new FakeEvent(
       AD_STOPPED, (new Map()).set('originalEvent', e)));
    if (this.ad_ && this.ad_.isLinear()) {
      this.adContainer_.removeAttribute('ad-active');
      this.video_.play();
    }
  }
}
