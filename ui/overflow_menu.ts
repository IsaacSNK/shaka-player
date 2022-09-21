/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as AdManagerExports from './ads___ad_manager';
import {AdManager} from './ads___ad_manager';
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as logExports from './debug___log';
import {log} from './debug___log';
import {Controls} from './ui___controls';
import {Element} from './ui___element';
import * as Enums from './ui___enums';

goog.require('shaka.ui.Locales');
import {Localization} from './ui___localization';
import * as LocalizationExports from './ui___localization';
import {Utils} from './ui___ui_utils';
import {Dom} from './util___dom_utils';
import {Iterables} from './util___iterables';

/**
 * @final
 * @export
 */
export class OverflowMenu extends Element {
  private config_: shaka.extern.UIConfiguration;
  private controlsContainer_: HTMLElement;
  private children_: shaka.extern.IUIElement[] = [];
  private overflowMenu_: HTMLElement;
  private overflowMenuButton_: HTMLButtonElement;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.config_ = this.controls.getConfig();
    this.controlsContainer_ = this.controls.getControlsContainer();
    this.addOverflowMenuButton_();
    this.addOverflowMenu_();
    this.createChildren_();
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateAriaLabel_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateAriaLabel_();
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STARTED, () => {
          if (this.ad && this.ad.isLinear()) {
            Utils.setDisplay(this.overflowMenuButton_, false);
          }
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STOPPED, () => {
          Utils.setDisplay(this.overflowMenuButton_, true);
        });
    this.eventManager.listen(this.controls, 'submenuopen', () => {
      // Hide the main overflow menu if one of the sub menus has
      // been opened.
      Utils.setDisplay(this.overflowMenu_, false);
    });
    this.eventManager.listen(this.overflowMenu_, 'touchstart', (event) => {
      this.controls.setLastTouchEventTime(Date.now());
      event.stopPropagation();
    });
    this.eventManager.listen(this.overflowMenuButton_, 'click', () => {
      this.onOverflowMenuButtonClick_();
    });
    this.updateAriaLabel_();
    if (this.ad && this.ad.isLinear()) {
      // There was already an ad.
      Utils.setDisplay(this.overflowMenuButton_, false);
    }
  }

  /** @override */
  release() {
    this.controlsContainer_ = null;
    for (const element of this.children_) {
      element.release();
    }
    this.children_ = [];
    super.release();
  }

  /**
   * @export
   */
  static registerElement(
      name: string, factory: shaka.extern.IUIElement.Factory) {
    elementNamesToFactories_.set(name, factory);
  }

  private addOverflowMenu_() {
    this.overflowMenu_ = Dom.createHTMLElement('div');
    this.overflowMenu_.classList.add('shaka-overflow-menu');
    this.overflowMenu_.classList.add('shaka-no-propagation');
    this.overflowMenu_.classList.add('shaka-show-controls-on-mouse-over');
    this.overflowMenu_.classList.add('shaka-hidden');
    this.controlsContainer_.appendChild(this.overflowMenu_);
  }

  private addOverflowMenuButton_() {
    this.overflowMenuButton_ = Dom.createButton();
    this.overflowMenuButton_.classList.add('shaka-overflow-menu-button');
    this.overflowMenuButton_.classList.add('shaka-no-propagation');
    this.overflowMenuButton_.classList.add('material-icons-round');
    this.overflowMenuButton_.classList.add('shaka-tooltip');
    this.overflowMenuButton_.textContent =
        Enums.MaterialDesignIcons.OPEN_OVERFLOW;
    this.parent.appendChild(this.overflowMenuButton_);
  }

  private createChildren_() {
    for (const name of this.config_.overflowMenuButtons) {
      if (elementNamesToFactories_.get(name)) {
        const factory = elementNamesToFactories_.get(name);
        asserts.assert(this.controls, 'Controls should not be null!');
        this.children_.push(factory.create(this.overflowMenu_, this.controls));
      } else {
        log.alwaysWarn('Unrecognized overflow menu element requested:', name);
      }
    }
  }

  private onOverflowMenuButtonClick_() {
    if (this.controls.anySettingsMenusAreOpen()) {
      this.controls.hideSettingsMenus();
    } else {
      Utils.setDisplay(this.overflowMenu_, true);
      this.controls.computeOpacity();

      // If overflow menu has currently visible buttons, focus on the
      // first one, when the menu opens.
      const isDisplayed = (element) =>
          element.classList.contains('shaka-hidden') == false;
      const Iterables = Iterables;
      if (Iterables.some(this.overflowMenu_.childNodes, isDisplayed)) {
        // Focus on the first visible child of the overflow menu
        const visibleElements =
            Iterables.filter(this.overflowMenu_.childNodes, isDisplayed);
        (visibleElements[0] as HTMLElement).focus();
      }
    }
  }

  private updateAriaLabel_() {
    const LocIds = shaka.ui.Locales.Ids;
    this.overflowMenuButton_.ariaLabel =
        this.localization.resolve(LocIds.MORE_SETTINGS);
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new OverflowMenu(rootElement, controls);
  }
}
Controls.registerElement('overflow_menu', new Factory());

export const elementNamesToFactories_:
    Map<string, shaka.extern.IUIElement.Factory> = new Map();
