/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 * @suppress {missingRequire} TODO(b/152540451): this shouldn't be needed
 */
import {ServerSideAd} from './server_side_ad';
import * as assertsExports from './../debug/asserts';
import {asserts} from './../debug/asserts';
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import {EventManager} from './../util/event_manager';
import {FakeEvent} from './../util/fake_event';
import {IReleasable} from './../util/i_releasable';
import { ADS_LOADED, AD_COMPLETE, AD_FIRST_QUARTILE, AD_MIDPOINT, AD_SKIPPED, AD_STARTED, AD_STOPPED, AD_THIRD_QUARTILE, CUEPOINTS_CHANGED, IMA_STREAM_MANAGER_LOADED } from './ad_manager';
import { Category, Severity ,Code,Error} from '../util/error';

/**
 * A class responsible for server-side ad interactions.
 */
export class ServerSideAdManager implements IReleasable {
  private adContainer_: HTMLElement;
  private video_: HTMLMediaElement;

  /*        {?shaka.util.PublicPromise.<string>} */
  private streamPromise_: any = null;
  private streamRequestStartTime_: number = NaN;
  private onEvent_: (p1: FakeEvent) => any;
  private isLiveContent_: boolean = false;

  /**
   * Time to seek to after an ad if that ad was played as the result of
   * snapback.
   */
  private snapForwardTime_: number|null = null;
  private ad_: ServerSideAd|null = null;
  private adProgressData_: google.ima.dai.api.AdProgressData|null = null;
  private backupUrl_: string = '';
  private currentCuePoints_: shaka.extern.AdCuePoint[] = [];
  private eventManager_: EventManager;
  private streamManager_: google.ima.dai.api.StreamManager;

  constructor(
      adContainer: HTMLElement, video: HTMLMediaElement, locale: string,
      onEvent: (p1: FakeEvent) => any) {
    this.adContainer_ = adContainer;
    this.video_ = video;
    this.onEvent_ = onEvent;
    this.eventManager_ = new EventManager();
    const uiSettings: google.ima.dai.api.UiSettings =
        new google.ima.dai.api.UiSettings();
    uiSettings.setLocale(locale);
    this.streamManager_ = new google.ima.dai.api.StreamManager(
        this.video_, this.adContainer_, uiSettings);
    this.onEvent_(new FakeEvent(
        IMA_STREAM_MANAGER_LOADED,
        (new Map()).set('imaStreamManager', this.streamManager_)));

    // Events
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.LOADED,
        (e) => {
          log.info('Ad SS Loaded');
          this.onLoaded_((e as google.ima.dai.api.StreamEvent));
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.ERROR, () => {
          log.info('Ad SS Error');
          this.onError_();
        });
    this.eventManager_.listen(
        this.streamManager_,
        google.ima.dai.api.StreamEvent.Type.AD_BREAK_STARTED, () => {
          log.info('Ad Break Started');
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.STARTED,
        (e) => {
          log.info('Ad Started');
          this.onAdStart_((e as google.ima.dai.api.StreamEvent));
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.AD_BREAK_ENDED,
        () => {
          log.info('Ad Break Ended');
          this.onAdBreakEnded_();
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.AD_PROGRESS,
        (e) => {
          this.onAdProgress_((e as google.ima.dai.api.StreamEvent));
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.FIRST_QUARTILE,
        () => {
          log.info('Ad event: First Quartile');
          this.onEvent_(
              new FakeEvent(AD_FIRST_QUARTILE));
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.MIDPOINT,
        () => {
          log.info('Ad event: Midpoint');
          this.onEvent_(
              new FakeEvent(AD_MIDPOINT));
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.THIRD_QUARTILE,
        () => {
          log.info('Ad event: Third Quartile');
          this.onEvent_(
              new FakeEvent(AD_THIRD_QUARTILE));
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.COMPLETE,
        () => {
          log.info('Ad event: Complete');
          this.onEvent_(
              new FakeEvent(AD_COMPLETE));
          this.onEvent_(
              new FakeEvent(AD_STOPPED));
          this.adContainer_.removeAttribute('ad-active');
          this.ad_ = null;
        });
    this.eventManager_.listen(
        this.streamManager_, google.ima.dai.api.StreamEvent.Type.SKIPPED,
        () => {
          log.info('Ad event: Skipped');
          this.onEvent_(
              new FakeEvent(AD_SKIPPED));
          this.onEvent_(
              new FakeEvent(AD_STOPPED));
        });
    this.eventManager_.listen(
        this.streamManager_,
        google.ima.dai.api.StreamEvent.Type.CUEPOINTS_CHANGED, (e) => {
          log.info('Ad event: Cue points changed');
          this.onCuePointsChanged_((e as google.ima.dai.api.StreamEvent));
        });
  }

  streamRequest(
      streamRequest: google.ima.dai.api.StreamRequest,
      backupUrl?: string): Promise<string> {
    if (this.streamPromise_) {
      return Promise.reject(new Error(
           Severity.RECOVERABLE, Category.ADS,
          Code.CURRENT_DAI_REQUEST_NOT_FINISHED));
    }
    if (streamRequest instanceof google.ima.dai.api.LiveStreamRequest) {
      this.isLiveContent_ = true;
    }
    this.streamPromise_ = new PublicPromise();
    this.streamManager_.requestStream(streamRequest);
    this.backupUrl_ = backupUrl || '';
    this.streamRequestStartTime_ = Date.now() / 1000;
    return this.streamPromise_;
  }

  replaceAdTagParameters(adTagParameters: Object) {
    this.streamManager_.replaceAdTagParameters(adTagParameters);
  }

  /**
   * Resets the stream manager and removes any continuous polling.
   */
  stop() {
    // TODO:
    // For SS DAI streams, if a different asset gets unloaded as
    // part of the process
    // of loading a DAI asset, stream manager state gets reset and we
    // don't get any ad events.
    // We need to figure out if it makes sense to stop the SS
    // manager on unload, and, if it does, find
    // a way to do it safely.
    // this.streamManager_.reset();
    this.backupUrl_ = '';
    this.snapForwardTime_ = null;
    this.currentCuePoints_ = [];
  }

  /** @override */
  release() {
    this.stop();
    if (this.eventManager_) {
      this.eventManager_.release();
    }
  }

  /**
   *   Comes as string in DASH and as Uint8Array in HLS.
   * @param timestamp (in seconds)
   */
  onTimedMetadata(type: string, data: Uint8Array|string, timestamp: number) {
    this.streamManager_.processMetadata(type, data, timestamp);
  }

  onCueMetadataChange(value: shaka.extern.ID3Metadata) {
    // Native HLS over Safari/iOS/iPadOS
    // For live event streams, the stream needs some way of informing the SDK
    // that an ad break is coming up or ending. In the IMA DAI SDK, this is
    // done through timed metadata. Timed metadata is carried as part of the
    // DAI stream content and carries ad break timing information used by the
    // SDK to track ad breaks.
    if (value['key'] && value['data']) {
      const metadata = {};
      metadata[value['key']] = value['data'];
      this.streamManager_.onTimedMetadata(metadata);
    }
  }

  getCuePoints(): shaka.extern.AdCuePoint[] {
    return this.currentCuePoints_;
  }

  /**
   * If a seek jumped over the ad break, return to the start of the
   * ad break, then complete the seek after the ad played through.
   */
  private checkForSnapback_() {
    const currentTime = this.video_.currentTime;
    if (currentTime == 0) {
      return;
    }
    this.streamManager_.streamTimeForContentTime(currentTime);
    const previousCuePoint =
        this.streamManager_.previousCuePointForStreamTime(currentTime);

    // The cue point gets marked as 'played' as soon as the playhead hits it
    // (at the start of an ad), so when we come back to this method as a result
    // of seeking back to the user-selected time, the 'played' flag will be set.
    if (previousCuePoint && !previousCuePoint.played) {
      log.info(
          'Seeking back to the start of the ad break at ' +
          previousCuePoint.start + ' and will return to ' + currentTime);
      this.snapForwardTime_ = currentTime;
      this.video_.currentTime = previousCuePoint.start;
    }
  }

  private onAdStart_(e: google.ima.dai.api.StreamEvent) {
    asserts.assert(
        this.streamManager_, 'Should have a stream manager at this point!');
    const imaAd = e.getAd();
    this.ad_ = new ServerSideAd(imaAd, this.video_);

    // Ad object and ad progress data come from two different IMA events.
    // It's a race, and we don't know, which one will fire first - the
    // event that contains an ad object (AD_STARTED) or the one that
    // contains ad progress info (AD_PROGRESS).
    // If the progress event fired first, we must've saved the progress
    // info and can now add it to the ad object.
    if (this.adProgressData_) {
      this.ad_.setProgressData(this.adProgressData_);
    }
    this.onEvent_(new FakeEvent(
        AD_STARTED, (new Map()).set('ad', this.ad_)));
    this.adContainer_.setAttribute('ad-active', 'true');
  }

  private onAdBreakEnded_() {
    this.adContainer_.removeAttribute('ad-active');
    const currentTime = this.video_.currentTime;

    // If the ad break was a result of snapping back (a user seeked over
    // an ad break and was returned to it), seek forward to the point,
    // originally chosen by the user.
    if (this.snapForwardTime_ && this.snapForwardTime_ > currentTime) {
      this.video_.currentTime = this.snapForwardTime_;
      this.snapForwardTime_ = null;
    }
  }

  private onLoaded_(e: google.ima.dai.api.StreamEvent) {
    const now = Date.now() / 1000;
    const loadTime = now - this.streamRequestStartTime_;
    this.onEvent_(new FakeEvent(
        ADS_LOADED, (new Map()).set('loadTime', loadTime)));
    const streamData = e.getStreamData();
    const url = streamData.url;
    this.streamPromise_.resolve(url);
    this.streamPromise_ = null;
    if (!this.isLiveContent_) {
      this.eventManager_.listen(this.video_, 'seeked', () => {
        this.checkForSnapback_();
      });
    }
  }

  private onError_() {
    if (!this.backupUrl_.length) {
      this.streamPromise_.reject(
          'IMA Stream request returned an error ' +
          'and there was no backup asset uri provided.');
      this.streamPromise_ = null;
      return;
    }
    log.warning(
        'IMA stream request returned an error. ' +
        'Falling back to the backup asset uri.');
    this.streamPromise_.resolve(this.backupUrl_);
    this.streamPromise_ = null;
  }

  private onAdProgress_(e: google.ima.dai.api.StreamEvent) {
    const streamData = e.getStreamData();
    const adProgressData = streamData.adProgressData;
    this.adProgressData_ = adProgressData;
    if (this.ad_) {
      this.ad_.setProgressData(this.adProgressData_);
    }
  }

  private onCuePointsChanged_(e: google.ima.dai.api.StreamEvent) {
    const streamData = e.getStreamData();
    const cuePoints: shaka.extern.AdCuePoint[] = [];
    for (const point of streamData.cuepoints) {
      const shakaCuePoint:
          shaka.extern.AdCuePoint = {start: point.start, end: point.end};
      cuePoints.push(shakaCuePoint);
    }
    this.currentCuePoints_ = cuePoints;
    this.onEvent_(new FakeEvent(
        CUEPOINTS_CHANGED,
        (new Map()).set('cuepoints', cuePoints)));
  }
}
