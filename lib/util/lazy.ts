/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary
   * This contains a single value that is lazily generated when it is first
   * requested.  This can store any value except "undefined".
   *
   * @template T
   */
  export class Lazy {
    private gen_: () => T;
    private value_: T | undefined = undefined;

    constructor(gen: () => T) {
      this.gen_ = gen;
    }

    value(): T {
      if (this.value_ == undefined) {
        // Compiler complains about unknown fields without this cast.
        this.value_ = this.gen_() as any;
        goog.asserts.assert(
          this.value_ != undefined,
          "Unable to create lazy value"
        );
      }
      return this.value_;
    }

    /** Resets the value of the lazy function, so it has to be remade. */
    reset() {
      this.value_ = undefined;
    }
  }
}
