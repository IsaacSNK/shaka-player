/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for screen properties not in the Closure compiler.
 *
 *
 */

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
//@ts-ignore
screen.lockOrientation = function(orientation: string): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
//@ts-ignore
screen.mozLockOrientation = function(orientation: string): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
//@ts-ignore
screen.msLockOrientation = function(orientation: string): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
//@ts-ignore
screen.unlockOrientation = function(): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
//@ts-ignore
screen.mozUnlockOrientation = function(): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
//@ts-ignore
screen.msUnlockOrientation = function(): boolean {};
