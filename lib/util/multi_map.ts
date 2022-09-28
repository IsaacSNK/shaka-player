/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary A simple multimap template.
   * @template T
   */
  export class MultiMap<T> {
    private map_: { [key: string]: T[] } = {};

    /**
     * Add a key, value pair to the map.
     */
    push(key: string, value: T) {
      // eslint-disable-next-line no-prototype-builtins
      if (this.map_.hasOwnProperty(key)) {
        this.map_[key].push(value);
      } else {
        this.map_[key] = [value];
      }
    }

    /**
     * Get a list of values by key.
     * @return or null if no such key exists.
     */
    get(key: string): T[] | null {
      const list = this.map_[key];

      // slice() clones the list so that it and the map can each be modified
      // without affecting the other.
      return list ? list.slice() : null;
    }

    /**
     * Get a list of all values.
     */
    getAll(): T[] {
      const list: T[] = [];
      for (const key in this.map_) {
        list.push(...this.map_[key]);
      }
      return list;
    }

    /**
     * Remove a specific value, if it exists.
     */
    remove(key: string, value: T) {
      if (!(key in this.map_)) {
        return;
      }
      this.map_[key] = this.map_[key].filter((i) => i != value);
      if (this.map_[key].length == 0) {
        // Delete the array if it's empty, so that |get| will reliably return null
        // "if no such key exists", instead of sometimes returning an empty array.
        delete this.map_[key];
      }
    }

    /**
     * Clear all keys and values from the multimap.
     */
    clear() {
      this.map_ = {};
    }

    forEach(callback: (p1: string, p2: T[]) => any) {
      for (const key in this.map_) {
        callback(key, this.map_[key]);
      }
    }

    /**
     * Returns the number of elements in the multimap.
     */
    size(): number {
      return Object.keys(this.map_).length;
    }

    /**
     * Get a list of all the keys.
     */
    keys(): string[] {
      return Object.keys(this.map_);
    }
  }
}
