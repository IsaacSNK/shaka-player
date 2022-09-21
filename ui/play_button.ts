/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{AdManager}from './ad_manager';
import*as AdManagerExports from './ad_manager';
import{Element}from './element';
import{Localization}from './localization';
import*as LocalizationExports from './localization';
import{Dom}from './dom_utils';
import{Controls}from './controls';
 
/**
 * @export
 */ 
export class PlayButton extends Element {
  protected button: HTMLButtonElement;
   
  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    const AdManager = AdManager;
    this.button = Dom.createButton();
    this.parent.appendChild(this.button);
    const LOCALE_UPDATED = LocalizationExports.LOCALE_UPDATED;
    this.eventManager.listen(this.localization, LOCALE_UPDATED,  
    () => {
      this.updateAriaLabel();
    });
    const LOCALE_CHANGED = LocalizationExports.LOCALE_CHANGED;
    this.eventManager.listen(this.localization, LOCALE_CHANGED,  
    () => {
      this.updateAriaLabel();
    });
    this.eventManager.listen(this.video, 'play',  
    () => {
      this.updateAriaLabel();
      this.updateIcon();
    });
    this.eventManager.listen(this.video, 'pause',  
    () => {
      this.updateAriaLabel();
      this.updateIcon();
    });
    this.eventManager.listen(this.video, 'seeking',  
    () => {
      this.updateAriaLabel();
      this.updateIcon();
    });
    this.eventManager.listen(this.adManager, AdManager.AD_PAUSED,  
    () => {
      this.updateAriaLabel();
      this.updateIcon();
    });
    this.eventManager.listen(this.adManager, AdManager.AD_RESUMED,  
    () => {
      this.updateAriaLabel();
      this.updateIcon();
    });
    this.eventManager.listen(this.adManager, AdManager.AD_STARTED,  
    () => {
      this.updateAriaLabel();
      this.updateIcon();
    });
    this.eventManager.listen(this.button, 'click',  
    () => {
      if (this.ad && this.ad.isLinear()) {
        this.controls.playPauseAd();
      } else {
        this.controls.playPausePresentation();
      }
    });
    if (this.ad) {
       
      // There was already an ad. 
      this.updateAriaLabel();
      this.updateIcon();
    }
  }
   
  protected isPaused(): boolean {
    if (this.ad && this.ad.isLinear()) {
      return this.ad.isPaused();
    }
    return this.controls.presentationIsPaused();
  }
   
  /**
     * Called when the button's aria label needs to change.
     * To be overridden by subclasses.
     */ 
  updateAriaLabel() {
  }
   
  /**
     * Called when the button's icon needs to change.
     * To be overridden by subclasses.
     */ 
  updateIcon() {
  }
}
