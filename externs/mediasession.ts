/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for MediaSession based on
 * {@link https://bit.ly/2Id3dGD Editor's Draft, 12 January 2017}
 *
 *
 */
class MediaMetadata {
  title: string;
  artist: string;
  artwork: Object;

  constructor(options) {}
}

class MediaSession {
  metadata: MediaMetadata|null;
}
Navigator.prototype.mediaSession;
