/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.ui.Controls");

namespace shaka.ui {
  /**
   * @final
   * @export
   */
  export class AudioLanguageSelection extends shaka.ui.SettingsMenu {
    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls, shaka.ui.Enums.MaterialDesignIcons.LANGUAGE);
      this.button.classList.add("shaka-language-button");
      this.button.classList.add("shaka-tooltip-status");
      this.menu.classList.add("shaka-audio-languages");
      this.eventManager.listen(
        this.localization,
        shaka.ui.Localization.LOCALE_UPDATED,
        () => {
          this.updateLocalizedStrings_();
        }
      );
      this.eventManager.listen(
        this.localization,
        shaka.ui.Localization.LOCALE_CHANGED,
        () => {
          this.updateLocalizedStrings_();
        }
      );
      this.eventManager.listen(this.player, "trackschanged", () => {
        this.onTracksChanged_();
      });
      this.eventManager.listen(this.player, "variantchanged", () => {
        this.updateAudioLanguages_();
      });

      // Set up all the strings in the user's preferred language.
      this.updateLocalizedStrings_();
      this.updateAudioLanguages_();
    }

    private updateAudioLanguages_() {
      const tracks = this.player.getVariantTracks();
      shaka.ui.LanguageUtils.updateTracks(
        tracks,
        this.menu,
        (track) => this.onAudioTrackSelected_(track),
        /* updateChosen= */
        true,
        this.currentSelection,
        this.localization,
        this.controls.getConfig().trackLabelFormat
      );
      shaka.ui.Utils.focusOnTheChosenItem(this.menu);
      this.controls.dispatchEvent(
        new shaka.util.FakeEvent("languageselectionupdated")
      );
      this.button.setAttribute("shaka-status", this.currentSelection.innerText);
    }

    private onTracksChanged_() {
      const hasVariants = this.player.getVariantTracks().length > 0;
      shaka.ui.Utils.setDisplay(this.button, hasVariants);
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
}

namespace shaka.ui.AudioLanguageSelection {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.AudioLanguageSelection(rootElement, controls);
    }
  }
}
shaka.ui.OverflowMenu.registerElement(
  "language",
  new shaka.ui.AudioLanguageSelection.Factory()
);
shaka.ui.Controls.registerElement(
  "language",
  new shaka.ui.AudioLanguageSelection.Factory()
);
