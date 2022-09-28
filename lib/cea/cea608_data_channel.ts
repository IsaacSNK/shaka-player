/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.cea.ICaptionDecoder");

namespace shaka.cea {
  /**
   * 608 closed captions channel.
   */
  export class Cea608DataChannel {
    /**
     * Current Caption Type.
     */
    type_: CaptionType;

    /**
     * Text buffer for CEA-608 "text mode". Although, we don't emit text mode.
     * So, this buffer serves as a no-op placeholder, just in case we receive
     * captions that toggle text mode.
     *      */
    private text_: Cea608Memory;

    /**
     * Displayed memory.
     */
    private displayedMemory_: Cea608Memory;

    /**
     * Non-displayed memory.
     */
    private nonDisplayedMemory_: Cea608Memory;

    /**
     * Points to current buffer.
     */
    private curbuf_: Cea608Memory;

    /**
     * End time of the previous caption, serves as start time of next caption.
     */
    private prevEndTime_: number = 0;

    /**
     * Last control pair, 16 bits representing byte 1 and byte 2
     */
    private lastcp_: number | null = null;

    /**
     * @param fieldNum Field number.
     * @param channelNum Channel number.
     */
    constructor(fieldNum: number, channelNum: number) {
      this.type_ = shaka.cea.Cea608DataChannel.CaptionType.NONE;
      this.text_ = new shaka.cea.Cea608Memory(fieldNum, channelNum);
      this.displayedMemory_ = new shaka.cea.Cea608Memory(fieldNum, channelNum);
      this.nonDisplayedMemory_ = new shaka.cea.Cea608Memory(
        fieldNum,
        channelNum
      );
      this.curbuf_ = this.displayedMemory_;
    }

    /**
     * Resets channel state.
     */
    reset() {
      this.type_ = shaka.cea.Cea608DataChannel.CaptionType.PAINTON;
      this.curbuf_ = this.displayedMemory_;
      this.lastcp_ = null;
      this.displayedMemory_.reset();
      this.nonDisplayedMemory_.reset();
      this.text_.reset();
    }

    /**
     * Gets the row index from a Preamble Address Code byte pair.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     * @return Row index.
     */
    private pacToRow_(b1: number, b2: number): number {
      const ccrowtab = [
        11, 11,
        // 0x00 or 0x01
        1, 2,
        // 0x02 -> 0x03
        3, 4,
        // 0x04 -> 0x05
        12, 13,
        // 0x06 -> 0x07
        14, 15,
        // 0x08 -> 0x09
        5, 6,
        // 0x0A -> 0x0B
        7, 8,
        // 0x0C -> 0x0D
        9, 10,
      ];

      // 0x0E -> 0x0F
      return ccrowtab[((b1 & 7) << 1) | ((b2 >> 5) & 1)];
    }

    /**
     * PAC - Preamble Address Code.
     * b1 is of the form |P|0|0|1|C|0|ROW|
     * b2 is of the form |P|1|N|ATTRIBUTE|U|
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private controlPac_(b1: number, b2: number) {
      const row = this.pacToRow_(b1, b2);

      // Get attribute bits (4 bits)
      const attr = (b2 & 30) >> 1;

      // Set up the defaults.
      let textColor = shaka.cea.CeaUtils.DEFAULT_TXT_COLOR;
      let italics = false;

      // Attributes < 7 are colors, = 7 is white w/ italics, and >7 are indents
      if (attr < 7) {
        textColor = shaka.cea.Cea608DataChannel.TEXT_COLORS[attr];
      } else {
        if (attr === 7) {
          italics = true;
        }
      }

      // color stays white

      // PACs toggle underline on the last bit of b2.
      const underline = (b2 & 1) === 1;
      if (this.type_ === shaka.cea.Cea608DataChannel.CaptionType.TEXT) {
        // Don't execute the PAC if in text mode.
        return;
      }

      // Execute the PAC.
      const buf = this.curbuf_;

      // Move entire scroll window to a new base in rollup mode.
      if (
        this.type_ === shaka.cea.Cea608DataChannel.CaptionType.ROLLUP &&
        row !== buf.getRow()
      ) {
        const oldTopRow = 1 + buf.getRow() - buf.getScrollSize();
        const newTopRow = 1 + row - buf.getScrollSize();

        // Shift up the scroll window.
        buf.moveRows(newTopRow, oldTopRow, buf.getScrollSize());

        // Clear everything outside of the new scroll window.
        buf.resetRows(0, newTopRow - 1);
        buf.resetRows(row + 1, shaka.cea.Cea608Memory.CC_ROWS - row);
      }
      buf.setRow(row);
      this.curbuf_.setUnderline(underline);
      this.curbuf_.setItalics(italics);
      this.curbuf_.setTextColor(textColor);

      // Clear the background color, since new row (PAC) should reset ALL styles.
      this.curbuf_.setBackgroundColor(shaka.cea.CeaUtils.DEFAULT_BG_COLOR);
    }

    /**
     * Mid-Row control code handler.
     * @param b2 Byte #2.
     */
    private controlMidrow_(b2: number) {
      // Clear all pre-existing midrow style attributes.
      this.curbuf_.setUnderline(false);
      this.curbuf_.setItalics(false);
      this.curbuf_.setTextColor(shaka.cea.CeaUtils.DEFAULT_TXT_COLOR);

      // Mid-row attrs use a space.
      this.curbuf_.addChar(
        shaka.cea.Cea608Memory.CharSet.BASIC_NORTH_AMERICAN,
        " ".charCodeAt(0)
      );
      let textColor = shaka.cea.CeaUtils.DEFAULT_TXT_COLOR;
      let italics = false;

      // Midrow codes set underline on last (LSB) bit.
      const underline = (b2 & 1) === 1;

      // b2 has the form |P|0|1|0|STYLE|U|
      textColor = shaka.cea.Cea608DataChannel.TEXT_COLORS[(b2 & 14) >> 1];
      if (textColor === "white_italics") {
        textColor = "white";
        italics = true;
      }
      this.curbuf_.setUnderline(underline);
      this.curbuf_.setItalics(italics);
      this.curbuf_.setTextColor(textColor);
    }

    /**
     * Background attribute control code handler.
     * @param b1 Byte #1
     * @param b2 Byte #2.
     */
    private controlBackgroundAttribute_(b1: number, b2: number) {
      let backgroundColor = shaka.cea.CeaUtils.DEFAULT_BG_COLOR;
      if ((b1 & 7) === 0) {
        // If background provided, last 3 bits of b1 are |0|0|0|. Color is in b2.
        backgroundColor = shaka.cea.Cea608DataChannel.BG_COLORS[(b2 & 14) >> 1];
      }
      this.curbuf_.setBackgroundColor(backgroundColor);
    }

    /**
     * The Cea608DataChannel control methods implement all CC control operations.
     */
    private controlMiscellaneous_(
      ccPacket: Cea608Packet
    ): ClosedCaption | null {
      const MiscCmd = shaka.cea.Cea608DataChannel.MiscCmd_;
      const b2 = ccPacket.ccData2;
      const pts = ccPacket.pts;
      let parsedClosedCaption = null;
      switch (b2) {
        case MiscCmd.RCL:
          this.controlRcl_();
          break;
        case MiscCmd.BS:
          this.controlBs_();
          break;

        // unused (alarm off and alarm on)
        case MiscCmd.AOD:
        case MiscCmd.AON:
          break;
        case MiscCmd.DER:
          // Delete to End of Row. Not implemented since position not supported.
          break;
        case MiscCmd.RU2:
          parsedClosedCaption = this.controlRu_(2, pts);
          break;
        case MiscCmd.RU3:
          parsedClosedCaption = this.controlRu_(3, pts);
          break;
        case MiscCmd.RU4:
          parsedClosedCaption = this.controlRu_(4, pts);
          break;
        case MiscCmd.FON:
          this.controlFon_();
          break;
        case MiscCmd.RDC:
          this.controlRdc_(pts);
          break;
        case MiscCmd.TR:
          this.controlTr_();
          break;
        case MiscCmd.RTD:
          this.controlRtd_();
          break;
        case MiscCmd.EDM:
          parsedClosedCaption = this.controlEdm_(pts);
          break;
        case MiscCmd.CR:
          parsedClosedCaption = this.controlCr_(pts);
          break;
        case MiscCmd.ENM:
          this.controlEnm_();
          break;
        case MiscCmd.EOC:
          parsedClosedCaption = this.controlEoc_(pts);
          break;
      }
      return parsedClosedCaption;
    }

    /**
     * Handles CR - Carriage Return (Start new row).
     * CR only affects scroll windows (Rollup and Text modes).
     * Any currently buffered line needs to be emitted, along
     * with a window scroll action.
     * @param pts in seconds.
     */
    private controlCr_(pts: number): ClosedCaption | null {
      const buf = this.curbuf_;

      // Only rollup and text mode is affected, but we don't emit text mode.
      if (this.type_ !== shaka.cea.Cea608DataChannel.CaptionType.ROLLUP) {
        return null;
      }

      // Force out the scroll window since the top row will cleared.
      const parsedClosedCaption = buf.forceEmit(this.prevEndTime_, pts);

      // Calculate the top of the scroll window.
      const toprow = buf.getRow() - buf.getScrollSize() + 1;

      // Shift up the window one row higher.
      buf.moveRows(toprow - 1, toprow, buf.getScrollSize());

      // Clear out anything that's outside of our current scroll window.
      buf.resetRows(0, toprow - 1);
      buf.resetRows(
        buf.getRow(),
        shaka.cea.Cea608Memory.CC_ROWS - buf.getRow()
      );

      // Update the end time so the next caption emits starting at this time.
      this.prevEndTime_ = pts;
      return parsedClosedCaption;
    }

    /**
     * Handles RU2, RU3, RU4 - Roll-Up, N rows.
     * If in TEXT, POPON or PAINTON, any displayed captions are erased.
     *    This means must force emit entire display buffer.
     * @param scrollSize New scroll window size.
     */
    private controlRu_(scrollSize: number, pts: number): ClosedCaption | null {
      this.curbuf_ = this.displayedMemory_;

      // Point to displayed memory
      const buf = this.curbuf_;
      let parsedClosedCaption = null;

      // For any type except rollup and text mode, it should be emitted,
      // and memories cleared.
      if (
        this.type_ !== shaka.cea.Cea608DataChannel.CaptionType.ROLLUP &&
        this.type_ !== shaka.cea.Cea608DataChannel.CaptionType.TEXT
      ) {
        parsedClosedCaption = buf.forceEmit(this.prevEndTime_, pts);

        // Clear both memories.
        this.displayedMemory_.eraseBuffer();
        this.nonDisplayedMemory_.eraseBuffer();

        // Rollup base row defaults to the last row (15).
        buf.setRow(shaka.cea.Cea608Memory.CC_ROWS);
      }
      this.type_ = shaka.cea.Cea608DataChannel.CaptionType.ROLLUP;

      // Set the new rollup window size.
      buf.setScrollSize(scrollSize);
      return parsedClosedCaption;
    }

    /**
     * Handles flash on.
     */
    private controlFon_() {
      this.curbuf_.addChar(
        shaka.cea.Cea608Memory.CharSet.BASIC_NORTH_AMERICAN,
        " ".charCodeAt(0)
      );
    }

    /**
     * Handles EDM - Erase Displayed Mem
     * Mode check:
     * EDM affects all captioning modes (but not Text mode);
     */
    private controlEdm_(pts: number): ClosedCaption | null {
      const buf = this.displayedMemory_;
      let parsedClosedCaption = null;
      if (this.type_ !== shaka.cea.Cea608DataChannel.CaptionType.TEXT) {
        // Clearing displayed memory means we now know how long
        // its contents were displayed, so force it out.
        parsedClosedCaption = buf.forceEmit(this.prevEndTime_, pts);
      }
      buf.resetAllRows();
      return parsedClosedCaption;
    }

    /**
     * Handles RDC - Resume Direct Captions. Initiates Paint-On captioning mode.
     * RDC does not affect current display, so nothing needs to be forced out yet.
     * @param pts in seconds
     */
    private controlRdc_(pts: number) {
      this.type_ = shaka.cea.Cea608DataChannel.CaptionType.PAINTON;

      // Point to displayed memory.
      this.curbuf_ = this.displayedMemory_;

      // No scroll window now.
      this.curbuf_.setScrollSize(0);

      // The next paint-on caption needs this time as the start time.
      this.prevEndTime_ = pts;
    }

    /**
     * Handles ENM - Erase Nondisplayed Mem
     */
    private controlEnm_() {
      this.nonDisplayedMemory_.resetAllRows();
    }

    /**
     * Handles EOC - End Of Caption (flip mem)
     * This forces Pop-On mode, and swaps the displayed and nondisplayed memories.
     */
    private controlEoc_(pts: number): ClosedCaption | null {
      let parsedClosedCaption = null;
      if (this.type_ !== shaka.cea.Cea608DataChannel.CaptionType.TEXT) {
        parsedClosedCaption = this.displayedMemory_.forceEmit(
          this.prevEndTime_,
          pts
        );
      }

      // Swap memories
      const buf = this.nonDisplayedMemory_;
      this.nonDisplayedMemory_ = this.displayedMemory_;

      // Swap buffers
      this.displayedMemory_ = buf;

      // Enter Pop-On mode.
      this.controlRcl_();

      // The caption ended, and so the previous end time should be updated.
      this.prevEndTime_ = pts;
      return parsedClosedCaption;
    }

    /**
     * Handles RCL - Resume Caption Loading
     * Initiates Pop-On style captioning. No need to force anything out upon
     * entering Pop-On mode because it does not affect the current display.
     */
    private controlRcl_() {
      this.type_ = shaka.cea.Cea608DataChannel.CaptionType.POPON;
      this.curbuf_ = this.nonDisplayedMemory_;

      // No scroll window now
      this.curbuf_.setScrollSize(0);
    }

    /**
     * Handles BS - BackSpace.
     */
    private controlBs_() {
      this.curbuf_.eraseChar();
    }

    /**
     * Handles TR - Text Restart.
     * Clears text buffer and resumes Text Mode.
     */
    private controlTr_() {
      this.text_.reset();

      // Put into text mode.
      this.controlRtd_();
    }

    /**
     * Handles RTD - Resume Text Display.
     * Resumes text mode. No need to force anything out, because Text Mode doesn't
     * affect current display. Also, this decoder does not emit Text Mode anyway.
     */
    private controlRtd_() {
      shaka.log.warnOnce(
        "Cea608DataChannel",
        "CEA-608 text mode entered, but is unsupported"
      );
      this.curbuf_ = this.text_;
      this.type_ = shaka.cea.Cea608DataChannel.CaptionType.TEXT;
    }

    /**
     * Handles a Basic North American byte pair.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    handleBasicNorthAmericanChar(b1: number, b2: number) {
      this.curbuf_.addChar(
        shaka.cea.Cea608Memory.CharSet.BASIC_NORTH_AMERICAN,
        b1
      );
      this.curbuf_.addChar(
        shaka.cea.Cea608Memory.CharSet.BASIC_NORTH_AMERICAN,
        b2
      );
    }

    /**
     * Handles an Extended Western European byte pair.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private handleExtendedWesternEuropeanChar_(b1: number, b2: number) {
      // Get the char set from the LSB, which is the char set toggle bit.
      const charSet =
        b1 & 1
          ? shaka.cea.Cea608Memory.CharSet.PORTUGUESE_GERMAN
          : shaka.cea.Cea608Memory.CharSet.SPANISH_FRENCH;
      this.curbuf_.addChar(charSet, b2);
    }

    /**
     * Decodes control code.
     * Three types of control codes:
     * Preamble Address Codes, Mid-Row Codes, and Miscellaneous Control Codes.
     */
    handleControlCode(ccPacket: Cea608Packet): ClosedCaption | null {
      const b1 = ccPacket.ccData1;
      const b2 = ccPacket.ccData2;

      // FCC wants control codes transmitted twice, and that will often be
      // seen in broadcast captures. If the very next frame has a duplicate
      // control code, that duplicate is ignored. Note that this only applies
      // to the very next frame, and only for one match.
      if (this.lastcp_ === ((b1 << 8) | b2)) {
        this.lastcp_ = null;
        return null;
      }

      // Remember valid control code for checking in next frame!
      this.lastcp_ = (b1 << 8) | b2;
      if (this.isPAC_(b1, b2)) {
        this.controlPac_(b1, b2);
      } else {
        if (this.isMidrowStyleChange_(b1, b2)) {
          this.controlMidrow_(b2);
        } else {
          if (this.isBackgroundAttribute_(b1, b2)) {
            this.controlBackgroundAttribute_(b1, b2);
          } else {
            if (this.isSpecialNorthAmericanChar_(b1, b2)) {
              this.curbuf_.addChar(
                shaka.cea.Cea608Memory.CharSet.SPECIAL_NORTH_AMERICAN,
                b2
              );
            } else {
              if (this.isExtendedWesternEuropeanChar_(b1, b2)) {
                this.handleExtendedWesternEuropeanChar_(b1, b2);
              } else {
                if (this.isMiscellaneous_(b1, b2)) {
                  return this.controlMiscellaneous_(ccPacket);
                }
              }
            }
          }
        }
      }
      return null;
    }

    /**
     * Checks if this is a Miscellaneous control code.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private isMiscellaneous_(b1: number, b2: number): boolean {
      // For Miscellaneous Control Codes, the bytes take the following form:
      // b1 -> |0|0|0|1|C|1|0|F|
      // b2 -> |0|0|1|0|X|X|X|X|
      return (b1 & 246) === 20 && (b2 & 240) === 32;
    }

    /**
     * Checks if this is a PAC control code.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private isPAC_(b1: number, b2: number): boolean {
      // For Preamble Address Codes, the bytes take the following form:
      // b1 -> |0|0|0|1|X|X|X|X|
      // b2 -> |0|1|X|X|X|X|X|X|
      return (b1 & 240) === 16 && (b2 & 192) === 64;
    }

    /**
     * Checks if this is a Midrow style change control code.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private isMidrowStyleChange_(b1: number, b2: number): boolean {
      // For Midrow Control Codes, the bytes take the following form:
      // b1 -> |0|0|0|1|C|0|0|1|
      // b2 -> |0|0|1|0|X|X|X|X|
      return (b1 & 247) === 17 && (b2 & 240) === 32;
    }

    /**
     * Checks if this is a background attribute control code.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private isBackgroundAttribute_(b1: number, b2: number): boolean {
      // For Background Attribute Codes, the bytes take the following form:
      // Bg provided: b1 -> |0|0|0|1|C|0|0|0| b2 -> |0|0|1|0|COLOR|T|
      // No Bg:       b1 -> |0|0|0|1|C|1|1|1| b2 -> |0|0|1|0|1|1|0|1|
      return (
        ((b1 & 247) === 16 && (b2 & 240) === 32) ||
        ((b1 & 247) === 23 && (b2 & 255) === 45)
      );
    }

    /**
     * Checks if the character is in the Special North American char. set.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private isSpecialNorthAmericanChar_(b1: number, b2: number): boolean {
      // The bytes take the following form:
      // b1 -> |0|0|0|1|C|0|0|1|
      // b2 -> |0|0|1|1|  CHAR |
      return (b1 & 247) === 17 && (b2 & 240) === 48;
    }

    /**
     * Checks if the character is in the Extended Western European char. set.
     * @param b1 Byte 1.
     * @param b2 Byte 2.
     */
    private isExtendedWesternEuropeanChar_(b1: number, b2: number): boolean {
      // The bytes take the following form:
      // b1 -> |0|0|0|1|C|0|1|S|
      // b2 -> |0|0|1|CHARACTER|
      return (b1 & 246) === 18 && (b2 & 224) === 32;
    }

    /**
     * Checks if the data contains a control code.
     * @param b1 Byte 1.
     */
    static isControlCode(b1: number): boolean {
      // For control codes, the first byte takes the following form:
      // b1 -> |P|0|0|1|X|X|X|X|
      return (b1 & 112) === 16;
    }
  }
}

namespace shaka.cea.Cea608DataChannel {
  /**
   * Command codes.
   */
  export enum MiscCmd_ {
    // "RCL - Resume Caption Loading"
    RCL = 32,

    // "BS  - BackSpace"
    BS,

    // "AOD - Unused (alarm off)"
    AOD,

    // "AON - Unused (alarm on)"
    AON,

    // "DER - Delete to End of Row"
    DER,

    // "RU2 - Roll-Up, 2 rows"
    RU2,

    // "RU3 - Roll-Up, 3 rows"
    RU3,

    // "RU4 - Roll-Up, 4 rows"
    RU4,

    // "FON - Flash On"
    FON,

    // "RDC - Resume Direct Captions"
    RDC,

    // "TR - Text Restart"
    TR,

    // "RTD - Resume Text Display"
    RTD,

    // "EDM - Erase Displayed Mem"
    EDM,

    // "CR  - Carriage return"
    CR,

    // "ENM - Erase Nondisplayed Mem"
    ENM,

    // "EOC - End Of Caption (flip mem)"
    EOC,
  }
}

namespace shaka.cea.Cea608DataChannel {
  /**
   * Caption type.
   *  */
  export enum CaptionType {
    NONE,
    POPON,
    PAINTON,
    ROLLUP,
    TEXT,
  }
}

namespace shaka.cea.Cea608DataChannel {
  export const BG_COLORS: string[] = [
    "black",
    "green",
    "blue",
    "cyan",
    "red",
    "yellow",
    "magenta",
    "black",
  ];
}

namespace shaka.cea.Cea608DataChannel {
  export const TEXT_COLORS: string[] = [
    "white",
    "green",
    "blue",
    "cyan",
    "red",
    "yellow",
    "magenta",
    "white_italics",
  ];
}

export interface Style {
  textColor: string | null;
  backgroundColor: string | null;
  italics: boolean | null;
  underline: boolean | null;
}

export { Style };

export interface Cea608Packet {
  pts: number;
  type: number;
  ccData1: number;
  ccData2: number;
  order: number;
}

export { Cea608Packet };
