/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Controls} from './controls';
import * as Enums from './enums';
import {LanguageUtils} from './language_utils';
import {Localization} from './localization';
import * as LocalizationExports from './localization';
import {OverflowMenu} from './overflow_menu';
import * as OverflowMenuExports from './overflow_menu';
import {SettingsMenu} from './settings_menu';
import {Utils} from './ui_utils';
import {FakeEvent} from './../lib/util/fake_event';
import * as FakeEventExports from './../lib/util/fake_event';
import * as IFactory from './externs/ui';
import { Track } from '../externs/shaka/player';

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

  private onAudioTrackSelected_(track: Track) {
    this.player.selectAudioLanguage(track.language, track.roles[0]);
  }

  private updateLocalizedStrings_() {
    const LocIds = IFactory.shaka.ui.Locales.Ids;
    this.backButton.ariaLabel = this.localization.resolve(LocIds.BACK);
    this.button.ariaLabel = this.localization.resolve(LocIds.LANGUAGE);
    this.nameSpan.textContent = this.localization.resolve(LocIds.LANGUAGE);
    this.backSpan.textContent = this.localization.resolve(LocIds.LANGUAGE);
  }
}

/**
 * @final
 */
export class Factory implements IFactory.Factory{
  /** @override */
  create(rootElement: HTMLElement, controls: Controls) {
    return new AudioLanguageSelection(rootElement, controls);
  }
}
OverflowMenu.registerElement('language', new Factory());
Controls.registerElement('language', new Factory());
