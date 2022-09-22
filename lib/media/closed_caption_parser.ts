/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as CeaDecoderExports from './../cea/cea_decoder';
import {CeaDecoder} from './../cea/cea_decoder';
import * as ICaptionDecoderExports from './../cea/i_caption_decoder';
import {ICaptionDecoder} from './../cea/i_caption_decoder';
import * as ICeaParserExports from './../cea/i_cea_parser';
import {ICeaParser} from './../cea/i_cea_parser';
import {Mp4CeaParser} from './../cea/mp4_cea_parser';
import {BufferUtils} from './../util/buffer_utils';

/**
 * The IClosedCaptionParser defines the interface to provide all operations for
 * parsing the closed captions embedded in Dash videos streams.
 * TODO: Remove this interface and move method definitions
 * directly to ClosedCaptonParser.
 */
export class IClosedCaptionParser {
  /**
   * Initialize the caption parser. This should be called only once.
   */
  init(initSegment: BufferSource) {}

  /**
   * Parses embedded CEA closed captions and interacts with the underlying
   * CaptionStream, and calls the callback function when there are closed
   * captions.
   *
   * An array of parsed closed captions.
   */
  parseFrom(mediaFragment: BufferSource):
      ICaptionDecoderExports.ClosedCaption[] {}

  /**
   * Resets the CaptionStream.
   */
  reset() {}
}

/**
 * Closed Caption Parser provides all operations for parsing the closed captions
 * embedded in Dash videos streams.
 *
 * @final
 */
export class ClosedCaptionParser implements IClosedCaptionParser {
  /**
   * MP4 Parser to extract closed caption packets from H.264 video.
   */
  private ceaParser_: ICeaParser;

  /**
   * Decoder for decoding CEA-X08 data from closed caption packets.
   */
  private ceaDecoder_: ICaptionDecoder;

  constructor() {
    this.ceaParser_ = new Mp4CeaParser();
    this.ceaDecoder_ = new CeaDecoder();
  }

  /**
   * @override
   */
  init(initSegment) {
    this.ceaParser_.init(initSegment);
  }

  /**
   * @override
   */
  parseFrom(mediaFragment) {
    // Parse the fragment.
    const captionPackets = this.ceaParser_.parse(mediaFragment);

    // Extract the caption packets for decoding.
    for (const captionPacket of captionPackets) {
      const uint8ArrayData = BufferUtils.toUint8(captionPacket.packet);
      if (uint8ArrayData.length > 0) {
        this.ceaDecoder_.extract(uint8ArrayData, captionPacket.pts);
      }
    }

    // Decode and return the parsed captions.
    return this.ceaDecoder_.decode();
  }

  /**
   * @override
   */
  reset() {
    this.ceaDecoder_.clear();
  }
}
