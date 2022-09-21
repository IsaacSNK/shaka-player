/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
 
/**
 * @namespace shaka.util.ArrayUtils
 * @summary Array utility functions.
 */ 
export class ArrayUtils {
   
  /**
     * Returns whether the two values contain the same value.  This correctly
     * handles comparisons involving NaN.
     * @template T
     */ 
  static defaultEquals(a: T, b: T): boolean {
     
    // NaN !== NaN, so we need to special case it. 
    if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) {
      return true;
    }
    return a === b;
  }
   
  /**
     * Remove given element from array (assumes no duplicates).
     * @template T
     */ 
  static remove(array: T[], element: T) {
    const index = array.indexOf(element);
    if (index > -1) {
      array.splice(index, 1);
    }
  }
   
  /**
     * Count the number of items in the list that pass the check function.
     * @template T
     */ 
  static count(array: T[], check: (p1: T) => boolean): number {
    let count = 0;
    for (const element of array) {
      count += check(element) ? 1 : 0;
    }
    return count;
  }
   
  /**
     * Determines if the given arrays contain equal elements in any order.
     *
     * @template T
     */ 
  static hasSameElements(a: T[], b: T[], compareFn?: (p1: T, p2: T) => boolean): boolean {
    if (!compareFn) {
      compareFn = ArrayUtils.defaultEquals;
    }
    if (a.length != b.length) {
      return false;
    }
    const copy = b.slice();
    for (const item of a) {
      const idx = copy.findIndex( 
      (other) => compareFn(item, other));
      if (idx == -1) {
        return false;
      }
       
      // Since order doesn't matter, just swap the last element with
      // this one and then drop the last element. 
      copy[idx] = copy[copy.length - 1];
      copy.pop();
    }
    return copy.length == 0;
  }
   
  /**
     * Determines if the given arrays contain equal elements in the same order.
     *
     * @template T
     */ 
  static equal(a: T[], b: T[], compareFn?: (p1: T, p2: T) => boolean): boolean {
    if (!compareFn) {
      compareFn = ArrayUtils.defaultEquals;
    }
    if (a.length != b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!compareFn(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
}
