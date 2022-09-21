/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Timer} from './util___timer';

/**
 * A wrapper for platform-specific functions.
 *
 * @final
 */
export class Platform {
  /**
   * Check if the current platform supports media source. We assume that if
   * the current platform supports media source, then we can use media source
   * as per its design.
   *
   */
  static supportsMediaSource(): boolean {
    // Browsers that lack a media source implementation will have no reference
    // to |window.MediaSource|. Platforms that we see having problematic media
    // source implementations will have this reference removed via a polyfill.
    if (!window.MediaSource) {
      return false;
    }

    // Some very old MediaSource implementations didn't have isTypeSupported.
    if (!MediaSource.isTypeSupported) {
      return false;
    }
    return true;
  }

  /**
   * Returns true if the media type is supported natively by the platform.
   *
   */
  static supportsMediaType(mimeType: string): boolean {
    const video = Platform.anyMediaElement();
    return video.canPlayType(mimeType) != '';
  }

  /**
   * Check if the current platform is MS Edge.
   *
   */
  static isEdge(): boolean {
    // Legacy Edge contains "Edge/version".
    // Chromium-based Edge contains "Edg/version" (no "e").
    if (navigator.userAgent.match(/Edge?\//)) {
      return true;
    }
    return false;
  }

  /**
   * Check if the current platform is Legacy Edge.
   *
   */
  static isLegacyEdge(): boolean {
    // Legacy Edge contains "Edge/version".
    // Chromium-based Edge contains "Edg/version" (no "e").
    if (navigator.userAgent.match(/Edge\//)) {
      return true;
    }
    return false;
  }

  /**
   * Check if the current platform is MS IE.
   *
   */
  static isIE(): boolean {
    return Platform.userAgentContains_('Trident/');
  }

  /**
   * Check if the current platform is an Xbox One.
   *
   */
  static isXboxOne(): boolean {
    return Platform.userAgentContains_('Xbox One');
  }

  /**
   * Check if the current platform is a Tizen TV.
   *
   */
  static isTizen(): boolean {
    return Platform.userAgentContains_('Tizen');
  }

  /**
   * Check if the current platform is a Tizen 4 TV.
   *
   */
  static isTizen4(): boolean {
    return Platform.userAgentContains_('Tizen 4');
  }

  /**
   * Check if the current platform is a Tizen 3 TV.
   *
   */
  static isTizen3(): boolean {
    return Platform.userAgentContains_('Tizen 3');
  }

  /**
   * Check if the current platform is a Tizen 2 TV.
   *
   */
  static isTizen2(): boolean {
    return Platform.userAgentContains_('Tizen 2');
  }

  /**
   * Check if the current platform is a WebOS.
   *
   */
  static isWebOS(): boolean {
    return Platform.userAgentContains_('Web0S');
  }

  /**
   * Check if the current platform is a WebOS 3.
   *
   */
  static isWebOS3(): boolean {
    // See: http://webostv.developer.lge.com/discover/specifications/web-engine/
    return Platform.userAgentContains_('Web0S') &&
        Platform.userAgentContains_('Chrome/38.0.2125.122 Safari/537.36');
  }

  /**
   * Check if the current platform is a Google Chromecast.
   *
   */
  static isChromecast(): boolean {
    return Platform.userAgentContains_('CrKey');
  }

  /**
   * Check if the current platform is a Android-based Cast devices.
   *
   */
  static isAndroidCastDevice(): boolean {
    return Platform.isChromecast() && Platform.userAgentContains_('Android');
  }

  /**
   * Check if the current platform is Google Chrome.
   *
   */
  static isChrome(): boolean {
    // The Edge user agent will also contain the "Chrome" keyword, so we need
    // to make sure this is not Edge.
    return Platform.userAgentContains_('Chrome') && !Platform.isEdge();
  }

  /**
   * Check if the current platform is from Apple.
   *
   * Returns true on all iOS browsers and on desktop Safari.
   *
   * Returns false for non-Safari browsers on macOS, which are independent of
   * Apple.
   *
   */
  static isApple(): boolean {
    return !!navigator.vendor && navigator.vendor.includes('Apple') &&
        !Platform.isTizen() && !Platform.isEOS() && !Platform.isPS4() &&
        !Platform.isAmazonFireTV();
  }

  /**
   * Check if the current platform is Playstation 5.
   *
   * Returns true on Playstation 5 browsers.
   *
   * Returns false for Playstation 5 browsers
   *
   */
  static isPS5(): boolean {
    return Platform.userAgentContains_('PlayStation 5');
  }

  /**
   * Check if the current platform is Playstation 4.
   */
  static isPS4() {
    return Platform.userAgentContains_('PlayStation 4');
  }

  /**
   * Check if the current platform is Amazon Fire TV.
   * https://developer.amazon.com/docs/fire-tv/identify-amazon-fire-tv-devices.html
   *
   */
  static isAmazonFireTV(): boolean {
    return Platform.userAgentContains_('AFT');
  }

  /**
   * Returns a major version number for Safari, or Safari-based iOS browsers.
   *
   * For example:
   *   - Safari 13.0.4 on macOS returns 13.
   *   - Safari on iOS 13.3.1 returns 13.
   *   - Chrome on iOS 13.3.1 returns 13 (since this is based on Safari/WebKit).
   *   - Chrome on macOS returns null (since this is independent of Apple).
   *
   * Returns null on Firefox on iOS, where this version information is not
   * available.
   *
   * @return A major version number or null if not iOS.
   */
  static safariVersion(): number|null {
    // All iOS browsers and desktop Safari will return true for isApple().
    if (!Platform.isApple()) {
      return null;
    }

    // This works for iOS Safari and desktop Safari, which contain something
    // like "Version/13.0" indicating the major Safari or iOS version.
    let match = navigator.userAgent.match(/Version\/(\d+)/);
    if (match) {
      return parseInt(
          match[1],
          /* base= */
          10);
    }

    // This works for all other browsers on iOS, which contain something like
    // "OS 13_3" indicating the major & minor iOS version.
    match = navigator.userAgent.match(/OS (\d+)(?:_\d+)?/);
    if (match) {
      return parseInt(
          match[1],
          /* base= */
          10);
    }
    return null;
  }

  /**
   * Check if the current platform is Apple Safari
   * or Safari-based iOS browsers.
   *
   */
  static isSafari(): boolean {
    return !!Platform.safariVersion();
  }

  /**
   * Check if the current platform is an EOS set-top box.
   *
   */
  static isEOS(): boolean {
    return Platform.userAgentContains_('PC=EOS');
  }

  /**
   * Guesses if the platform is a mobile one (iOS or Android).
   *
   */
  static isMobile(): boolean {
    if (/(?:iPhone|iPad|iPod|Android)/.test(navigator.userAgent)) {
      // This is Android, iOS, or iPad < 13.
      return true;
    }

    // Starting with iOS 13 on iPad, the user agent string no longer has the
    // word "iPad" in it.  It looks very similar to desktop Safari.  This seems
    // to be intentional on Apple's part.
    // See: https://forums.developer.apple.com/thread/119186
    // So if it's an Apple device with multi-touch support, assume it's a mobile
    // device.  If some future iOS version starts masking their user agent on
    // both iPhone & iPad, this clause should still work.  If a future
    // multi-touch desktop Mac is released, this will need some adjustment.
    // As of January 2020, this is mainly used to adjust the default UI config
    // for mobile devices, so it's low risk if something changes to break this
    // detection.
    return Platform.isApple() && navigator.maxTouchPoints > 1;
  }

  /**
   * Check if the user agent contains a key. This is the best way we know of
   * right now to detect platforms. If there is a better way, please send a
   * PR.
   *
   */
  private static userAgentContains_(key: string): boolean {
    const userAgent = navigator.userAgent || '';
    return userAgent.includes(key);
  }

  /**
   * For canPlayType queries, we just need any instance.
   *
   * First, use a cached element from a previous query.
   * Second, search the page for one.
   * Third, create a temporary one.
   *
   * Cached elements expire in one second so that they can be GC'd or removed.
   *
   */
  static anyMediaElement(): HTMLMediaElement {
    const Platform = Platform;
    if (Platform.cachedMediaElement_) {
      return Platform.cachedMediaElement_;
    }
    if (!Platform.cacheExpirationTimer_) {
      Platform.cacheExpirationTimer_ = new Timer(() => {
        Platform.cachedMediaElement_ = null;
      });
    }
    Platform.cachedMediaElement_ =
        (document.getElementsByTagName('video')[0] ||
         document.getElementsByTagName('audio')[0] as HTMLMediaElement);
    if (!Platform.cachedMediaElement_) {
      Platform.cachedMediaElement_ =
          (document.createElement('video') as HTMLMediaElement);
    }
    Platform.cacheExpirationTimer_.tickAfter(
        /* seconds= */
        1);
    return Platform.cachedMediaElement_;
  }

  /**
   * Returns true if the platform requires encryption information in all init
   * segments.  For such platforms, MediaSourceEngine will attempt to work
   * around a lack of such info by inserting fake encryption information into
   * initialization segments.
   *
   * @see https://github.com/shaka-project/shaka-player/issues/2759
   */
  static requiresEncryptionInfoInAllInitSegments(): boolean {
    const Platform = Platform;
    return Platform.isTizen() || Platform.isXboxOne();
  }

  /**
   * Returns true if MediaKeys is polyfilled
   *
   */
  static isMediaKeysPolyfilled(): boolean {
    if (window.shakaMediaKeysPolyfill) {
      return true;
    }
    return false;
  }
}

export const cacheExpirationTimer_: Timer = null;

export const cachedMediaElement_: HTMLMediaElement = null;
