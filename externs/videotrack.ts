/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for VideoTrack which are missing from the Closure
 * compiler.
 *
 *
 */
class VideoTrack {
  selected: boolean;
  id: string;
  kind: string;
  label: string;
  language: string;
  sourceBuffer: SourceBuffer;
}

interface VideoTrackList extends IArrayLike<VideoTrack>, EventTarget {
  /** @override */
  addEventListener(type, listener, useCapture);

  /** @override */
  removeEventListener(type, listener, useCapture);

  /** @override */
  dispatchEvent(event);
}
HTMLMediaElement.prototype.videoTracks;
