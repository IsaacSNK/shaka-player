/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Interface for parsing inband closed caption data from MP4 streams.
 */
export interface ICeaParser {
  /**
   * Initializes the parser with init segment data.
   * @param initSegment init segment to parse.
   */
  init(initSegment: BufferSource);

  /**
   * Parses the stream and extracts closed captions packets.
   * @param mediaSegment media segment to parse.
   */
  parse(mediaSegment: BufferSource): CaptionPacket[] ;
}

/**
 * NALU type for Supplemental Enhancement Information (SEI).
 */
export const NALU_TYPE_SEI: number = 6;

/**
 * Default timescale value for a track.
 */
export const DEFAULT_TIMESCALE_VALUE = 90000;
type CaptionPacket = {
  packet: Uint8Array,
  pts: number
};

export {CaptionPacket};
