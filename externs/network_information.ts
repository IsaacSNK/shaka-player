/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for NetworkInformation which were missing in the
 * Closure compiler.
 *
 *
 */
//@ts-ignore
NetworkInformation.prototype.saveData;
//@ts-ignore
NetworkInformation.prototype.addEventListener = function(
    type: string, listener: Function) {};
