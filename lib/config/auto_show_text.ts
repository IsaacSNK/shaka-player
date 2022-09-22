/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @export
 */
export enum AutoShowText {

  /** Never show text automatically on startup. */
  NEVER,

  /** Always show text automatically on startup. */
  ALWAYS,

  /**
   * Show text automatically on startup if it matches the preferred text
   * language.
   */
  IF_PREFERRED_TEXT_LANGUAGE,

  /**
   * Show text automatically on startup if we think that subtitles may be
   * needed.  This is specifically if the selected text matches the preferred
   * text language AND is different from the initial audio language.  (Example:
   * You prefer English, but the audio is only available in French, so English
   * subtitles should be enabled by default.)
   * <br>
   * This is the default setting.
   */
  IF_SUBTITLES_MAY_BE_NEEDED
}
