/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.cea {
  /**
   * CEA-708 closed captions service as defined by CEA-708-E. A decoder can own up
   * to 63 services. Each service owns eight windows.
   */
  export class Cea708Service {
    /**
     * Number for this specific service (1 - 63).
     */
    private serviceNumber_: number;

    /**
     * Eight Cea708 Windows, as defined by the spec.
     */
    private windows_: (Cea708Window | null)[] = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];

    /**
     * The current window for which window command operate on.
     */
    private currentWindow_: Cea708Window | null = null;

    constructor(serviceNumber: number) {
      this.serviceNumber_ = serviceNumber;
    }

    /**
     * Processes a CEA-708 control code.
     * @throws {!shaka.util.Error}
     */
    handleCea708ControlCode(dtvccPacket: DtvccPacket): ClosedCaption | null {
      const blockData = dtvccPacket.readByte();
      let controlCode = blockData.value;
      const pts = blockData.pts;

      // Read extended control code if needed.
      if (controlCode === shaka.cea.Cea708Service.EXT_CEA708_CTRL_CODE_BYTE1) {
        const extendedControlCodeBlock = dtvccPacket.readByte();
        controlCode = (controlCode << 16) | extendedControlCodeBlock.value;
      }

      // Control codes are in 1 of 4 logical groups:
      // CL (C0, C2), CR (C1, C3), GL (G0, G2), GR (G1, G2).
      if (controlCode >= 0 && controlCode <= 31) {
        return this.handleC0_(controlCode, pts);
      } else {
        if (controlCode >= 128 && controlCode <= 159) {
          return this.handleC1_(dtvccPacket, controlCode, pts);
        } else {
          if (controlCode >= 4096 && controlCode <= 4127) {
            this.handleC2_(dtvccPacket, controlCode & 255);
          } else {
            if (controlCode >= 4224 && controlCode <= 4255) {
              this.handleC3_(dtvccPacket, controlCode & 255);
            } else {
              if (controlCode >= 32 && controlCode <= 127) {
                this.handleG0_(controlCode);
              } else {
                if (controlCode >= 160 && controlCode <= 255) {
                  this.handleG1_(controlCode);
                } else {
                  if (controlCode >= 4128 && controlCode <= 4223) {
                    this.handleG2_(controlCode & 255);
                  } else {
                    if (controlCode >= 4256 && controlCode <= 4351) {
                      this.handleG3_(controlCode & 255);
                    }
                  }
                }
              }
            }
          }
        }
      }
      return null;
    }

    /**
     * Handles G0 group data.
     */
    private handleG0_(controlCode: number) {
      if (!this.currentWindow_) {
        return;
      }

      // G0 contains ASCII from 0x20 to 0x7f, with the exception that 0x7f
      // is replaced by a musical note.
      if (controlCode === 127) {
        this.currentWindow_.setCharacter("\u266a");
        return;
      }
      this.currentWindow_.setCharacter(String.fromCharCode(controlCode));
    }

    /**
     * Handles G1 group data.
     */
    private handleG1_(controlCode: number) {
      if (!this.currentWindow_) {
        return;
      }

      // G1 is the Latin-1 Character Set from 0xa0 to 0xff.
      this.currentWindow_.setCharacter(String.fromCharCode(controlCode));
    }

    /**
     * Handles G2 group data.
     */
    private handleG2_(controlCode: number) {
      if (!this.currentWindow_) {
        return;
      }
      if (!shaka.cea.Cea708Service.G2Charset.has(controlCode)) {
        // If the character is unsupported, the spec says to put an underline.
        this.currentWindow_.setCharacter("_");
        return;
      }
      const char = shaka.cea.Cea708Service.G2Charset.get(controlCode);
      this.currentWindow_.setCharacter(char);
    }

    /**
     * Handles G3 group data.
     */
    private handleG3_(controlCode: number) {
      if (!this.currentWindow_) {
        return;
      }

      // As of CEA-708-E, the G3 group only contains 1 character. It's a
      // [CC] character which has no unicode value on 0xa0.
      if (controlCode != 160) {
        // Similar to G2, the spec decrees an underline if char is unsupported.
        this.currentWindow_.setCharacter("_");
        return;
      }
      this.currentWindow_.setCharacter("[CC]");
    }

    /**
     * Handles C0 group data.
     */
    private handleC0_(controlCode: number, pts: number): ClosedCaption | null {
      // All these commands pertain to the current window, so ensure it exists.
      if (!this.currentWindow_) {
        return null;
      }
      const window = this.currentWindow_;
      let parsedClosedCaption = null;

      // Note: This decoder ignores the "ETX" (end of text) control code. Since
      // this is JavaScript, a '\0' is not needed to terminate a string.
      switch (controlCode) {
        case shaka.cea.Cea708Service.ASCII_BACKSPACE:
          window.backspace();
          break;
        case shaka.cea.Cea708Service.ASCII_CARRIAGE_RETURN:
          // Force out the buffer, since the top row could be lost.
          if (window.isVisible()) {
            parsedClosedCaption = window.forceEmit(pts, this.serviceNumber_);
          }
          window.carriageReturn();
          break;
        case shaka.cea.Cea708Service.ASCII_HOR_CARRIAGE_RETURN:
          // Force out the buffer, a row will be erased.
          if (window.isVisible()) {
            parsedClosedCaption = window.forceEmit(pts, this.serviceNumber_);
          }
          window.horizontalCarriageReturn();
          break;
        case shaka.cea.Cea708Service.ASCII_FORM_FEED:
          // Clear window and move pen to (0,0).
          // Force emit if the window is visible.
          if (window.isVisible()) {
            parsedClosedCaption = window.forceEmit(pts, this.serviceNumber_);
          }
          window.resetMemory();
          window.setPenLocation(0, 0);
          break;
      }
      return parsedClosedCaption;
    }

    /**
     * Processes C1 group data.
     * These are caption commands.
     * @param pts in seconds
     * @throws {!shaka.util.Error} a possible out-of-range buffer read.
     */
    private handleC1_(
      dtvccPacket: DtvccPacket,
      captionCommand: number,
      pts: number
    ): ClosedCaption | null {
      // Note: This decoder ignores delay and delayCancel control codes in the C1.
      // group. These control codes delay processing of data for a set amount of
      // time, however this decoder processes that data immediately.
      if (captionCommand >= 128 && captionCommand <= 135) {
        const windowNum = captionCommand & 7;
        this.setCurrentWindow_(windowNum);
      } else {
        if (captionCommand === 136) {
          const bitmap = dtvccPacket.readByte().value;
          return this.clearWindows_(bitmap, pts);
        } else {
          if (captionCommand === 137) {
            const bitmap = dtvccPacket.readByte().value;
            this.displayWindows_(bitmap, pts);
          } else {
            if (captionCommand === 138) {
              const bitmap = dtvccPacket.readByte().value;
              return this.hideWindows_(bitmap, pts);
            } else {
              if (captionCommand === 139) {
                const bitmap = dtvccPacket.readByte().value;
                return this.toggleWindows_(bitmap, pts);
              } else {
                if (captionCommand === 140) {
                  const bitmap = dtvccPacket.readByte().value;
                  return this.deleteWindows_(bitmap, pts);
                } else {
                  if (captionCommand === 143) {
                    return this.reset_(pts);
                  } else {
                    if (captionCommand === 144) {
                      this.setPenAttributes_(dtvccPacket);
                    } else {
                      if (captionCommand === 145) {
                        this.setPenColor_(dtvccPacket);
                      } else {
                        if (captionCommand === 146) {
                          this.setPenLocation_(dtvccPacket);
                        } else {
                          if (captionCommand === 151) {
                            this.setWindowAttributes_(dtvccPacket);
                          } else {
                            if (
                              captionCommand >= 152 &&
                              captionCommand <= 159
                            ) {
                              const windowNum = (captionCommand & 15) - 8;
                              this.defineWindow_(dtvccPacket, windowNum, pts);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return null;
    }

    /**
     * Handles C2 group data.
     */
    private handleC2_(dtvccPacket: DtvccPacket, controlCode: number) {
      // As of the CEA-708-E spec there are no commands on the C2 table, but if
      // seen, then the appropriate number of bytes must be skipped as per spec.
      if (controlCode >= 8 && controlCode <= 15) {
        dtvccPacket.skip(1);
      } else {
        if (controlCode >= 16 && controlCode <= 23) {
          dtvccPacket.skip(2);
        } else {
          if (controlCode >= 24 && controlCode <= 31) {
            dtvccPacket.skip(3);
          }
        }
      }
    }

    /**
     * Handles C3 group data.
     */
    private handleC3_(dtvccPacket: DtvccPacket, controlCode: number) {
      // As of the CEA-708-E spec there are no commands on the C3 table, but if
      // seen, then the appropriate number of bytes must be skipped as per spec.
      if (controlCode >= 128 && controlCode <= 135) {
        dtvccPacket.skip(4);
      } else {
        if (controlCode >= 136 && controlCode <= 143) {
          dtvccPacket.skip(5);
        }
      }
    }

    private setCurrentWindow_(windowNum: number) {
      // If the window isn't created, ignore the command.
      if (!this.windows_[windowNum]) {
        return;
      }
      this.currentWindow_ = this.windows_[windowNum];
    }

    /**
     * Yields each non-null window specified in the 8-bit bitmap.
     * @param bitmap 8 bits corresponding to each of the 8 windows.
     */
    private getSpecifiedWindowIds_(bitmap: number): number[] {
      const ids = [];
      for (let i = 0; i < 8; i++) {
        const windowSpecified = (bitmap & 1) === 1;
        if (windowSpecified && this.windows_[i]) {
          ids.push(i);
        }
        bitmap >>= 1;
      }
      return ids;
    }

    private clearWindows_(
      windowsBitmap: number,
      pts: number
    ): ClosedCaption | null {
      let parsedClosedCaption = null;

      // Clears windows from the 8 bit bitmap.
      for (const windowId of this.getSpecifiedWindowIds_(windowsBitmap)) {
        // If window visible and being cleared, emit buffer and reset start time!
        const window = this.windows_[windowId];
        if (window.isVisible()) {
          parsedClosedCaption = window.forceEmit(pts, this.serviceNumber_);
        }
        window.resetMemory();
      }
      return parsedClosedCaption;
    }

    private displayWindows_(windowsBitmap: number, pts: number) {
      // Displays windows from the 8 bit bitmap.
      for (const windowId of this.getSpecifiedWindowIds_(windowsBitmap)) {
        const window = this.windows_[windowId];
        if (!window.isVisible()) {
          // We are turning on the visibility, set the start time.
          window.setStartTime(pts);
        }
        window.display();
      }
    }

    private hideWindows_(
      windowsBitmap: number,
      pts: number
    ): ClosedCaption | null {
      let parsedClosedCaption = null;

      // Hides windows from the 8 bit bitmap.
      for (const windowId of this.getSpecifiedWindowIds_(windowsBitmap)) {
        const window = this.windows_[windowId];
        if (window.isVisible()) {
          // We are turning off the visibility, emit!
          parsedClosedCaption = window.forceEmit(pts, this.serviceNumber_);
        }
        window.hide();
      }
      return parsedClosedCaption;
    }

    private toggleWindows_(
      windowsBitmap: number,
      pts: number
    ): ClosedCaption | null {
      let parsedClosedCaption = null;

      // Toggles windows from the 8 bit bitmap.
      for (const windowId of this.getSpecifiedWindowIds_(windowsBitmap)) {
        const window = this.windows_[windowId];
        if (window.isVisible()) {
          // We are turning off the visibility, emit!
          parsedClosedCaption = window.forceEmit(pts, this.serviceNumber_);
        } else {
          // We are turning on visibility, set the start time.
          window.setStartTime(pts);
        }
        window.toggle();
      }
      return parsedClosedCaption;
    }

    private deleteWindows_(
      windowsBitmap: number,
      pts: number
    ): ClosedCaption | null {
      let parsedClosedCaption = null;

      // Deletes windows from the 8 bit bitmap.
      for (const windowId of this.getSpecifiedWindowIds_(windowsBitmap)) {
        const window = this.windows_[windowId];
        if (window.isVisible()) {
          // We are turning off the visibility, emit!
          parsedClosedCaption = window.forceEmit(pts, this.serviceNumber_);
        }

        // Delete the window from the list of windows
        this.windows_[windowId] = null;
      }
      return parsedClosedCaption;
    }

    /**
     * Emits anything currently present in any of the windows, and then
     * deletes all windows, cancels all delays, reinitializes the service.
     */
    private reset_(pts: number): ClosedCaption | null {
      const allWindowsBitmap = 255;

      // All windows should be deleted.
      const caption = this.deleteWindows_(allWindowsBitmap, pts);
      this.clear();
      return caption;
    }

    /**
     * Clears the state of the service completely.
     */
    clear() {
      this.currentWindow_ = null;
      this.windows_ = [null, null, null, null, null, null, null, null];
    }

    /**
     * @throws {!shaka.util.Error}
     */
    private setPenAttributes_(dtvccPacket: DtvccPacket) {
      // Two bytes follow. For the purpose of this decoder, we are only concerned
      // with byte 2, which is of the form |I|U|EDTYP|FNTAG|.

      // I (1 bit): Italics toggle.
      // U (1 bit): Underline toggle.
      // EDTYP (3 bits): Edge type (unused in this decoder).
      // FNTAG (3 bits): Font tag (unused in this decoder).
      // More info at https://en.wikipedia.org/wiki/CEA-708#SetPenAttributes_(0x90_+_2_bytes)
      dtvccPacket.skip(
        // Skip first byte
        1
      );
      const attrByte2 = dtvccPacket.readByte().value;
      if (!this.currentWindow_) {
        return;
      }
      const italics = (attrByte2 & 128) > 0;
      const underline = (attrByte2 & 64) > 0;
      this.currentWindow_.setPenItalics(italics);
      this.currentWindow_.setPenUnderline(underline);
    }

    /**
     * @throws {!shaka.util.Error}
     */
    private setPenColor_(dtvccPacket: DtvccPacket) {
      // Read foreground and background properties.
      const foregroundByte = dtvccPacket.readByte().value;
      const backgroundByte = dtvccPacket.readByte().value;
      dtvccPacket.skip(
        // Edge color not supported, skip it.
        1
      );
      if (!this.currentWindow_) {
        return;
      }

      // Byte semantics are described at the following link:
      // https://en.wikipedia.org/wiki/CEA-708#SetPenColor_(0x91_+_3_bytes)

      // Foreground color properties: |FOP|F_R|F_G|F_B|.
      const foregroundBlue = foregroundByte & 3;
      const foregroundGreen = (foregroundByte & 12) >> 2;
      const foregroundRed = (foregroundByte & 48) >> 4;

      // Background color properties: |BOP|B_R|B_G|B_B|.
      const backgroundBlue = backgroundByte & 3;
      const backgroundGreen = (backgroundByte & 12) >> 2;
      const backgroundRed = (backgroundByte & 48) >> 4;
      const foregroundColor = this.rgbColorToHex_(
        foregroundRed,
        foregroundGreen,
        foregroundBlue
      );
      const backgroundColor = this.rgbColorToHex_(
        backgroundRed,
        backgroundGreen,
        backgroundBlue
      );
      this.currentWindow_.setPenTextColor(foregroundColor);
      this.currentWindow_.setPenBackgroundColor(backgroundColor);
    }

    /**
     * @throws {!shaka.util.Error}
     */
    private setPenLocation_(dtvccPacket: DtvccPacket) {
      // Following 2 bytes take the following form:
      // b1 = |0|0|0|0|ROW| and b2 = |0|0|COLUMN|
      const locationByte1 = dtvccPacket.readByte().value;
      const locationByte2 = dtvccPacket.readByte().value;
      if (!this.currentWindow_) {
        return;
      }
      const row = locationByte1 & 15;
      const col = locationByte2 & 63;
      this.currentWindow_.setPenLocation(row, col);
    }

    /**
     * @throws {!shaka.util.Error}
     */
    private setWindowAttributes_(dtvccPacket: DtvccPacket) {
      // 4 bytes follow, with the following form:
      // Byte 1 contains fill-color information. Unused in this decoder.
      // Byte 2 contains border color information. Unused in this decoder.
      // Byte 3 contains justification information. In this decoder, we only use
      // the last 2 bits, which specifies text justification on the screen.
      // Byte 4 is special effects. Unused in this decoder.
      // More info at https://en.wikipedia.org/wiki/CEA-708#SetWindowAttributes_(0x97_+_4_bytes)
      dtvccPacket.skip(
        // Fill color not supported, skip.
        1
      );
      dtvccPacket.skip(
        // Border colors not supported, skip.
        1
      );
      const b3 = dtvccPacket.readByte().value;
      dtvccPacket.skip(
        // Effects not supported, skip.
        1
      );
      if (!this.currentWindow_) {
        return;
      }

      // Word wrap is outdated as of CEA-708-E, so we ignore those bits.
      // Extract the text justification and set it on the window.
      const justification = b3 & (3 as TextJustification);
      this.currentWindow_.setJustification(justification);
    }

    /**
     * @throws {!shaka.util.Error}
     */
    private defineWindow_(
      dtvccPacket: DtvccPacket,
      windowNum: number,
      pts: number
    ) {
      // Create the window if it doesn't exist.
      const windowAlreadyExists = this.windows_[windowNum] !== null;
      if (!windowAlreadyExists) {
        const window = new shaka.cea.Cea708Window(windowNum);
        window.setStartTime(pts);
        this.windows_[windowNum] = window;
      }

      // 6 Bytes follow, with the following form:
      // b1 = |0|0|V|R|C|PRIOR| , b2 = |P|VERT_ANCHOR| , b3 = |HOR_ANCHOR|
      // b4 = |ANC_ID|ROW_CNT| , b5 = |0|0|COL_COUNT| , b6 = |0|0|WNSTY|PNSTY|
      // Semantics of these bytes at https://en.wikipedia.org/wiki/CEA-708#DefineWindow07_(0x98-0x9F,_+_6_bytes)
      const b1 = dtvccPacket.readByte().value;
      const b2 = dtvccPacket.readByte().value;
      const b3 = dtvccPacket.readByte().value;
      const b4 = dtvccPacket.readByte().value;
      const b5 = dtvccPacket.readByte().value;
      const b6 = dtvccPacket.readByte().value;

      // As per 8.4.7 of CEA-708-E, row locks and column locks are to be ignored.
      // So this decoder will ignore these values.
      const visible = (b1 & 32) > 0;
      const verticalAnchor = b2 & 127;
      const relativeToggle = (b2 & 128) > 0;
      const horAnchor = b3;
      const rowCount = (b4 & 15) + 1;

      // Spec says to add 1.
      const anchorId = (b4 & 240) >> 4;
      const colCount = (b5 & 63) + 1;

      // Spec says to add 1.

      // If pen style = 0 AND window previously existed, keep its pen style.
      // Otherwise, change the pen style (For now, just reset to the default pen).
      // TODO add support for predefined pen styles and fonts.
      const penStyle = b6 & 7;
      if (!windowAlreadyExists || penStyle !== 0) {
        this.windows_[windowNum].resetPen();
      }
      this.windows_[windowNum].defineWindow(
        visible,
        verticalAnchor,
        horAnchor,
        anchorId,
        relativeToggle,
        rowCount,
        colCount
      );

      // Set the current window to the newly defined window.
      this.currentWindow_ = this.windows_[windowNum];
    }

    /**
     * Maps 64 possible CEA-708 colors to 8 CSS colors.
     * @param red value from 0-3
     * @param green value from 0-3
     * @param blue value from 0-3
     */
    private rgbColorToHex_(red: number, green: number, blue: number): string {
      // Rather than supporting 64 colors, this decoder supports 8 colors and
      // gets the closest color, as per 9.19 of CEA-708-E. This is because some
      // colors on television such as white, are often sent with lower intensity
      // and often appear dull/greyish on the browser, making them hard to read.

      // As per CEA-708-E 9.19, these mappings will map 64 colors to 8 colors.
      const colorMapping = { 0: 0, 1: 0, 2: 1, 3: 1 };
      red = colorMapping[red];
      green = colorMapping[green];
      blue = colorMapping[blue];
      const colorCode = (red << 2) | (green << 1) | blue;
      return shaka.cea.Cea708Service.Colors[colorCode];
    }
  }
}

namespace shaka.cea.Cea708Service {
  export const ASCII_BACKSPACE: number = 8;
}

namespace shaka.cea.Cea708Service {
  export const ASCII_FORM_FEED: number = 12;
}

namespace shaka.cea.Cea708Service {
  export const ASCII_CARRIAGE_RETURN: number = 13;
}

namespace shaka.cea.Cea708Service {
  export const ASCII_HOR_CARRIAGE_RETURN: number = 14;
}

namespace shaka.cea.Cea708Service {
  /**
   * For extended control codes in block_data on CEA-708, byte 1 is 0x10.
   *  */
  export const EXT_CEA708_CTRL_CODE_BYTE1: number = 16;
}

namespace shaka.cea.Cea708Service {
  /**
   * Holds characters mapping for bytes that are G2 control codes.
   *  */
  export const G2Charset: Map<number, string> = new Map([
    [32, " "],
    [33, "\u00a0"],
    [37, "\u2026"],
    [42, "\u0160"],
    [44, "\u0152"],
    [48, "\u2588"],
    [49, "\u2018"],
    [50, "\u2019"],
    [51, "\u201c"],
    [52, "\u201d"],
    [53, "\u2022"],
    [57, "\u2122"],
    [58, "\u0161"],
    [60, "\u0153"],
    [61, "\u2120"],
    [63, "\u0178"],
    [118, "\u215b"],
    [119, "\u215c"],
    [120, "\u215d"],
    [121, "\u215e"],
    [122, "\u2502"],
    [123, "\u2510"],
    [124, "\u2514"],
    [125, "\u2500"],
    [126, "\u2518"],
    [127, "\u250c"],
  ]);
}

namespace shaka.cea.Cea708Service {
  /**
   * An array of 8 colors that 64 colors can be quantized to. Order here matters.
   *  */
  export const Colors: string[] = [
    "black",
    "blue",
    "green",
    "cyan",
    "red",
    "magenta",
    "yellow",
    "white",
  ];
}

export interface Cea708Byte {
  pts: number;
  type: number;
  value: number;
  order: number;
}

export { Cea708Byte };
