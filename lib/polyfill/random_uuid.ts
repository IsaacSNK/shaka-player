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
 * @summary A polyfill to provide window.crypto.randomUUID in all browsers.
 * @export
 */
export class RandomUUID {
  /**
   * Install the polyfill if needed.
   * @export
   */
  static install() {
    log.debug('randomUUID.install');
    if (!window.crypto) {
      // See: https://caniuse.com/cryptography
      log.debug(
          'window.crypto must be available to install randomUUID polyfill.');
      return;
    }
    if ('randomUUID' in window.crypto) {
      log.debug('RandomUUID: Native window.crypto.randomUUID() support found.');
      return;
    }
    window.crypto.randomUUID = RandomUUID.randomUUID_;
  }

  private static randomUUID_(): string {
    const url = URL.createObjectURL(new Blob());
    const uuid = url.toString();
    URL.revokeObjectURL(url);
    return uuid.substr(uuid.lastIndexOf('/') + 1);
  }
}
polyfill.register(RandomUUID.install);
