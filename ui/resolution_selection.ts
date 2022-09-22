/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './lib/asserts';
import {asserts} from './lib/asserts';
import {Controls} from './/controls';
import * as Enums from './/enums';

goog.require('shaka.ui.Locales');
import {Localization} from './/localization';
import * as LocalizationExports from './/localization';
import {OverflowMenu} from './/overflow_menu';
import * as OverflowMenuExports from './/overflow_menu';
import {SettingsMenu} from './/settings_menu';
import {Utils} from './/ui_utils';
import {Dom} from './lib/dom_utils';
import {FakeEvent} from './lib/fake_event';
import * as FakeEventExports from './lib/fake_event';
import {Controls} from './/controls';

/**
 * @final
 * @export
 */
export class ResolutionSelection extends SettingsMenu {
  private abrOnSpan_: HTMLElement;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls, Enums.MaterialDesignIcons.RESOLUTION);
    this.button.classList.add('shaka-resolution-button');
    this.button.classList.add('shaka-tooltip-status');
    this.menu.classList.add('shaka-resolutions');
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(this.player, 'variantchanged', () => {
      this.updateResolutionSelection_();
    });
    this.eventManager.listen(this.player, 'trackschanged', () => {
      this.updateResolutionSelection_();
    });
    this.eventManager.listen(this.player, 'abrstatuschanged', () => {
      this.updateResolutionSelection_();
    });
    this.updateResolutionSelection_();
  }

  private updateResolutionSelection_() {
    let tracks: shaka.extern.Track[] = this.player.getVariantTracks();

    // If there is a selected variant track, then we filter out any tracks in
    // a different language.  Then we use those remaining tracks to display the
    // available resolutions.
    const selectedTrack = tracks.find((track) => track.active);
    if (selectedTrack) {
      // Filter by current audio language and channel count.
      tracks = tracks.filter(
          (track) => track.language == selectedTrack.language &&
              track.channelsCount == selectedTrack.channelsCount);
    }

    // Remove duplicate entries with the same resolution or quality depending
    // on content type.  Pick an arbitrary one.
    tracks = tracks.filter((track, idx) => {
      // Keep the first one with the same height or bandwidth.
      const otherIdx = this.player.isAudioOnly() ?
          tracks.findIndex((t) => t.bandwidth == track.bandwidth) :
          tracks.findIndex((t) => t.height == track.height);
      return otherIdx == idx;
    });

    // Sort the tracks by height or bandwidth depending on content type.
    if (this.player.isAudioOnly()) {
      tracks.sort((t1, t2) => {
        asserts.assert(t1.bandwidth != null, 'Null bandwidth');
        asserts.assert(t2.bandwidth != null, 'Null bandwidth');
        return t2.bandwidth - t1.bandwidth;
      });
    } else {
      tracks.sort((t1, t2) => {
        asserts.assert(t1.height != null, 'Null height');
        asserts.assert(t2.height != null, 'Null height');
        return t2.height - t1.height;
      });
    }

    // Remove old shaka-resolutions
    // 1. Save the back to menu button
    const backButton = Utils.getFirstDescendantWithClassName(
        this.menu, 'shaka-back-to-overflow-button');

    // 2. Remove everything
    Dom.removeAllChildren(this.menu);

    // 3. Add the backTo Menu button back
    this.menu.appendChild(backButton);
    const abrEnabled = this.player.getConfiguration().abr.enabled;

    // Add new ones
    for (const track of tracks) {
      const button = Dom.createButton();
      button.classList.add('explicit-resolution');
      this.eventManager.listen(
          button, 'click', () => this.onTrackSelected_(track));
      const span = Dom.createHTMLElement('span');
      span.textContent = this.player.isAudioOnly() ?
          Math.round(track.bandwidth / 1000) + ' kbits/s' :
          track.height + 'p';
      button.appendChild(span);
      if (!abrEnabled && track == selectedTrack) {
        // If abr is disabled, mark the selected track's resolution.
        button.ariaSelected = 'true';
        button.appendChild(Utils.checkmarkIcon());
        span.classList.add('shaka-chosen-item');
        this.currentSelection.textContent = span.textContent;
      }
      this.menu.appendChild(button);
    }

    // Add the Auto button
    const autoButton = Dom.createButton();
    autoButton.classList.add('shaka-enable-abr-button');
    this.eventManager.listen(autoButton, 'click', () => {
      const config = {abr: {enabled: true}};
      this.player.configure(config);
      this.updateResolutionSelection_();
    });
    this.abrOnSpan_ = Dom.createHTMLElement('span');
    this.abrOnSpan_.classList.add('shaka-auto-span');
    this.abrOnSpan_.textContent =
        this.localization.resolve(shaka.ui.Locales.Ids.AUTO_QUALITY);
    autoButton.appendChild(this.abrOnSpan_);

    // If abr is enabled reflect it by marking 'Auto' as selected.
    if (abrEnabled) {
      autoButton.ariaSelected = 'true';
      autoButton.appendChild(Utils.checkmarkIcon());
      this.abrOnSpan_.classList.add('shaka-chosen-item');
      this.currentSelection.textContent =
          this.localization.resolve(shaka.ui.Locales.Ids.AUTO_QUALITY);
    }
    this.button.setAttribute('shaka-status', this.currentSelection.textContent);
    this.menu.appendChild(autoButton);
    Utils.focusOnTheChosenItem(this.menu);
    this.controls.dispatchEvent(new FakeEvent('resolutionselectionupdated'));
    this.updateLocalizedStrings_();
  }

  private onTrackSelected_(track: shaka.extern.Track) {
    // Disable abr manager before changing tracks.
    const config = {abr: {enabled: false}};
    this.player.configure(config);
    const clearBuffer = this.controls.getConfig().clearBufferOnQualityChange;
    this.player.selectVariantTrack(track, clearBuffer);
  }

  private updateLocalizedStrings_() {
    const LocIds = shaka.ui.Locales.Ids;
    const locId =
        this.player.isAudioOnly() ? LocIds.QUALITY : LocIds.RESOLUTION;
    this.button.ariaLabel = this.localization.resolve(locId);
    this.backButton.ariaLabel = this.localization.resolve(locId);
    this.backSpan.textContent = this.localization.resolve(locId);
    this.nameSpan.textContent = this.localization.resolve(locId);
    this.abrOnSpan_.textContent =
        this.localization.resolve(LocIds.AUTO_QUALITY);
    if (this.player.getConfiguration().abr.enabled) {
      this.currentSelection.textContent =
          this.localization.resolve(shaka.ui.Locales.Ids.AUTO_QUALITY);
    }
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new ResolutionSelection(rootElement, controls);
  }
}
OverflowMenu.registerElement('quality', new Factory());
Controls.registerElement('quality', new Factory());
