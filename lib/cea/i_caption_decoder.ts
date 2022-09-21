/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as CueExports from './dev-workspace.shaka-player-fork.lib.text.cue';
import {Cue} from './dev-workspace.shaka-player-fork.lib.text.cue';

/**
 * Interface for decoding inband closed captions from packets.
 */
export class ICaptionDecoder {
  /**
   * Extracts packets and prepares them for decoding. In a given media fragment,
   * all the caption packets found in its SEI messages should be extracted by
   * successive calls to extract(), followed by a single call to decode().
   *
   * This is a User Data registered by Rec.ITU-T T.35 SEI message.
   * It is described in sections D.1.6 and D.2.6 of Rec. ITU-T H.264 (06/2019).
   * @param pts PTS when this packet was received, in seconds.
   */
  extract(userDataSeiMessage: Uint8Array, pts: number) {}

  /**
   * Decodes all currently extracted packets and then clears them.
   * This should be called once for a set of extracts (see comment on extract).
   */
  decode(): ClosedCaption[] {}

  /**
   * Clears the decoder state completely.
   * Should be used when an action renders the decoder state invalid,
   * e.g. unbuffered seeks.
   */
  clear() {}
}
type ClosedCaption = {
  cue: Cue,
  stream: string
};

export {ClosedCaption};
