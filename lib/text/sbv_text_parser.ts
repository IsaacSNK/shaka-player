/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as CueExports from './dev-workspace.shaka-player-fork.lib.text.cue';
import {Cue} from './dev-workspace.shaka-player-fork.lib.text.cue';
import * as TextEngineExports from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import {TextEngine} from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import * as StringUtilsExports from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {StringUtils} from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {TextParser} from './dev-workspace.shaka-player-fork.lib.util.text_parser';

/**
 * @export
 */
export class SbvTextParser implements shaka.
extern.TextParser {
  /**
   * @override
   * @export
   */
  parseInit(data) {
    asserts.assert(false, 'SubViewer does not have init segments');
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
    const SbvTextParser = SbvTextParser;
    const StringUtils = StringUtils;

    // Get the input as a string.
    const strFromData = StringUtils.fromUTF8(data);

    // remove dos newlines
    let str = strFromData.replace(/\r+/g, '');

    // trim white space start and end
    str = str.trim();
    const cues: shaka.extern.Cue[] = [];

    // Supports no cues
    if (str == '') {
      return cues;
    }

    // get cues
    const blocklist = str.split('\n\n');
    for (const block of blocklist) {
      const lines = block.split('\n');

      // Parse the times.
      const parser = new TextParser(lines[0]);
      const start = SbvTextParser.parseTime_(parser);
      const expect = parser.readRegex(/,/g);
      const end = SbvTextParser.parseTime_(parser);
      if (start == null || expect == null || end == null) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
            ErrorExports.Code.INVALID_TEXT_CUE,
            'Could not parse cue time range in SubViewer');
      }

      // Get the payload.
      const payload = lines.slice(1).join('\n').trim();
      const cue = new Cue(start, end, payload);
      cues.push(cue);
    }
    return cues;
  }

  /**
   * Parses a SubViewer time from the given parser.
   *
   */
  private static parseTime_(parser: TextParser): number|null {
    // 00:00.000 or 00:00:00.000 or 0:00:00.000 or
    // 00:00.00 or 00:00:00.00 or 0:00:00.00
    const regexExpresion = /(?:(\d{1,}):)?(\d{2}):(\d{2})\.(\d{2,3})/g;
    const results = parser.readRegex(regexExpresion);
    if (results == null) {
      return null;
    }

    // This capture is optional, but will still be in the array as undefined,
    // in which case it is 0.
    const hours = Number(results[1]) || 0;
    const minutes = Number(results[2]);
    const seconds = Number(results[3]);
    const milliseconds = Number(results[4]);
    if (minutes > 59 || seconds > 59) {
      return null;
    }
    return milliseconds / 1000 + seconds + minutes * 60 + hours * 3600;
  }
}
TextEngine.registerParser('text/x-subviewer', () => new SbvTextParser());
