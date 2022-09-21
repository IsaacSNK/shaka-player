/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as TextEngineExports from './text___text_engine';
import {TextEngine} from './text___text_engine';
import * as VttTextParserExports from './text___vtt_text_parser';
import {VttTextParser} from './text___vtt_text_parser';
import {BufferUtils} from './util___buffer_utils';
import * as StringUtilsExports from './util___string_utils';
import {StringUtils} from './util___string_utils';

/**
 * @export
 */
export class SrtTextParser implements shaka.
extern.TextParser {
  private parser_: shaka.extern.TextParser;

  constructor() {
    this.parser_ = new VttTextParser();
  }

  /**
   * @override
   * @export
   */
  parseInit(data) {
    asserts.assert(false, 'SRT does not have init segments');
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
    const SrtTextParser = SrtTextParser;
    const BufferUtils = BufferUtils;
    const StringUtils = StringUtils;

    // Get the input as a string.
    const str = StringUtils.fromUTF8(data);
    const vvtText = SrtTextParser.srt2webvtt(str);
    const newData = BufferUtils.toUint8(StringUtils.toUTF8(vvtText));
    return this.parser_.parseMedia(newData, time);
  }

  /**
   * Convert a SRT format to WebVTT
   *
   * @export
   */
  static srt2webvtt(data: string): string {
    const SrtTextParser = SrtTextParser;
    let result = 'WEBVTT\n\n';

    // Supports no cues
    if (data == '') {
      return result;
    }

    // remove dos newlines
    let srt = data.replace(/\r+/g, '');

    // trim white space start and end
    srt = srt.trim();

    // get cues
    const cuelist = srt.split('\n\n');
    for (const cue of cuelist) {
      result += SrtTextParser.convertSrtCue_(cue);
    }
    return result;
  }

  /**
   * Convert a SRT cue into WebVTT cue
   *
   */
  private static convertSrtCue_(caption: string): string {
    const lines = caption.split(/\n/);

    // detect and skip numeric identifier
    if (lines[0].match(/\d+/)) {
      lines.shift();
    }

    // convert time codes
    lines[0] = lines[0].replace(/,/g, '.');
    return lines.join('\n') + '\n\n';
  }
}
TextEngine.registerParser('text/srt', () => new SrtTextParser());
