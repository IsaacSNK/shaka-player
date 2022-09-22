/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './../debug/log';
import {log} from './../debug/log';

/**
 * @summary A one-stop installer for all polyfills.
 * @see http://enwp.org/polyfill
 * @export
 */
export class polyfill {
  /**
   * Install all polyfills.
   * @export
   */
  static installAll() {
    for (const polyfill of polyfills_) {
      try {
        polyfill.callback();
      } catch (error) {
        log.alwaysWarn('Error installing polyfill!', error);
      }
    }
  }

  /**
   * Registers a new polyfill to be installed.
   *
   * @param priority An optional number priority.  Higher priorities
   *   will be executed before lower priority ones.  Default is 0.
   * @export
   */
  static register(polyfill: () => any, priority?: number) {
    const newItem = {priority: priority || 0, callback: polyfill};
    for (let i = 0; i < polyfills_.length; i++) {
      const item = polyfills_[i];
      if (item.priority < newItem.priority) {
        polyfills_.splice(i, 0, newItem);
        return;
      }
    }
    polyfills_.push(newItem);
  }
}

/**
 * Contains the polyfills that will be installed.
 */
export const polyfills_: {priority: number, callback: () => any}[] = [];
