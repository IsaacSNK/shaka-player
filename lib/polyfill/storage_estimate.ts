/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as polyfillExports from './dev-workspace.shaka-player-fork.lib.polyfill.all';
import {polyfill} from './dev-workspace.shaka-player-fork.lib.polyfill.all';

/**
 * @summary A polyfill to provide navigator.storage.estimate in old
 * webkit browsers.
 * See:
 * https://developers.google.com/web/updates/2017/08/estimating-available-storage-space#the-present
 * @export
 */
export class StorageEstimate {
  /**
   * Install the polyfill if needed.
   * @export
   */
  static install() {
    if (navigator.storage && navigator.storage.estimate) {
      // No need.
      return;
    }
    if (navigator.webkitTemporaryStorage &&
        navigator.webkitTemporaryStorage.queryUsageAndQuota) {
      if (!('storage' in navigator)) {
        navigator.storage = ({} as StorageManager);
      }
      navigator.storage.estimate = StorageEstimate.storageEstimate_;
    }
  }

  /**
   * @this {StorageManager}
   */
  private static storageEstimate_(): Promise {
    return new Promise((resolve, reject) => {
      navigator.webkitTemporaryStorage.queryUsageAndQuota((usage, quota) => {
        resolve({usage: usage, quota: quota});
      }, reject);
    });
  }
}
polyfill.register(StorageEstimate.install);
