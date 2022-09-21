/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
goog.require('shaka.Player');
import{AdsStats}from './ads_stats';
import{ClientSideAdManager}from './client_side_ad_manager';
import{ServerSideAdManager}from './server_side_ad_manager';
import{log}from './log';
import*as logExports from './log';
import{Error}from './error';
import*as ErrorExports from './error';
import{FakeEvent}from './fake_event';
import*as FakeEventExports from './fake_event';
import{FakeEventTarget}from './fake_event_target';
import*as FakeEventTargetExports from './fake_event_target';
import{IReleasable}from './i_releasable';
 
/**
 * @event shaka.ads.AdManager.ADS_LOADED
 * @description Fired when an ad has started playing.
 * @property {string} type
 *   'ads-loaded'
 * @property {number} loadTime
 *    The time it takes to load ads.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdStartedEvent
 * @description Fired when an ad has started playing.
 * @property {string} type
 *   'ad-started'
 * @property {!shaka.extern.IAd} ad
 *    The ad that has started playing.
 * @property {Object} sdkAdObject
 *    The ad object in the SDK format, if there is one.
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdCompleteEvent
 * @description Fired when an ad has played through.
 * @property {string} type
 *   'ad-complete'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdSkippedEvent
 * @description Fired when an ad has been skipped.
 * @property {string} type
 *   'ad-skipped'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdFirstQuartileEvent
 * @description Fired when an ad has played through the first 1/4.
 * @property {string} type
 *   'ad-first-quartile'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdMidpointEvent
 * @description Fired when an ad has played through its midpoint.
 * @property {string} type
 *   'ad-midpoint'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdThirdQuartileEvent
 * @description Fired when an ad has played through the third quartile.
 * @property {string} type
 *   'ad-third-quartile'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdStoppedEvent
 * @description Fired when an ad has stopped playing, was skipped,
 *   or was unable to proceed due to an error.
 * @property {string} type
 *   'ad-stopped'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdVolumeChangedEvent
 * @description Fired when an ad's volume changed.
 * @property {string} type
 *   'ad-volume-changed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdMutedEvent
 * @description Fired when an ad was muted.
 * @property {string} type
 *   'ad-muted'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdPausedEvent
 * @description Fired when an ad was paused.
 * @property {string} type
 *   'ad-paused'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdResumedEvent
 * @description Fired when an ad was resumed after a pause.
 * @property {string} type
 *   'ad-resumed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdSkipStateChangedEvent
 * @description Fired when an ad's skip state changes (for example, when
 *  it becomes possible to skip the ad).
 * @property {string} type
 *   'ad-skip-state-changed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdResumedEvent
 * @description Fired when the ad cue points change, signalling ad breaks
 *  change.
 * @property {string} type
 *   'ad-cue-points-changed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdProgressEvent
 * @description Fired when there is an update to the current ad's progress.
 * @property {string} type
 *   'ad-progress'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdBufferingEvent
 * @description Fired when the ad has stalled playback to buffer.
 * @property {string} type
 *   'ad-buffering'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdImpressionEvent
 * @description Fired when the impression URL has been pinged.
 * @property {string} type
 *   'ad-impression'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdClickEvent
 * @description Fired when the ad was clicked.
 * @property {string} type
 *   'ad-clicked'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdDurationChangedEvent
 * @description Fired when the ad's duration changes.
 * @property {string} type
 *   'ad-duration-changed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdClosedEvent
 * @description Fired when the ad was closed by the user.
 * @property {string} type
 *   'ad-closed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdLoadedEvent
 * @description Fired when the ad data becomes available.
 * @property {string} type
 *   'ad-loaded'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AllAdsCompletedEvent
 * @description Fired when the ads manager is done playing all the ads.
 * @property {string} type
 *   'all-ads-completed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdLinearChangedEvent
 * @description Fired when the displayed ad changes from
 *   linear to nonlinear, or vice versa.
 * @property {string} type
 *   'ad-linear-changed'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdMetadataEvent
 * @description Fired when the ad's metadata becomes available.
 * @property {string} type
 *   'ad-metadata'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager#AdBreakReadyEvent
 * @description Fired when the client-side SDK is ready to play a
 *   VPAID ad or an ad rule.
 * @property {string} type
 *   'ad-break-ready'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdRecoverableErrorEvent
 * @description Fired when the a non-fatal error was encountered.
 *   The presentation will continue with the same or next ad playback
 *   depending on the error situation.
 * @property {string} type
 *   'ad-recoverable-error'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdInteractionEvent
 * @description Fired when an ad triggers the interaction callback.
 * @property {string} type
 *   'ad-interaction'
 * @property {Object} originalEvent
 *    The native SDK event, if available.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager#ImaAdManagerLoadedEvent
 * @description Fired when the native IMA ad manager becomes available.
 * @property {string} type
 *   'ima-ad-manager-loaded'
 * @property {!Object} imaAdManager
 *    The native IMA ad manager.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager#ImaStreamManagerLoadedEvent
 * @description Fired when the native IMA stream manager becomes available.
 * @property {string} type
 *   'ima-stream-manager-loaded'
 * @property {!Object} imaStreamManager
 *    The native IMA stream manager.
 * @exportDoc
 */ 
 
/**
 * @event shaka.ads.AdManager.AdClickedEvent
 * @description Fired when the ad was clicked.
 * @property {string} type
 *   'ad-clicked'
 * @exportDoc
 */ 
 
/**
 * A class responsible for ad-related interactions.
 * @export
 */ 
export class AdManager extends FakeEventTarget implements shaka.extern.IAdManager, IReleasable {
  private csAdManager_: ClientSideAdManager = null;
  private ssAdManager_: ServerSideAdManager = null;
  private stats_: AdsStats;
   
  /** locale */ 
  private locale_: string;
   
  constructor() {
    super();
    this.stats_ = new AdsStats();
    this.locale_ = navigator.language;
  }
   
  /**
     * @override
     * @export
     */ 
  setLocale(locale) {
    this.locale_ = locale;
  }
   
  /**
     * @override
     * @export
     */ 
  initClientSide(adContainer, video) {
     
    // Check that Client Side IMA SDK has been included
    // NOTE: (window['google'] && google.ima) check for any
    // IMA SDK, including SDK for Server Side ads.
    // The 3rd check insures we have the right SDK:
    // {google.ima.AdsLoader} is an object that's part of CS IMA SDK
    // but not SS SDK. 
    if (!window['google'] || !google.ima || !google.ima.AdsLoader) {
      throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.ADS, ErrorExports.Code.CS_IMA_SDK_MISSING);
    }
    if (this.csAdManager_) {
      this.csAdManager_.release();
    }
    this.csAdManager_ = new ClientSideAdManager(adContainer, video, this.locale_,  
    (e) => {
      const event = (e as FakeEvent);
      if (event && event.type) {
        switch(event.type) {
          case ADS_LOADED:
            {
              const loadTime = (e as Object)['loadTime'];
              this.stats_.addLoadTime(loadTime);
              break;
            }
          case AD_STARTED:
            this.stats_.incrementStarted();
            break;
          case AD_COMPLETE:
            this.stats_.incrementPlayedCompletely();
            break;
          case AD_SKIPPED:
            this.stats_.incrementSkipped();
            break;
        }
      }
      this.dispatchEvent(event);
    });
  }
   
  /**
     * @override
     * @export
     */ 
  release() {
    if (this.csAdManager_) {
      this.csAdManager_.release();
      this.csAdManager_ = null;
    }
    if (this.ssAdManager_) {
      this.ssAdManager_.release();
      this.ssAdManager_ = null;
    }
    super.release();
  }
   
  /**
    * @override
    * @export
    */ 
  onAssetUnload() {
    if (this.csAdManager_) {
      this.csAdManager_.stop();
    }
    if (this.ssAdManager_) {
      this.ssAdManager_.stop();
    }
    this.dispatchEvent(new FakeEvent(AD_STOPPED));
    this.stats_ = new AdsStats();
  }
   
  /**
     * @override
     * @export
     */ 
  requestClientSideAds(imaRequest) {
    if (!this.csAdManager_) {
      throw new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.ADS, ErrorExports.Code.CS_AD_MANAGER_NOT_INITIALIZED);
    }
    this.csAdManager_.requestAds(imaRequest);
  }
   
  /**
     * @override
     * @export
     */ 
  initServerSide(adContainer, video) {
     
    // Check that Client Side IMA SDK has been included
    // NOTE: (window['google'] && google.ima) check for any
    // IMA SDK, including SDK for Server Side ads.
    // The 3rd check insures we have the right SDK:
    // {google.ima.dai} is an object that's part of DAI IMA SDK
    // but not SS SDK. 
    if (!window['google'] || !google.ima || !google.ima.dai) {
      throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.ADS, ErrorExports.Code.SS_IMA_SDK_MISSING);
    }
    if (this.ssAdManager_) {
      this.ssAdManager_.release();
    }
    this.ssAdManager_ = new ServerSideAdManager(adContainer, video, this.locale_,  
    (e) => {
      const event = (e as FakeEvent);
      if (event && event.type) {
        switch(event.type) {
          case ADS_LOADED:
            {
              const loadTime = (e as Object)['loadTime'];
              this.stats_.addLoadTime(loadTime);
              break;
            }
          case AD_STARTED:
            this.stats_.incrementStarted();
            break;
          case AD_COMPLETE:
            this.stats_.incrementPlayedCompletely();
            break;
          case AD_SKIPPED:
            this.stats_.incrementSkipped();
            break;
        }
      }
      this.dispatchEvent(event);
    });
  }
   
  /**
     * @override
     * @export
     */ 
  requestServerSideStream(imaRequest: google.ima.dai.api.StreamRequest, backupUrl: string = ''): Promise<string> {
    if (!this.ssAdManager_) {
      throw new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.ADS, ErrorExports.Code.SS_AD_MANAGER_NOT_INITIALIZED);
    }
    if (!imaRequest.adTagParameters) {
      imaRequest.adTagParameters = {};
    }
    const adTagParams = imaRequest.adTagParameters;
    if (adTagParams['mpt'] || adTagParams['mpv']) {
      log.alwaysWarn('You have attempted to set "mpt" and/or "mpv" ' + 'parameters of the ad tag. Please note that those parameters are ' + 'used for Shaka adoption tracking and will be overriden.');
    }
     
    // Set player and version parameters for tracking 
    imaRequest.adTagParameters['mpt'] = 'shaka-player';
    imaRequest.adTagParameters['mpv'] = shaka.Player.version;
    return this.ssAdManager_.streamRequest(imaRequest, backupUrl);
  }
   
  /**
     * @override
     * @export
     */ 
  replaceServerSideAdTagParameters(adTagParameters) {
    if (!this.ssAdManager_) {
      throw new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.ADS, ErrorExports.Code.SS_AD_MANAGER_NOT_INITIALIZED);
    }
    if (adTagParameters['mpt'] || adTagParameters['mpv']) {
      log.alwaysWarn('You have attempted to set "mpt" and/or "mpv" ' + 'parameters of the ad tag. Please note that those parameters are ' + 'used for Shaka adoption tracking and will be overriden.');
    }
    adTagParameters['mpt'] = 'Shaka Player';
    adTagParameters['mpv'] = shaka.Player.version;
    this.ssAdManager_.replaceAdTagParameters(adTagParameters);
  }
   
  /**
     * @override
     * @export
     */ 
  getServerSideCuePoints(): shaka.extern.AdCuePoint[] {
    if (!this.ssAdManager_) {
      throw new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.ADS, ErrorExports.Code.SS_AD_MANAGER_NOT_INITIALIZED);
    }
    return this.ssAdManager_.getCuePoints();
  }
   
  /**
     * @override
     * @export
     */ 
  getStats(): shaka.extern.AdsStats {
    return this.stats_.getBlob();
  }
   
  /**
     * @override
     * @export
     */ 
  onDashTimedMetadata(region) {
    if (this.ssAdManager_ && region.schemeIdUri == 'urn:google:dai:2018') {
      const type = region.schemeIdUri;
      const data = region.eventElement ? region.eventElement.getAttribute('messageData') : null;
      const timestamp = region.startTime;
      this.ssAdManager_.onTimedMetadata(type, data, timestamp);
    }
  }
   
  /**
     * @override
     * @export
     */ 
  onHlsTimedMetadata(metadata, timestamp) {
    if (this.ssAdManager_) {
      this.ssAdManager_.onTimedMetadata('ID3', metadata['data'], timestamp);
    } else {
      log.warning('ID3 metadata processing was called without ' + 'initializing server side ad logic. Ad-related metadata will ' + 'not take effect');
    }
  }
   
  /**
     * @override
     * @export
     */ 
  onCueMetadataChange(value) {
    if (this.ssAdManager_) {
      this.ssAdManager_.onCueMetadataChange(value);
    } else {
      log.warning('ID3 metadata processing was called without ' + 'initializing server side ad logic. Ad-related metadata will ' + 'not take effect');
    }
  }
}
 
/**
 * The event name for when a sequence of ads has been loaded.
 *
 * @export
 */ 
export const ADS_LOADED: string = 'ads-loaded';
 
/**
 * The event name for when an ad has started playing.
 *
 * @export
 */ 
export const AD_STARTED: string = 'ad-started';
 
/**
 * The event name for when an ad playhead crosses first quartile.
 *
 * @export
 */ 
export const AD_FIRST_QUARTILE: string = 'ad-first-quartile';
 
/**
 * The event name for when an ad playhead crosses midpoint.
 *
 * @export
 */ 
export const AD_MIDPOINT: string = 'ad-midpoint';
 
/**
 * The event name for when an ad playhead crosses third quartile.
 *
 * @export
 */ 
export const AD_THIRD_QUARTILE: string = 'ad-third-quartile';
 
/**
 * The event name for when an ad has completed playing.
 *
 * @export
 */ 
export const AD_COMPLETE: string = 'ad-complete';
 
/**
 * The event name for when an ad has finished playing
 * (played all the way through, was skipped, or was unable to proceed
 * due to an error).
 *
 * @export
 */ 
export const AD_STOPPED: string = 'ad-stopped';
 
/**
 * The event name for when an ad is skipped by the user..
 *
 * @export
 */ 
export const AD_SKIPPED: string = 'ad-skipped';
 
/**
 * The event name for when the ad volume has changed.
 *
 * @export
 */ 
export const AD_VOLUME_CHANGED: string = 'ad-volume-changed';
 
/**
 * The event name for when the ad was muted.
 *
 * @export
 */ 
export const AD_MUTED: string = 'ad-muted';
 
/**
 * The event name for when the ad was paused.
 *
 * @export
 */ 
export const AD_PAUSED: string = 'ad-paused';
 
/**
 * The event name for when the ad was resumed after a pause.
 *
 * @export
 */ 
export const AD_RESUMED: string = 'ad-resumed';
 
/**
 * The event name for when the ad's skip status changes
 * (usually it becomes skippable when it wasn't before).
 *
 * @export
 */ 
export const AD_SKIP_STATE_CHANGED: string = 'ad-skip-state-changed';
 
/**
 * The event name for when the ad's cue points (start/end markers)
 * have changed.
 *
 * @export
 */ 
export const CUEPOINTS_CHANGED: string = 'ad-cue-points-changed';
 
/**
 * The event name for when the native IMA ad manager object has
 * loaded and become available.
 *
 * @export
 */ 
export const IMA_AD_MANAGER_LOADED: string = 'ima-ad-manager-loaded';
 
/**
 * The event name for when the native IMA stream manager object has
 * loaded and become available.
 *
 * @export
 */ 
export const IMA_STREAM_MANAGER_LOADED: string = 'ima-stream-manager-loaded';
 
/**
 * The event name for when the ad was clicked.
 *
 * @export
 */ 
export const AD_CLICKED: string = 'ad-clicked';
 
/**
 * The event name for when there is an update to the current ad's progress.
 *
 * @export
 */ 
export const AD_PROGRESS: string = 'ad-progress';
 
/**
 * The event name for when the ad is buffering.
 *
 * @export
 */ 
export const AD_BUFFERING: string = 'ad-buffering';
 
/**
 * The event name for when the ad's URL was hit.
 *
 * @export
 */ 
export const AD_IMPRESSION: string = 'ad-impression';
 
/**
 * The event name for when the ad's duration changed.
 *
 * @export
 */ 
export const AD_DURATION_CHANGED: string = 'ad-duration-changed';
 
/**
 * The event name for when the ad was closed by the user.
 *
 * @export
 */ 
export const AD_CLOSED: string = 'ad-closed';
 
/**
 * The event name for when the ad data becomes available.
 *
 * @export
 */ 
export const AD_LOADED: string = 'ad-loaded';
 
/**
 * The event name for when all the ads were completed.
 *
 * @export
 */ 
export const ALL_ADS_COMPLETED: string = 'all-ads-completed';
 
/**
 * The event name for when the ad changes from or to linear.
 *
 * @export
 */ 
export const AD_LINEAR_CHANGED: string = 'ad-linear-changed';
 
/**
 * The event name for when the ad's metadata becomes available.
 *
 * @export
 */ 
export const AD_METADATA: string = 'ad-metadata';
 
/**
 * The event name for when the ad display encountered a recoverable
 * error.
 *
 * @export
 */ 
export const AD_RECOVERABLE_ERROR: string = 'ad-recoverable-error';
 
/**
 * The event name for when the client side SDK signalled its readiness
 * to play a VPAID ad or an ad rule.
 *
 * @export
 */ 
export const AD_BREAK_READY: string = 'ad-break-ready';
 
/**
 * The event name for when the interaction callback for the ad was
 * triggered.
 *
 * @export
 */ 
export const AD_INTERACTION: string = 'ad-interaction';
 
/**
 * Set this is a default ad manager for the player.
 * Apps can also set their own ad manager, if they'd like.
 */ 
shaka.Player.setAdManagerFactory( 
() => new AdManager());
