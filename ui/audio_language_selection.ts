/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';
import * as Enums from './dev-workspace.shaka-player-fork.ui.enums';
import {LanguageUtils} from './dev-workspace.shaka-player-fork.ui.language_utils';
goog.require('shaka.ui.Locales');
import {Localization} from './dev-workspace.shaka-player-fork.ui.localization';
import * as LocalizationExports from './dev-workspace.shaka-player-fork.ui.localization';
import {OverflowMenu} from './dev-workspace.shaka-player-fork.ui.overflow_menu';
import * as OverflowMenuExports from './dev-workspace.shaka-player-fork.ui.overflow_menu';
import {SettingsMenu} from './dev-workspace.shaka-player-fork.ui.settings_menu';
import {Utils} from './dev-workspace.shaka-player-fork.ui.ui_utils';
import {FakeEvent} from './dev-workspace.shaka-player-fork.lib.util.fake_event';
import * as FakeEventExports from './dev-workspace.shaka-player-fork.lib.util.fake_event';
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';

/**
 * @final
 * @export
 */
export class AudioLanguageSelection extends SettingsMenu {
  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls, Enums.MaterialDesignIcons.LANGUAGE);
    this.button.classList.add('shaka-language-button');
    this.button.classList.add('shaka-tooltip-status');
    this.menu.classList.add('shaka-audio-languages');
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(this.player, 'trackschanged', () => {
      this.onTracksChanged_();
    });
    this.eventManager.listen(this.player, 'variantchanged', () => {
      this.updateAudioLanguages_();
    });

    // Set up all the strings in the user's preferred language.
    this.updateLocalizedStrings_();
    this.updateAudioLanguages_();
  }

  private updateAudioLanguages_() {
    const tracks = this.player.getVariantTracks();
    LanguageUtils.updateTracks(
        tracks, this.menu, (track) => this.onAudioTrackSelected_(track),
        /* updateChosen= */
        true, this.currentSelection, this.localization,
        this.controls.getConfig().trackLabelFormat);
    Utils.focusOnTheChosenItem(this.menu);
    this.controls.dispatchEvent(new FakeEvent('languageselectionupdated'));
    this.button.setAttribute('shaka-status', this.currentSelection.innerText);
  }

  private onTracksChanged_() {
    const hasVariants = this.player.getVariantTracks().length > 0;
    Utils.setDisplay(this.button, hasVariants);
    this.updateAudioLanguages_();
  }

  private onAudioTrackSelected_(track: shaka.extern.Track) {
    this.player.selectAudioLanguage(track.language, track.roles[0]);
  }

  private updateLocalizedStrings_() {
    const LocIds = shaka.ui.Locales.Ids;
    this.backButton.ariaLabel = this.localization.resolve(LocIds.BACK);
    this.button.ariaLabel = this.localization.resolve(LocIds.LANGUAGE);
    this.nameSpan.textContent = this.localization.resolve(LocIds.LANGUAGE);
    this.backSpan.textContent = this.localization.resolve(LocIds.LANGUAGE);
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new AudioLanguageSelection(rootElement, controls);
  }
}
OverflowMenu.registerElement('language', new Factory());
Controls.registerElement('language', new Factory());
