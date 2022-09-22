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
screen.lockOrientation = function(orientation: string): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
screen.mozLockOrientation = function(orientation: string): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
screen.msLockOrientation = function(orientation: string): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
screen.unlockOrientation = function(): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
screen.mozUnlockOrientation = function(): boolean {};

/**
 * A deprecated method we are using in a polyfill.  Use with care!
 */
screen.msUnlockOrientation = function(): boolean {};
