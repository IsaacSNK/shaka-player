/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import {PublicPromise} from './util___public_promise';

/**
 * @summary
 * A utility class to help work with |shaka.util.IDestroyable| objects.
 *
 * @final
 */
export class Destroyer {
  private destroyed_: boolean = false;
  private waitOnDestroy_: PublicPromise;
  private onDestroy_: () => Promise;

  /**
   *    A callback to destroy an object. This callback will only be called once
   *    regardless of how many times |destroy| is called.
   */
  constructor(callback: () => Promise) {
    this.waitOnDestroy_ = new PublicPromise();
    this.onDestroy_ = callback;
  }

  /**
   * Check if |destroy| has been called. This returning |true| does not mean
   * that the promise returned by |destroy| has resolved yet.
   *
   * @final
   */
  destroyed(): boolean {
    return this.destroyed_;
  }

  /**
   * Request that the destroy callback be called. Will return a promise that
   * will resolve once the callback terminates. The promise will never be
   * rejected.
   *
   * @final
   */
  destroy(): Promise {
    if (this.destroyed_) {
      return this.waitOnDestroy_;
    }

    // We have started destroying this object, so we should never get here
    // again.
    this.destroyed_ = true;
    return this.onDestroy_().then(
        () => {
          this.waitOnDestroy_.resolve();
        },
        () => {
          this.waitOnDestroy_.resolve();
        });
  }

  /**
   * Checks if the object is destroyed and throws an error if it is.
   * @param error The inner error, if any.
   */
  ensureNotDestroyed(error?: any) {
    if (this.destroyed_) {
      if (error instanceof Error &&
          error.code == ErrorExports.Code.OBJECT_DESTROYED) {
        throw error;
      }
      throw Destroyer.destroyedError(error);
    }
  }

  /**
   * @param error The inner error, if any.
   */
  static destroyedError(error?: any): Error {
    return new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
        ErrorExports.Code.OBJECT_DESTROYED, error);
  }
}
