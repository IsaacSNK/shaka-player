/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as TextEngineExports from './/text_engine';
import {TextEngine} from './/text_engine';
import * as TtmlTextParserExports from './/ttml_text_parser';
import {TtmlTextParser} from './/ttml_text_parser';
import * as ErrorExports from './../util/error';
import {Error} from './../util/error';
import * as Mp4ParserExports from './../util/mp4_parser';
import {Mp4Parser} from './../util/mp4_parser';

/**
 * @export
 */
export class Mp4TtmlParser implements shaka.
extern.TextParser {
  private parser_: shaka.extern.TextParser;

  constructor() {
    this.parser_ = new TtmlTextParser();
  }

  /**
   * @override
   * @export
   */
  parseInit(data) {
    const Mp4Parser = Mp4Parser;
    let sawSTPP = false;
    (new Mp4Parser())
        .box('moov', Mp4Parser.children)
        .box('trak', Mp4Parser.children)
        .box('mdia', Mp4Parser.children)
        .box('minf', Mp4Parser.children)
        .box('stbl', Mp4Parser.children)
        .fullBox('stsd', Mp4Parser.sampleDescription)
        .box(
            'stpp',
            (box) => {
              sawSTPP = true;
              box.parser.stop();
            })
        .parse(data);
    if (!sawSTPP) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_MP4_TTML);
    }
  }

  /**
   * @override
   * @export
   */
  setSequenceMode(sequenceMode) {}

  // Unused.
  /**
   * @override
   * @export
   */
  parseMedia(data, time) {
    const Mp4Parser = Mp4Parser;
    let sawMDAT = false;
    let payload = [];
    const parser = (new Mp4Parser()).box('mdat', Mp4Parser.allData((data) => {
      sawMDAT = true;

      // Join this to any previous payload, in case the mp4 has multiple
      // mdats.
      payload = payload.concat(this.parser_.parseMedia(data, time));
    }));
    parser.parse(
        data,
        /* partialOkay= */
        false);
    if (!sawMDAT) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_MP4_TTML);
    }
    return payload;
  }
}
TextEngine.registerParser(
    'application/mp4; codecs="stpp"', () => new Mp4TtmlParser());
TextEngine.registerParser(
    'application/mp4; codecs="stpp.ttml"', () => new Mp4TtmlParser());
TextEngine.registerParser(
    'application/mp4; codecs="stpp.ttml.im1t"', () => new Mp4TtmlParser());

// Legacy codec string uses capital "TTML", i.e.: prior to HLS rfc8216bis:
//   Note that if a Variant Stream specifies one or more Renditions that
//   include IMSC subtitles, the CODECS attribute MUST indicate this with a
//   format identifier such as "stpp.ttml.im1t".
// (https://tools.ietf.org/html/draft-pantos-hls-rfc8216bis-05#section-4.4.5.2)
TextEngine.registerParser(
    'application/mp4; codecs="stpp.TTML.im1t"', () => new Mp4TtmlParser());
