/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './../lib/debug/asserts';
import {asserts} from './../lib/debug/asserts';
import * as PlayerExports from './../lib/player';
import {Player} from './../lib/player';
import {Controls} from './controls';
import {Element} from './element';
import * as Enums from './enums';
import {Localization} from './localization';
import * as LocalizationExports from './localization';
import {OverflowMenu} from './overflow_menu';
import * as OverflowMenuExports from './overflow_menu';
import {Utils} from './ui_utils';
import {Dom} from './../lib/util/dom_utils';

import { IFactory, shaka } from './externs/ui';

/**
 * @final
 * @export
 */
export class AirPlayButton extends Element {
  private airplayButton_: HTMLButtonElement;
  private airplayIcon_: HTMLElement;
  airplayNameSpan_: any;
  airplayCurrentSelectionSpan_: any;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.airplayButton_ = Dom.createButton();
    this.airplayButton_.classList.add('shaka-airplay-button');
    this.airplayButton_.classList.add('shaka-tooltip');
    this.airplayButton_.ariaPressed = 'false';
    this.airplayIcon_ = Dom.createHTMLElement('i');
    this.airplayIcon_.classList.add('material-icons-round');
    this.airplayIcon_.textContent = Enums.MaterialDesignIcons.AIRPLAY;
    this.airplayButton_.appendChild(this.airplayIcon_);

    // Don't show the button if AirPlay is not supported.
    //@ts-ignore
    if (!window.WebKitPlaybackTargetAvailabilityEvent) {
      this.airplayButton_.classList.add('shaka-hidden');
    }
    const label = Dom.createHTMLElement('label');
    label.classList.add('shaka-overflow-button-label');
    label.classList.add('shaka-overflow-menu-only');
    this.airplayNameSpan_ = Dom.createHTMLElement('span');
    label.appendChild(this.airplayNameSpan_);
    this.airplayCurrentSelectionSpan_ = Dom.createHTMLElement('span');
    this.airplayCurrentSelectionSpan_.classList.add(
        'shaka-current-selection-span');
    label.appendChild(this.airplayCurrentSelectionSpan_);
    this.airplayButton_.appendChild(label);
    this.parent.appendChild(this.airplayButton_);

    // Setup strings in the correct language
    this.updateLocalizedStrings_();

    // Setup button display and state according to the current airplay status
    this.onAirPlayStatusChange_();
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(this.airplayButton_, 'click', () => {
      this.onAirPlayClick_();
    });
    const video = this.controls.getVideo();
    asserts.assert(video != null, 'Should have a video!');
    this.eventManager.listen(
        video, 'webkitplaybacktargetavailabilitychanged', (e) => {
           //@ts-ignore
          const event = (e as AirPlayEvent);
          this.onAirPlayAvailabilityChange_(event);
        });
    this.eventManager.listen(
        video, 'webkitcurrentplaybacktargetiswirelesschanged', () => {
          this.onAirPlayStatusChange_();
        });
  }

  private onAirPlayClick_() {
    const video = this.controls.getVideo();
    asserts.assert(video != null, 'Should have a video!');
     //@ts-ignore
    video.webkitShowPlaybackTargetPicker();
  }

  private onAirPlayAvailabilityChange_(e) {
    const canCast = e.availability == 'available';
    const loadMode = this.player.getLoadMode();
    const srcMode = loadMode == PlayerExports.LoadMode.SRC_EQUALS;
    Utils.setDisplay(this.airplayButton_, canCast && srcMode);
  }

  private onAirPlayStatusChange_() {
    const video = this.controls.getVideo();
    asserts.assert(video != null, 'Should have a video!');
     //@ts-ignore
    const isCasting = video && video.webkitCurrentPlaybackTargetIsWireless;

    // Aria-pressed set to true when casting, set to false otherwise.
    if (isCasting) {
      this.airplayButton_.ariaPressed = 'true';
    } else {
      this.airplayButton_.ariaPressed = 'false';
    }
  }

  private updateLocalizedStrings_() {
    const LocIds = shaka.ui.Locales.Ids;
    this.airplayButton_.ariaLabel = this.localization.resolve(LocIds.AIRPLAY);
    this.airplayNameSpan_.textContent =
        this.localization.resolve(LocIds.AIRPLAY);
  }
}

/**
 * @final
 */
export class Factory implements IFactory {
  /** @override */
  create(rootElement: HTMLElement, controls: Controls) {
    return new AirPlayButton(rootElement, controls);
  }
}
OverflowMenu.registerElement('airplay', new Factory());
//@ts-ignore
Controls.registerElement('airplay', new Factory());
