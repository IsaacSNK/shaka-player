/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary A set of map/object utility functions.
   */
  export class MapUtils {
    /**
     * @template KEY,VALUE
     */
    static asMap<KEY, VALUE>(object: { [key: KEY]: VALUE }): Map<KEY, VALUE> {
      const map = new Map();
      for (const key of Object.keys(object)) {
        map.set(key, object[key]);
      }
      return map;
    }

    /**
     * @template KEY,VALUE
     */
    static asObject<KEY, VALUE>(map: Map<KEY, VALUE>): { [key: KEY]: VALUE } {
      const obj = {};
      map.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }

    /**
     * NOTE: This only works for simple value types and
     * will not be accurate if map values are objects!
     *
     * @template KEY,VALUE
     */
    static hasSameElements<KEY, VALUE>(
      map1: Map<KEY, VALUE>,
      map2: Map<KEY, VALUE>
    ): boolean {
      if (!map1 && !map2) {
        return true;
      } else {
        if (map1 && !map2) {
          return false;
        } else {
          if (map2 && !map1) {
            return false;
          }
        }
      }
      if (map1.size != map2.size) {
        return false;
      }
      for (const [key, val] of map1) {
        if (!map2.has(key)) {
          return false;
        }
        const val2 = map2.get(key);
        if (val2 != val || val2 == undefined) {
          return false;
        }
      }
      return true;
    }
  }
}
