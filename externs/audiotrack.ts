/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for AudioTrack which are missing from the Closure
 * compiler.
 *
 *
 */
class AudioTrack {
  enabled: boolean;
  id: string;
  kind: string;
  label: string;
  language: string;
  sourceBuffer: SourceBuffer;
}

interface AudioTrackList extends IArrayLike<AudioTrack>, EventTarget {
  /** @override */
  addEventListener(type, listener, useCapture);

  /** @override */
  removeEventListener(type, listener, useCapture);

  /** @override */
  dispatchEvent(event);
}
//@ts-ignore
HTMLMediaElement.prototype.audioTracks;
