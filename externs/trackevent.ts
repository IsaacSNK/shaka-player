/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for the TrackEvent interface.
 *
 *
 * TODO: Remove once this is available from the compiler.
 */
export class TrackEvent extends Event {
  track: AudioTrack|TextTrack|VideoTrack;
}
