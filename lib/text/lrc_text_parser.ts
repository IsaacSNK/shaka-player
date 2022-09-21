/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as CueExports from './dev-workspace.shaka-player-fork.lib.text.cue';
import {Cue} from './dev-workspace.shaka-player-fork.lib.text.cue';
import * as TextEngineExports from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import {TextEngine} from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import * as StringUtilsExports from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {StringUtils} from './dev-workspace.shaka-player-fork.lib.util.string_utils';

/**
 * LRC file format: https://en.wikipedia.org/wiki/LRC_(file_format)
 *
 * @export
 */
export class LrcTextParser implements shaka.
extern.TextParser {
  /**
   * @override
   * @export
   */
  parseInit(data) {
    asserts.assert(false, 'LRC does not have init segments');
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
    const StringUtils = StringUtils;
    const LrcTextParser = LrcTextParser;

    // Get the input as a string.
    const str = StringUtils.fromUTF8(data);
    let prevCue: shaka.extern.Cue = null;
    const cues: shaka.extern.Cue[] = [];
    const lines = str.split(/\r?\n/);
    for (const line of lines) {
      if (!line || /^\s+$/.test(line)) {
        continue;
      }

      // LRC content
      const match = LrcTextParser.lyricLine_.exec(line);
      if (match) {
        const startTime = LrcTextParser.parseTime_(match[1]);

        // This time can be overwritten by a subsequent cue.
        // By default we add 2 seconds of duration.
        const endTime = time.segmentEnd ? time.segmentEnd : startTime + 2;
        const payload = match[2];
        const cue = new Cue(startTime, endTime, payload);

        // Update previous
        if (prevCue) {
          prevCue.endTime = startTime;
          cues.push(prevCue);
        }
        prevCue = cue;
        continue;
      }
      log.warning('LrcTextParser encountered an unknown line.', line);
    }
    if (prevCue) {
      cues.push(prevCue);
    }
    return cues;
  }

  /**
   * Parses a LRC time from the given parser.
   *
   */
  private static parseTime_(string: string): number {
    const LrcTextParser = LrcTextParser;
    const match = LrcTextParser.timeFormat_.exec(string);
    const minutes = parseInt(match[1], 10);
    const seconds = parseFloat(match[2].replace(',', '.'));
    return minutes * 60 + seconds;
  }
}

/**
 * @example [00:12.0]Text or [00:12.00]Text or [00:12.000]Text or
 * [00:12,0]Text or [00:12,00]Text or [00:12,000]Text
 */
export const lyricLine_: RegExp = /^\[(\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)\](.*)/;

/**
 * @example 00:12.0 or 00:12.00 or 00:12.000 or
 * 00:12,0 or 00:12,00 or 00:12,000
 */
export const timeFormat_: RegExp = /^(\d+):(\d{1,2}(?:[.,]\d{1,3})?)$/;
TextEngine.registerParser(
    'application/x-subtitle-lrc', () => new LrcTextParser());
