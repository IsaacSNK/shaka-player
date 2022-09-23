/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {CastProxy} from './../lib/cast/cast_proxy';
import {Controls} from './controls';
import {Element} from './element';
import * as Enums from './enums';
goog.require('shaka.ui.Locales');
import {Localization} from './localization';
import * as LocalizationExports from './localization';
import {OverflowMenu} from './overflow_menu';
import * as OverflowMenuExports from './overflow_menu';
import {Utils} from './ui_utils';
import {Dom} from './../lib/util/dom_utils';
import {Error} from './../lib/util/error';
import * as ErrorExports from './../lib/util/error';
import {FakeEvent} from './../lib/util/fake_event';
import * as FakeEventExports from './../lib/util/fake_event';
import {CastProxy} from './../lib/cast/cast_proxy';
import {Controls} from './controls';

/**
 * @final
 * @export
 */
export class CastButton extends Element {
  private castProxy_: CastProxy;
  private castButton_: HTMLButtonElement;
  private castIcon_: HTMLElement;
  castNameSpan_: any;
  castCurrentSelectionSpan_: any;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.castProxy_ = this.controls.getCastProxy();
    this.castButton_ = Dom.createButton();
    this.castButton_.classList.add('shaka-cast-button');
    this.castButton_.classList.add('shaka-tooltip');
    this.castButton_.ariaPressed = 'false';
    this.castIcon_ = Dom.createHTMLElement('i');
    this.castIcon_.classList.add('material-icons-round');
    this.castIcon_.textContent = Enums.MaterialDesignIcons.CAST;
    this.castButton_.appendChild(this.castIcon_);
    const label = Dom.createHTMLElement('label');
    label.classList.add('shaka-overflow-button-label');
    label.classList.add('shaka-overflow-menu-only');
    this.castNameSpan_ = Dom.createHTMLElement('span');
    label.appendChild(this.castNameSpan_);
    this.castCurrentSelectionSpan_ = Dom.createHTMLElement('span');
    this.castCurrentSelectionSpan_.classList.add(
        'shaka-current-selection-span');
    label.appendChild(this.castCurrentSelectionSpan_);
    this.castButton_.appendChild(label);
    this.parent.appendChild(this.castButton_);

    // Setup strings in the correct language
    this.updateLocalizedStrings_();

    // Setup button display and state according to the current cast status
    this.onCastStatusChange_();
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(this.castButton_, 'click', () => {
      this.onCastClick_();
    });
    this.eventManager.listen(this.controls, 'caststatuschanged', () => {
      this.onCastStatusChange_();
    });
  }

  private async onCastClick_() {
    if (this.castProxy_.isCasting()) {
      this.castProxy_.suggestDisconnect();
    } else {
      try {
        this.castButton_.disabled = true;
        await this.castProxy_.cast();
        this.castButton_.disabled = false;
      } catch (error) {
        this.castButton_.disabled = false;
        if (error.code != ErrorExports.Code.CAST_CANCELED_BY_USER) {
          this.controls.dispatchEvent(
              new FakeEvent('error', (new Map()).set('detail', error)));
        }
      }
    }
  }

  private onCastStatusChange_() {
    const canCast = this.castProxy_.canCast() && this.controls.isCastAllowed();
    const isCasting = this.castProxy_.isCasting();
    const materialDesignIcons = Enums.MaterialDesignIcons;
    Utils.setDisplay(this.castButton_, canCast);
    this.castIcon_.textContent =
        isCasting ? materialDesignIcons.EXIT_CAST : materialDesignIcons.CAST;

    // Aria-pressed set to true when casting, set to false otherwise.
    if (canCast) {
      if (isCasting) {
        this.castButton_.ariaPressed = 'true';
      } else {
        this.castButton_.ariaPressed = 'false';
      }
    }
    this.setCurrentCastSelection_();
  }

  private setCurrentCastSelection_() {
    if (this.castProxy_.isCasting()) {
      this.castCurrentSelectionSpan_.textContent =
          this.castProxy_.receiverName();
    } else {
      this.castCurrentSelectionSpan_.textContent =
          this.localization.resolve(shaka.ui.Locales.Ids.OFF);
    }
  }

  private updateLocalizedStrings_() {
    const LocIds = shaka.ui.Locales.Ids;
    this.castButton_.ariaLabel = this.localization.resolve(LocIds.CAST);
    this.castNameSpan_.textContent = this.localization.resolve(LocIds.CAST);

    // If we're not casting, string "not casting" will be displayed,
    // which needs localization.
    this.setCurrentCastSelection_();
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new CastButton(rootElement, controls);
  }
}
OverflowMenu.registerElement('cast', new Factory());
Controls.registerElement('cast', new Factory());
