/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * Reads elements from strings.
   */
  export class TextParser {
    private data_: string;
    private position_: number = 0;

    constructor(data: string) {
      this.data_ = data;
    }

    /** @return Whether it is at the end of the string. */
    atEnd(): boolean {
      return this.position_ == this.data_.length;
    }

    /**
     * Reads a line from the parser.  This will read but not return the newline.
     * Returns null at the end.
     *
     */
    readLine(): string | null {
      return this.readRegexReturnCapture_(/(.*?)(\n|$)/gm, 1);
    }

    /**
     * Reads a word from the parser.  This will not read or return any whitespace
     * before or after the word (including newlines).  Returns null at the end.
     *
     */
    readWord(): string | null {
      return this.readRegexReturnCapture_(/[^ \t\n]*/gm, 0);
    }

    /**
     * Skips any continuous whitespace from the parser.  Returns null at the end.
     */
    skipWhitespace() {
      this.readRegex(/[ \t]+/gm);
    }

    /**
     * Reads the given regular expression from the parser.  This requires the
     * match to be at the current position; there is no need to include a head
     * anchor.
     * This requires that the regex have the global flag to be set so that it can
     * set lastIndex to start the search at the current position.  Returns null at
     * the end or if the regex does not match the current position.
     *
     */
    readRegex(regex: RegExp): string[] {
      const index = this.indexOf_(regex);
      if (this.atEnd() || index == null || index.position != this.position_) {
        return null;
      }
      this.position_ += index.length;
      return index.results;
    }

    /**
     * Reads a regex from the parser and returns the given capture.
     *
     */
    private readRegexReturnCapture_(
      regex: RegExp,
      index: number
    ): string | null {
      if (this.atEnd()) {
        return null;
      }
      const ret = this.readRegex(regex);
      if (!ret) {
        return null;
      } else {
        return ret[index];
      }
    }

    /**
     * Returns the index info about a regular expression match.
     *
     */
    private indexOf_(
      regex: RegExp
    ): { position: number; length: number; results: string[] } | null {
      // The global flag is required to use lastIndex.
      goog.asserts.assert(regex.global, "global flag should be set");
      regex.lastIndex = this.position_;
      const results = regex.exec(this.data_);
      if (results == null) {
        return null;
      } else {
        return {
          position: results.index,
          length: results[0].length,
          results: results,
        };
      }
    }
  }
}
