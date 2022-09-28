/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.cea {
  export class CeaUtils {
    /**
     * Emits a closed caption based on the state of the buffer.
     * @param startTime Start time of the cue.
     * @param endTime End time of the cue.
     */
    static getParsedCaption(
      topLevelCue: Cue,
      stream: string,
      memory: (StyledChar | null)[][],
      startTime: number,
      endTime: number
    ): ClosedCaption | null {
      if (startTime >= endTime) {
        return null;
      }

      // Find the first and last row that contains characters.
      let firstNonEmptyRow = -1;
      let lastNonEmptyRow = -1;
      for (let i = 0; i < memory.length; i++) {
        if (memory[i].some((e) => e != null && e.getChar().trim() != "")) {
          firstNonEmptyRow = i;
          break;
        }
      }
      for (let i = memory.length - 1; i >= 0; i--) {
        if (memory[i].some((e) => e != null && e.getChar().trim() != "")) {
          lastNonEmptyRow = i;
          break;
        }
      }

      // Exit early if no non-empty row was found.
      if (firstNonEmptyRow === -1 || lastNonEmptyRow === -1) {
        return null;
      }

      // Keeps track of the current styles for a cue being emitted.
      let currentUnderline = false;
      let currentItalics = false;
      let currentTextColor = shaka.cea.CeaUtils.DEFAULT_TXT_COLOR;
      let currentBackgroundColor = shaka.cea.CeaUtils.DEFAULT_BG_COLOR;

      // Create first cue that will be nested in top level cue. Default styles.
      let currentCue = shaka.cea.CeaUtils.createStyledCue(
        startTime,
        endTime,
        currentUnderline,
        currentItalics,
        currentTextColor,
        currentBackgroundColor
      );

      // Logic: Reduce rows into a single top level cue containing nested cues.
      // Each nested cue corresponds either a style change or a line break.
      for (let i = firstNonEmptyRow; i <= lastNonEmptyRow; i++) {
        // Find the first and last non-empty characters in this row. We do this so
        // no styles creep in before/after the first and last non-empty chars.
        const row = memory[i];
        let firstNonEmptyCol = -1;
        let lastNonEmptyCol = -1;
        for (let j = 0; j < row.length; j++) {
          if (row[j] != null && row[j].getChar().trim() !== "") {
            firstNonEmptyCol = j;
            break;
          }
        }
        for (let j = row.length - 1; j >= 0; j--) {
          if (row[j] != null && row[j].getChar().trim() !== "") {
            lastNonEmptyCol = j;
            break;
          }
        }

        // If no non-empty char. was found in this row, it must be a linebreak.
        if (firstNonEmptyCol === -1 || lastNonEmptyCol === -1) {
          const linebreakCue = shaka.cea.CeaUtils.createLineBreakCue(
            startTime,
            endTime
          );
          topLevelCue.nestedCues.push(linebreakCue);
          continue;
        }
        for (let j = firstNonEmptyCol; j <= lastNonEmptyCol; j++) {
          const styledChar = row[j];

          // A null between non-empty cells in a row is handled as a space.
          if (!styledChar) {
            currentCue.payload += " ";
            continue;
          }
          const underline = styledChar.isUnderlined();
          const italics = styledChar.isItalicized();
          const textColor = styledChar.getTextColor();
          const backgroundColor = styledChar.getBackgroundColor();

          // If any style properties have changed, we need to open a new cue.
          if (
            underline != currentUnderline ||
            italics != currentItalics ||
            textColor != currentTextColor ||
            backgroundColor != currentBackgroundColor
          ) {
            // Push the currently built cue and start a new cue, with new styles.
            if (currentCue.payload) {
              topLevelCue.nestedCues.push(currentCue);
            }
            currentCue = shaka.cea.CeaUtils.createStyledCue(
              startTime,
              endTime,
              underline,
              italics,
              textColor,
              backgroundColor
            );
            currentUnderline = underline;
            currentItalics = italics;
            currentTextColor = textColor;
            currentBackgroundColor = backgroundColor;
          }
          currentCue.payload += styledChar.getChar();
        }
        if (currentCue.payload) {
          topLevelCue.nestedCues.push(currentCue);
        }

        // Add a linebreak since the row just ended.
        if (i !== lastNonEmptyRow) {
          const linebreakCue = shaka.cea.CeaUtils.createLineBreakCue(
            startTime,
            endTime
          );
          topLevelCue.nestedCues.push(linebreakCue);
        }

        // Create a new cue.
        currentCue = shaka.cea.CeaUtils.createStyledCue(
          startTime,
          endTime,
          currentUnderline,
          currentItalics,
          currentTextColor,
          currentBackgroundColor
        );
      }
      if (topLevelCue.nestedCues.length) {
        return { cue: topLevelCue, stream };
      }
      return null;
    }

    static createStyledCue(
      startTime: number,
      endTime: number,
      underline: boolean,
      italics: boolean,
      txtColor: string,
      bgColor: string
    ): Cue {
      const cue = new shaka.text.Cue(
        startTime,
        endTime,
        /* payload= */
        ""
      );
      if (underline) {
        cue.textDecoration.push(shaka.text.Cue.textDecoration.UNDERLINE);
      }
      if (italics) {
        cue.fontStyle = shaka.text.Cue.fontStyle.ITALIC;
      }
      cue.color = txtColor;
      cue.backgroundColor = bgColor;
      return cue;
    }

    static createLineBreakCue(startTime: number, endTime: number): Cue {
      const linebreakCue = new shaka.text.Cue(
        startTime,
        endTime,
        /* payload= */
        ""
      );
      linebreakCue.lineBreak = true;
      return linebreakCue;
    }
  }
}

namespace shaka.cea.CeaUtils {
  export class StyledChar {
    private character_: string;
    private underline_: boolean;
    private italics_: boolean;
    private backgroundColor_: string;
    private textColor_: string;

    constructor(
      character: string,
      underline: boolean,
      italics: boolean,
      backgroundColor: string,
      textColor: string
    ) {
      this.character_ = character;
      this.underline_ = underline;
      this.italics_ = italics;
      this.backgroundColor_ = backgroundColor;
      this.textColor_ = textColor;
    }

    getChar(): string {
      return this.character_;
    }

    isUnderlined(): boolean {
      return this.underline_;
    }

    isItalicized(): boolean {
      return this.italics_;
    }

    getBackgroundColor(): string {
      return this.backgroundColor_;
    }

    getTextColor(): string {
      return this.textColor_;
    }
  }
}

namespace shaka.cea.CeaUtils {
  /**
   * Default background color for text.
   */
  export const DEFAULT_BG_COLOR: string = "black";
}

namespace shaka.cea.CeaUtils {
  /**
   * Default text color.
   */
  export const DEFAULT_TXT_COLOR: string = "white";
}
