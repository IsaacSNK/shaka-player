/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './lib/asserts';
import {asserts} from './lib/asserts';
import * as logExports from './lib/log';
import {log} from './lib/log';
import * as PlayerExports from './lib/player';
import {Player} from './lib/player';
import * as polyfillExports from './lib/all';
import {polyfill} from './lib/all';
import {ConfigUtils} from './lib/config_utils';
import {Dom} from './lib/dom_utils';
import * as FakeEventExports from './lib/fake_event';
import {FakeEvent} from './lib/fake_event';
import {IDestroyable} from './lib/i_destroyable';
import * as PlatformExports from './lib/platform';
import {Platform} from './lib/platform';
import {Controls} from './/controls';

/**
 * @export
 */
export class Overlay implements IDestroyable {
  private player_: Player;
  private config_: shaka.extern.UIConfiguration;
  private controls_: Controls;

  constructor(
      player: Player, videoContainer: HTMLElement, video: HTMLMediaElement) {
    this.player_ = player;
    this.config_ = this.defaultConfig_();

    // Make sure this container is discoverable and that the UI can be reached
    // through it.
    videoContainer['dataset']['shakaPlayerContainer'] = '';
    videoContainer['ui'] = this;

    // Tag the container for mobile platforms, to allow different styles.
    if (this.isMobile()) {
      videoContainer.classList.add('shaka-mobile');
    }
    this.controls_ = new Controls(player, videoContainer, video, this.config_);

    // Run the initial setup so that no configure() call is required for default
    // settings.
    this.configure({});

    // If the browser's native controls are disabled, use UI TextDisplayer.
    if (!video.controls) {
      player.setVideoContainer(videoContainer);
    }
    videoContainer['ui'] = this;
    video['ui'] = this;
  }

  /**
   * @override
   * @export
   */
  async destroy() {
    if (this.controls_) {
      await this.controls_.destroy();
    }
    this.controls_ = null;
    if (this.player_) {
      await this.player_.destroy();
    }
    this.player_ = null;
  }

  /**
   * Detects if this is a mobile platform, in case you want to choose a
   * different UI configuration on mobile devices.
   *
   * @export
   */
  isMobile(): boolean {
    return Platform.isMobile();
  }

  /**
   * @export
   */
  getConfiguration(): shaka.extern.UIConfiguration {
    const ret = this.defaultConfig_();
    ConfigUtils.mergeConfigObjects(
        ret, this.config_, this.defaultConfig_(),
        /* overrides= */
        {},
        /* path= */
        '');
    return ret;
  }

  /**
   * @param config This should either be a field name or an
   *   object following the form of {@link shaka.extern.UIConfiguration}, where
   *   you may omit any field you do not wish to change.
   * @param value This should be provided if the previous parameter
   *   was a string field name.
   * @export
   */
  configure(config: string|Object, value?: any) {
    asserts.assert(
        typeof config == 'object' || arguments.length == 2,
        'String configs should have values!');

    // ('fieldName', value) format
    if (arguments.length == 2 && typeof config == 'string') {
      config = ConfigUtils.convertToConfigObject(config, value);
    }
    asserts.assert(typeof config == 'object', 'Should be an object!');
    ConfigUtils.mergeConfigObjects(
        this.config_, config, this.defaultConfig_(),
        /* overrides= */
        {},
        /* path= */
        '');

    // If a cast receiver app id has been given, add a cast button to the UI
    if (this.config_.castReceiverAppId &&
        !this.config_.overflowMenuButtons.includes('cast')) {
      this.config_.overflowMenuButtons.push('cast');
    }
    asserts.assert(this.player_ != null, 'Should have a player!');
    this.controls_.configure(this.config_);
    this.controls_.dispatchEvent(new FakeEvent('uiupdated'));
  }

  /**
   * @export
   */
  getControls(): Controls {
    return this.controls_;
  }

  /**
   * Enable or disable the custom controls.
   *
   * @export
   */
  setEnabled(enabled: boolean) {
    this.controls_.setEnabledShakaControls(enabled);
  }

  private defaultConfig_(): shaka.extern.UIConfiguration {
    const config = {
      controlPanelElements: [
        'play_pause', 'time_and_duration', 'spacer', 'mute', 'volume',
        'fullscreen', 'overflow_menu'
      ],
      overflowMenuButtons: [
        'captions', 'quality', 'language', 'picture_in_picture', 'cast',
        'playback_rate'
      ],
      statisticsList: [
        'width', 'height', 'corruptedFrames', 'decodedFrames', 'droppedFrames',
        'drmTimeSeconds', 'licenseTime', 'liveLatency', 'loadLatency',
        'bufferingTime', 'manifestTimeSeconds', 'estimatedBandwidth',
        'streamBandwidth', 'maxSegmentDuration', 'pauseTime', 'playTime',
        'completionPercent'
      ],
      contextMenuElements: ['loop', 'picture_in_picture', 'statistics'],
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      fastForwardRates: [2, 4, 8, 1],
      rewindRates: [-1, -2, -4, -8],
      addSeekBar: true,
      addBigPlayButton: false,
      customContextMenu: false,
      castReceiverAppId: '',
      castAndroidReceiverCompatible: false,
      clearBufferOnQualityChange: true,
      showUnbufferedStart: false,
      seekBarColors: {
        base: 'rgba(255, 255, 255, 0.3)',
        buffered: 'rgba(255, 255, 255, 0.54)',
        played: 'rgb(255, 255, 255)',
        adBreaks: 'rgb(255, 204, 0)'
      },
      volumeBarColors:
          {base: 'rgba(255, 255, 255, 0.54)', level: 'rgb(255, 255, 255)'},
      trackLabelFormat: TrackLabelFormat.LANGUAGE,
      fadeDelay: 0,
      doubleClickForFullscreen: true,
      singleClickForPlayAndPause: true,
      enableKeyboardPlaybackControls: true,
      enableFullscreenOnRotation: true,
      forceLandscapeOnFullscreen: true,
      enableTooltips: false,
      keyboardSeekDistance: 5
    };

    // Check AirPlay support
    if (window.WebKitPlaybackTargetAvailabilityEvent) {
      config.overflowMenuButtons.push('airplay');
    }

    // On mobile, by default, hide the volume slide and the small play/pause
    // button and show the big play/pause button in the center.
    // This is in line with default styles in Chrome.
    if (this.isMobile()) {
      config.addBigPlayButton = true;
      config.controlPanelElements = config.controlPanelElements.filter(
          (name) => name != 'play_pause' && name != 'volume');
    }
    return config;
  }

  private static async scanPageForShakaElements_() {
    // Install built-in polyfills to patch browser incompatibilities.
    polyfill.installAll();

    // Check to see if the browser supports the basic APIs Shaka needs.
    if (!Player.isBrowserSupported()) {
      log.error(
          'Shaka Player does not support this browser. ' +
          'Please see https://tinyurl.com/y7s4j9tr for the list of ' +
          'supported browsers.');

      // After scanning the page for elements, fire a special "loaded" event for
      // when the load fails. This will allow the page to react to the failure.
      Overlay.dispatchLoadedEvent_(
          'shaka-ui-load-failed', FailReasonCode.NO_BROWSER_SUPPORT);
      return;
    }

    // Look for elements marked 'data-shaka-player-container'
    // on the page. These will be used to create our default
    // UI.
    const containers =
        document.querySelectorAll('[data-shaka-player-container]');

    // Look for elements marked 'data-shaka-player'. They will
    // either be used in our default UI or with native browser
    // controls.
    const videos = document.querySelectorAll('[data-shaka-player]');

    // No elements have been tagged with shaka attributes.
    if (!videos.length && !containers.length) {
    } else {
      if (videos.length && !containers.length) {
        // Just the video elements were provided.
        for (const video of videos) {
          // If the app has already manually created a UI for this element,
          // don't create another one.
          if (video['ui']) {
            continue;
          }
          asserts.assert(
              video.tagName.toLowerCase() == 'video',
              'Should be a video element!');
          const container = document.createElement('div');
          const videoParent = video.parentElement;
          videoParent.replaceChild(container, video);
          container.appendChild(video);
          Overlay.setupUIandAutoLoad_(container, video);
        }
      } else {
        for (const container of containers) {
          // If the app has already manually created a UI for this element,
          // don't create another one.
          if (container['ui']) {
            continue;
          }
          asserts.assert(
              container.tagName.toLowerCase() == 'div',
              'Container should be a div!');
          let currentVideo = null;
          for (const video of videos) {
            asserts.assert(
                video.tagName.toLowerCase() == 'video',
                'Should be a video element!');
            if (video.parentElement == container) {
              currentVideo = video;
              break;
            }
          }
          if (!currentVideo) {
            currentVideo = document.createElement('video');
            currentVideo.setAttribute('playsinline', '');
            container.appendChild(currentVideo);
          }
          try {
            // eslint-disable-next-line no-await-in-loop
            await Overlay.setupUIandAutoLoad_(container, currentVideo);
          } catch (e) {
            // This can fail if, for example, not every player file has loaded.
            // Ad-block is a likely cause for this sort of failure.
            log.error('Error setting up Shaka Player', e);
            Overlay.dispatchLoadedEvent_(
                'shaka-ui-load-failed', FailReasonCode.PLAYER_FAILED_TO_LOAD);
            return;
          }
        }
      }
    }

    // After scanning the page for elements, fire the "loaded" event.  This will
    // let apps know they can use the UI library programmatically now, even if
    // they didn't have any Shaka-related elements declared in their HTML.
    Overlay.dispatchLoadedEvent_('shaka-ui-loaded');
  }

  private static dispatchLoadedEvent_(
      eventName: string, reasonCode?: FailReasonCode) {
    let detail = null;
    if (reasonCode != undefined) {
      detail = {'reasonCode': reasonCode};
    }
    const uiLoadedEvent = new CustomEvent(eventName, {detail});
    document.dispatchEvent(uiLoadedEvent);
  }

  private static async setupUIandAutoLoad_(container: Element, video: Element) {
    // Create the UI
    const player = new Player(Dom.asHTMLMediaElement(video));
    const ui = new Overlay(
        player, Dom.asHTMLElement(container), Dom.asHTMLMediaElement(video));

    // Get and configure cast app id.
    let castAppId = '';

    // Get and configure cast Android Receiver Compatibility
    let castAndroidReceiverCompatible = false;

    // Cast receiver id can be specified on either container or video.
    // It should not be provided on both. If it was, we will use the last
    // one we saw.
    if (container['dataset'] &&
        container['dataset']['shakaPlayerCastReceiverId']) {
      castAppId = container['dataset']['shakaPlayerCastReceiverId'];
      castAndroidReceiverCompatible =
          container['dataset']['shakaPlayerCastAndroidReceiverCompatible'] ===
          'true';
    } else {
      if (video['dataset'] && video['dataset']['shakaPlayerCastReceiverId']) {
        castAppId = video['dataset']['shakaPlayerCastReceiverId'];
        castAndroidReceiverCompatible =
            video['dataset']['shakaPlayerCastAndroidReceiverCompatible'] ===
            'true';
      }
    }
    if (castAppId.length) {
      ui.configure({
        castReceiverAppId: castAppId,
        castAndroidReceiverCompatible: castAndroidReceiverCompatible
      });
    }
    if (Dom.asHTMLMediaElement(video).controls) {
      ui.getControls().setEnabledNativeControls(true);
    }

    // Get the source and load it
    // Source can be specified either on the video element:
    //  <video src='foo.m2u8'></video>
    // or as a separate element inside the video element:
    //  <video>
    //    <source src='foo.m2u8'/>
    //  </video>
    // It should not be specified on both.
    const src = video.getAttribute('src');
    if (src) {
      const sourceElem = document.createElement('source');
      sourceElem.setAttribute('src', src);
      video.appendChild(sourceElem);
      video.removeAttribute('src');
    }
    for (const elem of video.querySelectorAll('source')) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await ui.getControls().getPlayer().load(elem.getAttribute('src'));
        break;
      } catch (e) {
        log.error('Error auto-loading asset', e);
      }
    }
  }
}

/**
 * Describes what information should show up in labels for selecting audio
 * variants and text tracks.
 *
 * @export
 */
export enum TrackLabelFormat {
  LANGUAGE,
  ROLE,
  LANGUAGE_ROLE,
  LABEL
}

/**
 * Describes the possible reasons that the UI might fail to load.
 *
 * @export
 */
export enum FailReasonCode {
  NO_BROWSER_SUPPORT,
  PLAYER_FAILED_TO_LOAD
}
if (document.readyState == 'complete') {
  // Don't fire this event synchronously.  In a compiled bundle, the "shaka"
  // namespace might not be exported to the window until after this point.

  (async () => {
    await Promise.resolve();
    Overlay.scanPageForShakaElements_();
  })();
} else {
  window.addEventListener('load', Overlay.scanPageForShakaElements_);
}
