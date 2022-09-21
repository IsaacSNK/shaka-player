/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This class is used to track changes in variant and text selections. This
 * class will make sure that redundant switches are not recorded in the history.
 *
 * @final
 */
export class SwitchHistory {
  private currentVariant_: shaka.extern.Variant|null = null;
  private currentText_: shaka.extern.Stream|null = null;
  private history_: shaka.extern.TrackChoice[] = [];

  /**
   * Update the history to show that we are currently playing |newVariant|. If
   * we are already playing |newVariant|, this update will be ignored.
   *
   */
  updateCurrentVariant(
      newVariant: shaka.extern.Variant, fromAdaptation: boolean) {
    if (this.currentVariant_ == newVariant) {
      return;
    }
    this.currentVariant_ = newVariant;
    this.history_.push({
      timestamp: this.getNowInSeconds_(),
      id: newVariant.id,
      type: 'variant',
      fromAdaptation: fromAdaptation,
      bandwidth: newVariant.bandwidth
    });
  }

  /**
   * Update the history to show that we are currently playing |newText|. If we
   * are already playing |newText|, this update will be ignored.
   *
   */
  updateCurrentText(newText: shaka.extern.Stream, fromAdaptation: boolean) {
    if (this.currentText_ == newText) {
      return;
    }
    this.currentText_ = newText;
    this.history_.push({
      timestamp: this.getNowInSeconds_(),
      id: newText.id,
      type: 'text',
      fromAdaptation: fromAdaptation,
      bandwidth: null
    });
  }

  /**
   * Get a copy of the switch history. This will make sure to expose no internal
   * references.
   *
   */
  getCopy(): shaka.extern.TrackChoice[] {
    const copy = [];
    for (const entry of this.history_) {
      copy.push(this.clone_(entry));
    }
    return copy;
  }

  /**
   * Get the system time in seconds.
   *
   */
  private getNowInSeconds_(): number {
    return Date.now() / 1000;
  }

  private clone_(entry: shaka.extern.TrackChoice): shaka.extern.TrackChoice {
    return {
      timestamp: entry.timestamp,
      id: entry.id,
      type: entry.type,
      fromAdaptation: entry.fromAdaptation,
      bandwidth: entry.bandwidth
    };
  }
}
