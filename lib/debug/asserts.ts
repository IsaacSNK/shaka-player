/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
 
/**
 * @summary An assertion framework which is compiled out for deployment.
 *   NOTE: this is not the closure library version.  This uses the same name so
 *   the closure compiler will be able to use the conditions to assist type
 *   checking.
 */ 
export class asserts {
   
  static assert(val: any, message: string) {
  }
}
 
/**
 * @define {boolean} true to enable asserts, false otherwise.
 */ 
export const ENABLE_ASSERTS: boolean = goog.DEBUG;
 
// Install assert functions. 
if (ENABLE_ASSERTS) {
  if (console.assert && console.assert.bind) {
     
    // eslint-disable-next-line no-restricted-syntax 
    asserts.assert = console.assert.bind(console);
  }
}
