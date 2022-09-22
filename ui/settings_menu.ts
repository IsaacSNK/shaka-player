/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Dom} from './lib/dom_utils';
import * as FakeEventExports from './lib/fake_event';
import {FakeEvent} from './lib/fake_event';
import {Controls} from './/controls';
import {Element} from './/element';
import * as Enums from './/enums';
import {Utils} from './/ui_utils';

/**
 * @export
 */
export class SettingsMenu extends Element implements shaka.
extern.IUISettingsMenu {
  protected button: HTMLButtonElement;
  protected icon: HTMLElement;
  protected nameSpan: HTMLElement;
  protected currentSelection: HTMLElement;
  protected menu: HTMLElement;
  protected backButton: HTMLButtonElement;
  protected backSpan: HTMLElement;

  constructor(parent: HTMLElement, controls: Controls, iconText: string) {
    super(parent, controls);
    this.addButton_(iconText);
    this.addMenu_();
    this.inOverflowMenu_();
    this.eventManager.listen(this.button, 'click', () => {
      this.onButtonClick_();
    });
  }

  private addButton_(iconText: string) {
    this.button = Dom.createButton();
    this.button.classList.add('shaka-overflow-button');
    this.icon = Dom.createHTMLElement('i');
    this.icon.classList.add('material-icons-round');
    this.icon.textContent = iconText;
    this.button.appendChild(this.icon);
    const label = Dom.createHTMLElement('label');
    label.classList.add('shaka-overflow-button-label');
    label.classList.add('shaka-overflow-menu-only');
    this.nameSpan = Dom.createHTMLElement('span');
    label.appendChild(this.nameSpan);
    this.currentSelection = Dom.createHTMLElement('span');
    this.currentSelection.classList.add('shaka-current-selection-span');
    label.appendChild(this.currentSelection);
    this.button.appendChild(label);
    this.parent.appendChild(this.button);
  }

  private addMenu_() {
    this.menu = Dom.createHTMLElement('div');
    this.menu.classList.add('shaka-no-propagation');
    this.menu.classList.add('shaka-show-controls-on-mouse-over');
    this.menu.classList.add('shaka-settings-menu');
    this.menu.classList.add('shaka-hidden');
    this.backButton = Dom.createButton();
    this.backButton.classList.add('shaka-back-to-overflow-button');
    this.menu.appendChild(this.backButton);
    this.eventManager.listen(this.backButton, 'click', () => {
      this.controls.hideSettingsMenus();
    });
    const backIcon = Dom.createHTMLElement('i');
    backIcon.classList.add('material-icons-round');
    backIcon.textContent = Enums.MaterialDesignIcons.CLOSE;
    this.backButton.appendChild(backIcon);
    this.backSpan = Dom.createHTMLElement('span');
    this.backButton.appendChild(this.backSpan);
    const controlsContainer = this.controls.getControlsContainer();
    controlsContainer.appendChild(this.menu);
  }

  private inOverflowMenu_() {
    // Initially, submenus are created with a "Close" option. When present
    // inside of the overflow menu, that option must be replaced with a
    // "Back" arrow that returns the user to the main menu.
    if (this.parent.classList.contains('shaka-overflow-menu')) {
      this.backButton.firstChild.textContent = Enums.MaterialDesignIcons.BACK;
      this.eventManager.listen(this.backButton, 'click', () => {
        Utils.setDisplay(this.parent, true);
        (this.parent.childNodes[0] as HTMLElement).focus();

        // Make sure controls are displayed
        this.controls.computeOpacity();
      });
    }
  }

  private onButtonClick_() {
    if (this.menu.classList.contains('shaka-hidden')) {
      this.controls.dispatchEvent(new FakeEvent('submenuopen'));
      Utils.setDisplay(this.menu, true);
      Utils.focusOnTheChosenItem(this.menu);
    } else {
      Utils.setDisplay(this.menu, false);
    }
  }
}
