/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{Controls}from './controls';
import{Element}from './element';
import*as Enums from './enums';
goog.require('shaka.ui.Locales');
import{Localization}from './localization';
import*as LocalizationExports from './localization';
import{Dom}from './dom_utils';
 
/**
 * @final
 * @export
 */ 
export class FullscreenButton extends Element {
  private localVideo_: HTMLMediaElement;
  private button_: HTMLButtonElement;
   
  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.localVideo_ = this.controls.getLocalVideo();
    this.button_ = Dom.createButton();
    this.button_.classList.add('shaka-fullscreen-button');
    this.button_.classList.add('material-icons-round');
    this.button_.classList.add('shaka-tooltip');
    this.checkSupport_();
    this.button_.textContent = Enums.MaterialDesignIcons.FULLSCREEN;
    this.parent.appendChild(this.button_);
    this.updateAriaLabel_();
    this.eventManager.listen(this.localization, LocalizationExports.LOCALE_UPDATED,  
    () => {
      this.updateAriaLabel_();
    });
    this.eventManager.listen(this.localization, LocalizationExports.LOCALE_CHANGED,  
    () => {
      this.updateAriaLabel_();
    });
    this.eventManager.listen(this.button_, 'click',  
    async() => {
      await this.controls.toggleFullScreen();
    });
    this.eventManager.listen(document, 'fullscreenchange',  
    () => {
      this.updateIcon_();
      this.updateAriaLabel_();
    });
    this.eventManager.listen(this.localVideo_, 'loadedmetadata',  
    () => {
      this.checkSupport_();
    });
    this.eventManager.listen(this.localVideo_, 'loadeddata',  
    () => {
      this.checkSupport_();
    });
  }
   
  private checkSupport_() {
     
    // Don't show the button if fullscreen is not supported 
    if (!this.controls.isFullScreenSupported()) {
      this.button_.classList.add('shaka-hidden');
    } else {
      this.button_.classList.remove('shaka-hidden');
    }
  }
   
  private updateAriaLabel_() {
    const LocIds = shaka.ui.Locales.Ids;
    const label = this.controls.isFullScreenEnabled() ? LocIds.EXIT_FULL_SCREEN : LocIds.FULL_SCREEN;
    this.button_.ariaLabel = this.localization.resolve(label);
  }
   
  private updateIcon_() {
    this.button_.textContent = this.controls.isFullScreenEnabled() ? Enums.MaterialDesignIcons.EXIT_FULLSCREEN : Enums.MaterialDesignIcons.FULLSCREEN;
  }
}
 
/**
 * @final
 */ 
export class Factory implements shaka.extern.IUIElement.Factory {
   
  /** @override */ 
  create(rootElement, controls) {
    return new FullscreenButton(rootElement, controls);
  }
}
Controls.registerElement('fullscreen', new Factory());
