/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for mux.js library.
 *
 */
declare namespace muxjs.mp4 {
  class probe {
    /**
     * Parses an MP4 initialization segment and extracts the timescale
     * values for any declared tracks.
     *
     * @param init The bytes of the init segment
     * @return a hash of track ids to timescale
     * values or null if the init segment is malformed.
     */
    static timescale(init: Uint8Array): { [key: number]: number };

    /**
     * Find the trackIds of the video tracks in this source.
     * Found by parsing the Handler Reference and Track Header Boxes:
     *
     * @param init The bytes of the init segment for this source
     * @return A list of trackIds
     **/
    static videoTrackIds(init: Uint8Array): number[];
  }
}
declare namespace muxjs.mp4 {
  class Transmuxer {
    constructor(options?: Object);

    setBaseMediaDecodeTime(time: number);

    push(data: Uint8Array);

    flush();

    /**
     * Add a handler for a specified event type.
     * @param type Event name
     * @param listener The callback to be invoked
     */
    on(type: string, listener: Function);

    /**
     * Remove a handler for a specified event type.
     * @param type Event name
     * @param listener The callback to be removed
     */
    off(type: string, listener: Function);

    /** Remove all handlers and clean up. */
    dispose();
  }
}

/**
 *  metadata
 * @exportDoc
 */
declare namespace muxjs.mp4.Transmuxer {
  export interface Segment {
    initSegment: Uint8Array;
    data: Uint8Array;
    // @ts-ignore
    captions: Array;
    // @ts-ignore
    metadata: Array;
  }
}
declare namespace muxjs.mp4 {
  class CaptionParser {
    /**
     * Parser for CEA closed captions embedded in video streams for Dash.
     *
     * @struct
     */
    constructor();

    /** Initializes the closed caption parser. */
    init();

    /**
     * Return true if a new video track is selected or if the timescale is
     * changed.
     * @param videoTrackIds A list of video tracks found in the
     *    init segment.
     * @param timescales The map of track Ids and the
     *    tracks' timescales in the init segment.
     */
    isNewInit(
      videoTrackIds: number[],
      timescales: { [key: number]: number }
    ): boolean;

    /**
     * Parses embedded CEA closed captions and interacts with the underlying
     * CaptionStream, and return the parsed captions.
     * @param segment The fmp4 segment containing embedded captions
     * @param videoTrackIds A list of video tracks found in the
     *    init segment.
     * @param timescales The timescales found in the
     *    init segment.
     */
    parse(
      segment: Uint8Array,
      videoTrackIds: number[],
      timescales: { [key: number]: number }
    ): muxjs.mp4.ParsedClosedCaptions;

    /** Clear the parsed closed captions data for new data. */
    clearParsedCaptions();

    /** Reset the captions stream. */
    resetCaptionStream();
  }
}

/**
 *  captions
 */
declare namespace muxjs.mp4 {
  export interface ParsedClosedCaptions {
    captionStreams: { [key: string]: boolean };
    captions: muxjs.mp4.ClosedCaption[];
  }
}
/**
 *  text The content of the closed caption.
 */
declare namespace muxjs.mp4 {
  export interface ClosedCaption {
    startPts: number;
    endPts: number;
    startTime: number;
    endTime: number;
    stream: string;
    text: string;
  }
}
/**
 *  pts
 */
declare namespace muxjs.mp4 {
  export interface Metadata {
    cueTime: number;
    data: Uint8Array;
    dispatchType: string;
    dts: number;
    frames: muxjs.mp4.MetadataFrame[];
    pts: number;
  }
}
/**
 *  value
 */
declare namespace muxjs.mp4 {
  export interface MetadataFrame {
    data: string;
    description: string;
    id: string;
    key: string;
    value: string;
  }
}
