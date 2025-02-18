/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.cea {
  /**
   * CEA-708 Window. Each CEA-708 service owns 8 of these.
   */
  export class Cea708Window {
    /**
     * A number from 0 - 7 indicating the window number in the
     * service that owns this window.
     */
    private windowNum_: number;

    /**
     * Indicates whether this window is visible.
     */
    private visible_: boolean = false;

    /**
     * Indicates whether the horizontal and vertical anchors coordinates specify
     * a percentage of the screen, or physical coordinates on the screen.
     */
    private relativeToggle_: boolean = false;

    /**
     * Horizontal anchor. Loosely corresponds to a WebVTT viewport X anchor.
     */
    private horizontalAnchor_: number = 0;

    /**
     * Vertical anchor. Loosely corresponds to a WebVTT viewport Y anchor.
     */
    private verticalAnchor_: number = 0;

    /**
     * If valid, ranges from 0 to 8, specifying one of 9 locations on window:
     * 0________1________2
     * |        |        |
     * 3________4________5
     * |        |        |
     * 6________7________8
     * Diagram is valid as per CEA-708-E section 8.4.4.
     * Each of these locations corresponds to a WebVTT region's "region anchor".
     */
    private anchorId_: number = 0;

    /**
     * Indicates the number of rows in this window's buffer/memory.
     */
    private rowCount_: number = 0;

    /**
     * Indicates the number of columns in this window's buffer/memory.
     */
    private colCount_: number = 0;

    /**
     * Center by default.
     */
    private justification_: TextJustification;

    /**
     * An array of rows of styled characters, representing the
     * current text and styling of text in this window.
     */
    private memory_: (StyledChar | null)[][] = [];
    private startTime_: number = 0;

    /**
     * Row that the current pen is pointing at.
     */
    private row_: number = 0;

    /**
     * Column that the current pen is pointing at.
     */
    private col_: number = 0;

    /**
     * Indicates whether the current pen position is italicized.
     */
    private italics_: boolean = false;

    /**
     * Indicates whether the current pen position is underlined.
     */
    private underline_: boolean = false;

    /**
     * Indicates the text color at the current pen position.
     */
    private textColor_: string;

    /**
     * Indicates the background color at the current pen position.
     */
    private backgroundColor_: string;

    constructor(windowNum: number) {
      this.windowNum_ = windowNum;
      this.justification_ = shaka.cea.Cea708Window.TextJustification.CENTER;
      this.textColor_ = shaka.cea.CeaUtils.DEFAULT_TXT_COLOR;
      this.backgroundColor_ = shaka.cea.CeaUtils.DEFAULT_BG_COLOR;
      this.resetMemory();

      // TODO Support window positioning by mapping them to Regions.
      // https://dvcs.w3.org/hg/text-tracks/raw-file/default/608toVTT/608toVTT.html#positioning-in-cea-708
      shaka.util.Functional.ignored(
        this.verticalAnchor_,
        this.relativeToggle_,
        this.horizontalAnchor_,
        this.anchorId_,
        this.windowNum_
      );
    }

    defineWindow(
      visible: boolean,
      verticalAnchor: number,
      horizontalAnchor: number,
      anchorId: number,
      relativeToggle: boolean,
      rowCount: number,
      colCount: number
    ) {
      this.visible_ = visible;
      this.verticalAnchor_ = verticalAnchor;
      this.horizontalAnchor_ = horizontalAnchor;
      this.anchorId_ = anchorId;
      this.relativeToggle_ = relativeToggle;
      this.rowCount_ = rowCount;
      this.colCount_ = colCount;
    }

    /**
     * Resets the memory buffer.
     */
    resetMemory() {
      this.memory_ = [];
      for (let i = 0; i < shaka.cea.Cea708Window.MAX_ROWS; i++) {
        this.memory_.push(this.createNewRow_());
      }
    }

    /**
     * Allocates and returns a new row.
     */
    private createNewRow_(): (StyledChar | null)[] {
      const row = [];
      for (let j = 0; j < shaka.cea.Cea708Window.MAX_COLS; j++) {
        row.push(null);
      }
      return row;
    }

    /**
     * Sets the unicode value for a char at the current pen location.
     */
    setCharacter(char: string) {
      // Check if the pen is out of bounds.
      if (!this.isPenInBounds_()) {
        return;
      }
      const cea708Char = new shaka.cea.CeaUtils.StyledChar(
        char,
        this.underline_,
        this.italics_,
        this.backgroundColor_,
        this.textColor_
      );
      this.memory_[this.row_][this.col_] = cea708Char;

      // Increment column
      this.col_++;
    }

    /**
     * Erases a character from the buffer and moves the pen back.
     */
    backspace() {
      if (!this.isPenInBounds_()) {
        return;
      }

      // Check if a backspace can be done.
      if (this.col_ <= 0 && this.row_ <= 0) {
        return;
      }
      if (this.col_ <= 0) {
        // Move pen back a row.
        this.col_ = this.colCount_ - 1;
        this.row_--;
      } else {
        // Move pen back a column.
        this.col_--;
      }

      // Erase the character occupied at that position.
      this.memory_[this.row_][this.col_] = null;
    }

    private isPenInBounds_() {
      const inRowBounds = this.row_ < this.rowCount_ && this.row_ >= 0;
      const inColBounds = this.col_ < this.colCount_ && this.col_ >= 0;
      return inRowBounds && inColBounds;
    }

    isVisible(): boolean {
      return this.visible_;
    }

    /**
     * Moves up <count> rows in the buffer.
     */
    private moveUpRows_(count: number) {
      let dst = 0;

      // Row each row should be moved to.

      // Move existing rows up by <count>.
      for (let i = count; i < shaka.cea.Cea708Window.MAX_ROWS; i++, dst++) {
        this.memory_[dst] = this.memory_[i];
      }

      // Create <count> new rows at the bottom.
      for (let i = 0; i < count; i++, dst++) {
        this.memory_[dst] = this.createNewRow_();
      }
    }

    /**
     * Handles CR. Increments row - if last row, "roll up" all rows by one.
     */
    carriageReturn() {
      if (this.row_ + 1 >= this.rowCount_) {
        this.moveUpRows_(1);
        this.col_ = 0;
        return;
      }
      this.row_++;
      this.col_ = 0;
    }

    /**
     * Handles HCR. Moves the pen to the beginning of the cur. row and clears it.
     */
    horizontalCarriageReturn() {
      this.memory_[this.row_] = this.createNewRow_();
      this.col_ = 0;
    }

    /**
     * @param serviceNumber Number of the service emitting this caption.
     */
    forceEmit(endTime: number, serviceNumber: number): ClosedCaption | null {
      const stream = `svc${serviceNumber}`;
      const TextJustification = shaka.cea.Cea708Window.TextJustification;
      const topLevelCue = new shaka.text.Cue(
        this.startTime_,
        endTime,
        /* payload= */
        ""
      );
      if (this.justification_ === TextJustification.LEFT) {
        // LEFT justified.
        topLevelCue.textAlign = shaka.text.Cue.textAlign.LEFT;
      } else {
        if (this.justification_ === TextJustification.RIGHT) {
          // RIGHT justified.
          topLevelCue.textAlign = shaka.text.Cue.textAlign.RIGHT;
        } else {
          // CENTER justified. Both FULL and CENTER are handled as CENTER justified.
          topLevelCue.textAlign = shaka.text.Cue.textAlign.CENTER;
        }
      }
      const caption = shaka.cea.CeaUtils.getParsedCaption(
        topLevelCue,
        stream,
        this.memory_,
        this.startTime_,
        endTime
      );
      if (caption) {
        // If a caption is being emitted, then the next caption's start time
        // should be no less than this caption's end time.
        this.setStartTime(endTime);
      }
      return caption;
    }

    setPenLocation(row: number, col: number) {
      this.row_ = row;
      this.col_ = col;
    }

    setPenBackgroundColor(backgroundColor: string) {
      this.backgroundColor_ = backgroundColor;
    }

    setPenTextColor(textColor: string) {
      this.textColor_ = textColor;
    }

    setPenUnderline(underline: boolean) {
      this.underline_ = underline;
    }

    setPenItalics(italics: boolean) {
      this.italics_ = italics;
    }

    /** Reset the pen to 0,0 with default styling. */
    resetPen() {
      this.row_ = 0;
      this.col_ = 0;
      this.underline_ = false;
      this.italics_ = false;
      this.textColor_ = shaka.cea.CeaUtils.DEFAULT_TXT_COLOR;
      this.backgroundColor_ = shaka.cea.CeaUtils.DEFAULT_BG_COLOR;
    }

    setJustification(justification: TextJustification) {
      this.justification_ = justification;
    }

    /**
     * Sets the window to visible.
     */
    display() {
      this.visible_ = true;
    }

    /**
     * Sets the window to invisible.
     */
    hide() {
      this.visible_ = false;
    }

    /**
     * Toggles the visibility of the window.
     */
    toggle() {
      this.visible_ = !this.visible_;
    }

    /**
     * Sets the start time for the cue to be emitted.
     */
    setStartTime(pts: number) {
      this.startTime_ = pts;
    }
  }
}

namespace shaka.cea.Cea708Window {
  /**
   * Caption type.
   *  */
  export enum TextJustification {
    LEFT,
    RIGHT,
    CENTER,
    FULL,
  }
}

namespace shaka.cea.Cea708Window {
  /**
   * Can be indexed 0-31 for 4:3 format, and 0-41 for 16:9 formats.
   * Thus the absolute maximum is 42 columns for the 16:9 format.
   *  */
  export const MAX_COLS: number = 42;
}

namespace shaka.cea.Cea708Window {
  /**
   * Maximum of 15 rows that can be indexed from 0 to 14.
   *  */
  export const MAX_ROWS: number = 15;
}
