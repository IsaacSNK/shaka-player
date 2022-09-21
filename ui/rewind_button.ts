/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';
import {Element} from './dev-workspace.shaka-player-fork.ui.element';
import * as Enums from './dev-workspace.shaka-player-fork.ui.enums';
goog.require('shaka.ui.Locales');
import {Localization} from './dev-workspace.shaka-player-fork.ui.localization';
import * as LocalizationExports from './dev-workspace.shaka-player-fork.ui.localization';
import {Dom} from './dev-workspace.shaka-player-fork.lib.util.dom_utils';

/**
 * @final
 * @export
 */
export class RewindButton extends Element {
  private button_: HTMLButtonElement;
  private rewindRates_: number[];

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.button_ = Dom.createButton();
    this.button_.classList.add('material-icons-round');
    this.button_.classList.add('shaka-rewind-button');
    this.button_.classList.add('shaka-tooltip-status');
    this.button_.setAttribute(
        'shaka-status', this.localization.resolve(shaka.ui.Locales.Ids.OFF));
    this.button_.textContent = Enums.MaterialDesignIcons.REWIND;
    this.parent.appendChild(this.button_);
    this.updateAriaLabel_();
    this.rewindRates_ = this.controls.getConfig().rewindRates;
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateAriaLabel_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateAriaLabel_();
        });
    this.eventManager.listen(this.button_, 'click', () => {
      this.rewind_();
    });
  }

  private updateAriaLabel_() {
    this.button_.ariaLabel =
        this.localization.resolve(shaka.ui.Locales.Ids.REWIND);
  }

  /**
   * Cycles trick play rate between the selected rewind rates.
   */
  private rewind_() {
    if (!this.video.duration) {
      return;
    }
    const trickPlayRate = this.player.getPlaybackRate();
    const newRateIndex = this.rewindRates_.indexOf(trickPlayRate) + 1;

    // When the button is clicked, the next rate in this.rewindRates_ is
    // selected. If no more rates are available, the first one is set.
    const newRate = newRateIndex != this.rewindRates_.length ?
        this.rewindRates_[newRateIndex] :
        this.rewindRates_[0];
    this.player.trickPlay(newRate);
    this.button_.setAttribute('shaka-status', newRate + 'x');
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new RewindButton(rootElement, controls);
  }
}
Controls.registerElement('rewind', new Factory());
