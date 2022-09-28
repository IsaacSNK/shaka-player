/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for HTMLMediaElement which were missing in the
 * Closure compiler.
 *
 *
 */
// HTMLMediaElement.prototype.webkitCurrentPlaybackTargetIsWireless;
// HTMLMediaElement.prototype.webkitShowPlaybackTargetPicker = function () {};

declare class AirPlayEvent extends Event {
  availability: String;
}
