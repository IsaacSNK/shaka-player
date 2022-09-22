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
const WebKitPlaybackTargetAvailabilityEvent = {};
HTMLMediaElement.prototype.webkitCurrentPlaybackTargetIsWireless;
HTMLMediaElement.prototype.webkitShowPlaybackTargetPicker = function() {};

class AirPlayEvent extends Event {
  availability: String;
}
