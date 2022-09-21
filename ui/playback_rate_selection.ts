/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';
import * as Enums from './dev-workspace.shaka-player-fork.ui.enums';
goog.require('shaka.ui.Locales');
import {Localization} from './dev-workspace.shaka-player-fork.ui.localization';
import * as LocalizationExports from './dev-workspace.shaka-player-fork.ui.localization';
import {OverflowMenu} from './dev-workspace.shaka-player-fork.ui.overflow_menu';
import * as OverflowMenuExports from './dev-workspace.shaka-player-fork.ui.overflow_menu';
import {SettingsMenu} from './dev-workspace.shaka-player-fork.ui.settings_menu';
import {Utils} from './dev-workspace.shaka-player-fork.ui.ui_utils';
import {Dom} from './dev-workspace.shaka-player-fork.lib.util.dom_utils';
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';

/**
 * @final
 * @export
 */
export class PlaybackRateSelection extends SettingsMenu {
  playbackRates_: Map<string, number>;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls, Enums.MaterialDesignIcons.PLAYBACK_RATE);
    this.button.classList.add('shaka-playbackrate-button');
    this.menu.classList.add('shaka-playback-rates');
    this.button.classList.add('shaka-tooltip-status');
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(this.player, 'ratechange', () => {
      this.updatePlaybackRateSelection_(this.player.getPlaybackRate());
    });
    this.playbackRates_ = new Map(this.controls.getConfig().playbackRates.map(
        (rate) => [rate + 'x', rate]));

    // Set up all the strings in the user's preferred language.
    this.updateLocalizedStrings_();
    this.addPlaybackRates_();
    this.updatePlaybackRateSelection_(this.player.getPlaybackRate());
  }

  private updateLocalizedStrings_() {
    const LocIds = shaka.ui.Locales.Ids;
    this.backButton.ariaLabel = this.localization.resolve(LocIds.BACK);
    this.button.ariaLabel = this.localization.resolve(LocIds.PLAYBACK_RATE);
    this.nameSpan.textContent = this.localization.resolve(LocIds.PLAYBACK_RATE);
    this.backSpan.textContent = this.localization.resolve(LocIds.PLAYBACK_RATE);
  }

  /**
   * Update checkmark icon and related class and attribute for the chosen rate
   * button.
   * @param rate The video playback rate.
   */
  private updatePlaybackRateSelection_(rate: number) {
    // Remove the old checkmark icon and related tags and classes if it exists.
    const checkmarkIcon = Utils.getDescendantIfExists(
        this.menu, 'material-icons-round shaka-chosen-item');
    if (checkmarkIcon) {
      const previouslySelectedButton = checkmarkIcon.parentElement;
      previouslySelectedButton.removeAttribute('aria-selected');
      const previouslySelectedSpan =
          previouslySelectedButton.getElementsByTagName('span')[0];
      previouslySelectedSpan.classList.remove('shaka-chosen-item');
      previouslySelectedButton.removeChild(checkmarkIcon);
    }

    // Find the button that represents the newly selected playback rate.
    // Add the checkmark icon, related tags and classes to the newly selected
    // button.
    const span = Array.from(this.menu.querySelectorAll('span')).find((el) => {
      return this.playbackRates_.get(el.textContent) == rate;
    });
    if (span) {
      const button = span.parentElement;
      button.appendChild(Utils.checkmarkIcon());
      button.ariaSelected = 'true';
      span.classList.add('shaka-chosen-item');
    }

    // Set the label to display the current playback rate in the overflow menu,
    // in the format of '1x', '1.5x', etc.
    this.currentSelection.textContent = rate + 'x';
    this.button.setAttribute('shaka-status', rate + 'x');
  }

  private addPlaybackRates_() {
    for (const rateStr of this.playbackRates_.keys()) {
      const button = Dom.createButton();
      const span = Dom.createHTMLElement('span');
      span.textContent = rateStr;
      button.appendChild(span);
      this.eventManager.listen(button, 'click', () => {
        this.video.playbackRate = this.playbackRates_.get(rateStr);
        this.video.defaultPlaybackRate = this.playbackRates_.get(rateStr);
      });
      this.menu.appendChild(button);
    }
    Utils.focusOnTheChosenItem(this.menu);
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new PlaybackRateSelection(rootElement, controls);
  }
}
OverflowMenu.registerElement('playback_rate', new Factory());
Controls.registerElement('playback_rate', new Factory());
