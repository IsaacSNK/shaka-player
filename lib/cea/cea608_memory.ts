/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as CeaUtilsExports from './dev-workspace.shaka-player-fork.lib.cea.cea_utils';
import {CeaUtils} from './dev-workspace.shaka-player-fork.lib.cea.cea_utils';
import * as ICaptionDecoderExports from './dev-workspace.shaka-player-fork.lib.cea.i_caption_decoder';
import {ICaptionDecoder} from './dev-workspace.shaka-player-fork.lib.cea.i_caption_decoder';
import * as CueExports from './dev-workspace.shaka-player-fork.lib.text.cue';
import {Cue} from './dev-workspace.shaka-player-fork.lib.text.cue';

/**
 * CEA-608 captions memory/buffer.
 */
export class Cea608Memory {
  /**
   * Buffer for storing decoded characters.
   *      */
  private rows_: CeaUtilsExports.StyledChar[][] = [];

  /**
   * Current row.
   */
  private row_: number = 1;

  /**
   * Number of rows in the scroll window. Used for rollup mode.
   */
  private scrollRows_: number = 0;

  /**
   * Field number.
   */
  private fieldNum_: number;

  /**
   * Channel number.
   */
  private channelNum_: number;
  private underline_: boolean = false;
  private italics_: boolean = false;
  private textColor_: string;
  private backgroundColor_: string;

  /**
   * @param fieldNum Field number.
   * @param channelNum Channel number.
   */
  constructor(fieldNum: number, channelNum: number) {
    this.fieldNum_ = fieldNum;
    this.channelNum_ = channelNum;
    this.textColor_ = CeaUtilsExports.DEFAULT_TXT_COLOR;
    this.backgroundColor_ = CeaUtilsExports.DEFAULT_BG_COLOR;
    this.reset();
  }

  /**
   * Emits a closed caption based on the state of the buffer.
   * @param startTime Start time of the cue.
   * @param endTime End time of the cue.
   */
  forceEmit(startTime: number, endTime: number):
      ICaptionDecoderExports.ClosedCaption|null {
    const stream = `CC${this.fieldNum_ << 1 | this.channelNum_ + 1}`;
    const topLevelCue = new Cue(
        startTime, endTime,
        /* payload= */
        '');
    return CeaUtils.getParsedCaption(
        topLevelCue, stream, this.rows_, startTime, endTime);
  }

  /**
   * Resets the memory buffer.
   */
  reset() {
    this.resetAllRows();
    this.row_ = 1;
  }

  getRow(): number {
    return this.row_;
  }

  setRow(row: number) {
    this.row_ = row;
  }

  getScrollSize(): number {
    return this.scrollRows_;
  }

  setScrollSize(scrollRows: number) {
    this.scrollRows_ = scrollRows;
  }

  /**
   * Adds a character to the buffer.
   * @param set Character set.
   * @param b CC byte to add.
   */
  addChar(set: CharSet, b: number) {
    // Valid chars are in the range [0x20, 0x7f]
    if (b < 32 || b > 127) {
      return;
    }
    let char = '';
    switch (set) {
      case CharSet.BASIC_NORTH_AMERICAN:
        if (CharSet.BasicNorthAmericanChars.has(b)) {
          char = CharSet.BasicNorthAmericanChars.get(b);
        } else {
          // Regular ASCII
          char = String.fromCharCode(b);
        }
        break;
      case CharSet.SPECIAL_NORTH_AMERICAN:
        char = CharSet.SpecialNorthAmericanChars.get(b);
        break;
      case CharSet.SPANISH_FRENCH:

        // Extended charset does a BS over preceding char, 6.4.2 EIA-608-B.
        this.eraseChar();
        char = CharSet.ExtendedSpanishFrench.get(b);
        break;
      case CharSet.PORTUGUESE_GERMAN:
        this.eraseChar();
        char = CharSet.ExtendedPortugueseGerman.get(b);
        break;
    }
    if (char) {
      const styledChar = new CeaUtilsExports.StyledChar(
          char, this.underline_, this.italics_, this.backgroundColor_,
          this.textColor_);
      this.rows_[this.row_].push(styledChar);
    }
  }

  /**
   * Erases a character from the buffer.
   */
  eraseChar() {
    this.rows_[this.row_].pop();
  }

  /**
   * Moves rows of characters.
   * @param dst Destination row index.
   * @param src Source row index.
   * @param count Count of rows to move.
   */
  moveRows(dst: number, src: number, count: number) {
    if (dst >= src) {
      for (let i = count - 1; i >= 0; i--) {
        this.rows_[dst + i] = this.rows_[src + i].map((e) => e);
      }
    } else {
      for (let i = 0; i < count; i++) {
        this.rows_[dst + i] = this.rows_[src + i].map((e) => e);
      }
    }
  }

  /**
   * Resets rows of characters.
   * @param idx Starting index.
   * @param count Count of rows to reset.
   */
  resetRows(idx: number, count: number) {
    for (let i = 0; i <= count; i++) {
      this.rows_[idx + i] = [];
    }
  }

  /**
   * Resets the entire memory buffer.
   */
  resetAllRows() {
    this.resetRows(0, CC_ROWS);
  }

  /**
   * Erases entire memory buffer.
   * Doesn't change scroll state or number of rows.
   */
  eraseBuffer() {
    this.row_ = this.scrollRows_ > 0 ? this.scrollRows_ : 0;
    this.resetAllRows();
  }

  setUnderline(underline: boolean) {
    this.underline_ = underline;
  }

  setItalics(italics: boolean) {
    this.italics_ = italics;
  }

  setTextColor(color: string) {
    this.textColor_ = color;
  }

  setBackgroundColor(color: string) {
    this.backgroundColor_ = color;
  }
}

/**
 * Maximum number of rows in the buffer.
 */
export const CC_ROWS: number = 15;

/**
 * Characters sets.
 *  */
export enum CharSet {
  BASIC_NORTH_AMERICAN,
  SPECIAL_NORTH_AMERICAN,
  SPANISH_FRENCH,
  PORTUGUESE_GERMAN
}

/**
 * Basic North American char set deviates from ASCII with these exceptions.
 *  */
CharSet.BasicNorthAmericanChars = new Map([
  [39, '\u2019'], [42, '\u00e1'], [92, '\u00e9'], [92, '\u00e9'],
  [94, '\u00ed'], [95, '\u00f3'], [96, '\u00fa'], [123, '\u00e7'],
  [124, '\u00f7'], [125, '\u00d1'], [126, '\u00f1'], [127, '\u2588']
]);

/**
 * Special North American char set.
 * Note: Transparent Space is currently implemented as a regular space.
 *  */
CharSet.SpecialNorthAmericanChars = new Map([
  [48, '\u00ae'], [49, '\u00b0'], [50, '\u00bd'], [51, '\u00bf'],
  [52, '\u2122'], [53, '\u00a2'], [54, '\u00a3'], [55, '\u266a'],
  [56, '\u00e0'], [57, '\u2800'], [58, '\u00e8'], [59, '\u00e2'],
  [60, '\u00ea'], [61, '\u00ee'], [62, '\u00f4'], [63, '\u00fb']
]);

/**
 * Extended Spanish/Misc/French char set.
 *  */
CharSet.ExtendedSpanishFrench = new Map([
  [32, '\u00c1'], [33, '\u00c9'], [34, '\u00d3'], [35, '\u00da'],
  [36, '\u00dc'], [37, '\u00fc'], [38, '\u2018'], [39, '\u00a1'],
  [40, '*'],      [41, '\''],     [42, '\u2500'], [43, '\u00a9'],
  [44, '\u2120'], [45, '\u00b7'], [46, '\u201c'], [47, '\u201d'],
  [48, '\u00c0'], [49, '\u00c2'], [50, '\u00c7'], [51, '\u00c8'],
  [52, '\u00ca'], [53, '\u00cb'], [54, '\u00eb'], [55, '\u00ce'],
  [56, '\u00cf'], [57, '\u00ef'], [58, '\u00d4'], [59, '\u00d9'],
  [60, '\u00f9'], [61, '\u00db'], [62, '\u00ab'], [63, '\u00bb']
]);

/**
 * Extended Portuguese/German/Danish char set.
 *  */
CharSet.ExtendedPortugueseGerman = new Map([
  [32, '\u00c3'], [33, '\u00e3'], [34, '\u00cd'], [35, '\u00cc'],
  [36, '\u00ec'], [37, '\u00d2'], [38, '\u00f2'], [39, '\u00d5'],
  [40, '\u00f5'], [41, '{'],      [42, '}'],      [43, '\\'],
  [44, '^'],      [45, '_'],      [46, '|'],      [47, '~'],
  [48, '\u00c4'], [49, '\u00e4'], [50, '\u00d6'], [51, '\u00f6'],
  [52, '\u00df'], [53, '\u00a5'], [54, '\u00a4'], [55, '\u2502'],
  [56, '\u00c5'], [57, '\u00e5'], [58, '\u00d8'], [59, '\u00f8'],
  [60, '\u250c'], [61, '\u2510'], [62, '\u2514'], [63, '\u2518']
]);
