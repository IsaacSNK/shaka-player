/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import * as polyfillExports from './/all';
import {polyfill} from './/all';

/**
 * @summary A polyfill to provide PiP support in Safari.
 * Note that Safari only supports PiP on video elements, not audio.
 * @export
 */
export class PiPWebkit {
  /**
   * Install the polyfill if needed.
   * @export
   */
  static install() {
    if (!window.HTMLVideoElement) {
      // Avoid errors on very old browsers.
      return;
    }

    // eslint-disable-next-line no-restricted-syntax
    const proto = HTMLVideoElement.prototype;
    if (proto.requestPictureInPicture && document.exitPictureInPicture) {
      // No polyfill needed.
      return;
    }
    if (!proto.webkitSupportsPresentationMode) {
      // No Webkit PiP API available.
      return;
    }
    const PiPWebkit = PiPWebkit;
    log.debug('PiPWebkit.install');

    // Polyfill document.pictureInPictureEnabled.
    // It's definitely enabled now.  :-)
    document.pictureInPictureEnabled = true;

    // Polyfill document.pictureInPictureElement.
    // This is initially empty.  We don't need getter or setter because we don't
    // need any special handling when this is set.  We assume in good faith that
    // applications won't try to set this directly.
    document.pictureInPictureElement = null;

    // Polyfill HTMLVideoElement.requestPictureInPicture.
    proto.requestPictureInPicture = PiPWebkit.requestPictureInPicture_;

    // Polyfill HTMLVideoElement.disablePictureInPicture.
    Object.defineProperty(proto, 'disablePictureInPicture', {
      get: PiPWebkit.getDisablePictureInPicture_,
      set: PiPWebkit.setDisablePictureInPicture_,
      // You should be able to discover this property.
      enumerable: true,
      // And maybe we're not so smart.  Let someone else change it if they want.
      configurable: true
    });

    // Polyfill document.exitPictureInPicture.
    document.exitPictureInPicture = PiPWebkit.exitPictureInPicture_;

    // Use the "capturing" event phase to get the webkit presentation mode event
    // from the document.  This way, we get the event on its way from document
    // to the target element without having to intercept events in every
    // possible video element.
    document.addEventListener(
        'webkitpresentationmodechanged', PiPWebkit.proxyEvent_,
        /* useCapture= */
        true);
  }

  private static proxyEvent_(event: Event) {
    const PiPWebkit = PiPWebkit;
    const element = (event.target as HTMLVideoElement);
    if (element.webkitPresentationMode == PiPWebkit.PIP_MODE_) {
      // Keep track of the PiP element.  This element just entered PiP mode.
      document.pictureInPictureElement = element;

      // Dispatch a standard event to match.
      const event2 = new Event('enterpictureinpicture');
      element.dispatchEvent(event2);
    } else {
      // Keep track of the PiP element.  This element just left PiP mode.
      // If something else hasn't already take its place, clear it.
      if (document.pictureInPictureElement == element) {
        document.pictureInPictureElement = null;
      }

      // Dispatch a standard event to match.
      const event2 = new Event('leavepictureinpicture');
      element.dispatchEvent(event2);
    }
  }

  /**
   * @this {HTMLVideoElement}
   */
  private static requestPictureInPicture_(): Promise {
    const PiPWebkit = PiPWebkit;

    // NOTE: "this" here is the video element.

    // Check if PiP is enabled for this element.
    if (!this.webkitSupportsPresentationMode(PiPWebkit.PIP_MODE_)) {
      const error = new Error('PiP not allowed by video element');
      return Promise.reject(error);
    } else {
      // Enter PiP mode.
      this.webkitSetPresentationMode(PiPWebkit.PIP_MODE_);
      document.pictureInPictureElement = this;
      return Promise.resolve();
    }
  }

  /**
   * @this {Document}
   */
  private static exitPictureInPicture_(): Promise {
    const PiPWebkit = PiPWebkit;
    const pipElement = (document.pictureInPictureElement as HTMLVideoElement);
    if (pipElement) {
      // Exit PiP mode.
      pipElement.webkitSetPresentationMode(PiPWebkit.INLINE_MODE_);
      document.pictureInPictureElement = null;
      return Promise.resolve();
    } else {
      const error = new Error('No picture in picture element found');
      return Promise.reject(error);
    }
  }

  /**
   * @this {HTMLVideoElement}
   */
  private static getDisablePictureInPicture_(): boolean {
    // This respects the HTML attribute, which may have been set in HTML or
    // through the JS setter.
    if (this.hasAttribute('disablePictureInPicture')) {
      return true;
    }

    // Use Apple's non-standard API to know if PiP is allowed on this
    // device for this content. If not, say that PiP is disabled, even
    // if not specified by the user through the setter or HTML attribute.
    const PiPWebkit = PiPWebkit;
    return !this.webkitSupportsPresentationMode(PiPWebkit.PIP_MODE_);
  }

  /**
   * @this {HTMLVideoElement}
   */
  private static setDisablePictureInPicture_(value: boolean) {
    // This mimics how the JS setter works in browsers that implement the spec.
    if (value) {
      this.setAttribute('disablePictureInPicture', '');
    } else {
      this.removeAttribute('disablePictureInPicture');
    }
  }
}

/**
 * The presentation mode string used to indicate PiP mode in Safari.
 *
 */
export const PIP_MODE_: string = 'picture-in-picture';

/**
 * The presentation mode string used to indicate inline mode in Safari.
 *
 */
export const INLINE_MODE_: string = 'inline';
polyfill.register(PiPWebkit.install);
