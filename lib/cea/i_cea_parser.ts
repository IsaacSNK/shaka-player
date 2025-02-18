/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.cea {
  /**
   * Interface for parsing inband closed caption data from MP4 streams.
   */
  export class ICeaParser {
    /**
     * Initializes the parser with init segment data.
     * @param initSegment init segment to parse.
     */
    init(initSegment: BufferSource) {}

    /**
     * Parses the stream and extracts closed captions packets.
     * @param mediaSegment media segment to parse.
     */
    parse(mediaSegment: BufferSource): CaptionPacket[] {}
  }
}

namespace shaka.cea.ICeaParser {
  /**
   * NALU type for Supplemental Enhancement Information (SEI).
   */
  export const NALU_TYPE_SEI: number = 6;
}

namespace shaka.cea.ICeaParser {
  /**
   * Default timescale value for a track.
   */
  export const DEFAULT_TIMESCALE_VALUE = 90000;
}

export interface CaptionPacket {
  packet: Uint8Array;
  pts: number;
}

export { CaptionPacket };
