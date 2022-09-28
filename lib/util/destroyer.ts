/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary
   * A utility class to help work with |shaka.util.IDestroyable| objects.
   *
   * @final
   */
  export class Destroyer {
    private destroyed_: boolean = false;
    private waitOnDestroy_: PublicPromise;
    private onDestroy_: () => Promise<any>;

    /**
     *    A callback to destroy an object. This callback will only be called once
     *    regardless of how many times |destroy| is called.
     */
    constructor(callback: () => Promise<any>) {
      this.waitOnDestroy_ = new shaka.util.PublicPromise();
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
    destroy(): Promise<any> {
      if (this.destroyed_) {
        //@ts-ignore
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
        }
      );
    }

    /**
     * Checks if the object is destroyed and throws an error if it is.
     * @param error The inner error, if any.
     */
    ensureNotDestroyed(error?: any) {
      if (this.destroyed_) {
        if (
          error instanceof shaka.util.Error &&
          error.code == shaka.util.Error.Code.OBJECT_DESTROYED
        ) {
          throw error;
        }
        throw shaka.util.Destroyer.destroyedError(error);
      }
    }

    /**
     * @param error The inner error, if any.
     */
    static destroyedError(error?: any): Error {
      return new shaka.util.Error(
        shaka.util.Error.Severity.CRITICAL,
        shaka.util.Error.Category.PLAYER,
        shaka.util.Error.Code.OBJECT_DESTROYED,
        error
      );
    }
  }
}
