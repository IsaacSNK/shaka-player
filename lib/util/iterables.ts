/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * Recreations of Array-like functions so that they work on any iterable
   * type.
   * @final
   */
  export class Iterables {
    /**
     * @template FROM,TO
     */
    static map(
      iterable: Iterable<FROM>,
      mapping: (p1: FROM) => TO
    ): Iterable<TO> {
      const array = [];
      for (const x of iterable) {
        array.push(mapping(x));
      }
      return array;
    }

    /**
     * @template T
     */
    static every(iterable: Iterable<T>, test: (p1: T) => boolean): boolean {
      for (const x of iterable) {
        if (!test(x)) {
          return false;
        }
      }
      return true;
    }

    /**
     * @template T
     */
    static some(iterable: Iterable<T>, test: (p1: T) => boolean): boolean {
      for (const x of iterable) {
        if (test(x)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Iterate over an iterable object and return only the items that |filter|
     * returns true for.
     *
     * @template T
     */
    static filter(iterable: Iterable<T>, filter: (p1: T) => boolean): T[] {
      const out = [];
      for (const x of iterable) {
        if (filter(x)) {
          out.push(x);
        }
      }
      return out;
    }
  }
}
