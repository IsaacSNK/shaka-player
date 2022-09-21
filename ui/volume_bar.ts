/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{AdManager}from './ad_manager';
import*as AdManagerExports from './ad_manager';
import{Controls}from './controls';
goog.require('shaka.ui.Locales');
import{Localization}from './localization';
import*as LocalizationExports from './localization';
import{RangeElement}from './range_element';
 
/**
 * @final
 * @export
 */ 
export class VolumeBar extends RangeElement {
  private config_: shaka.extern.UIConfiguration;
   
  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls, ['shaka-volume-bar-container'], ['shaka-volume-bar']);
    this.config_ = this.controls.getConfig();
    this.eventManager.listen(this.video, 'volumechange',  
    () => this.onPresentationVolumeChange_());
    this.eventManager.listen(this.adManager, AdManagerExports.AD_VOLUME_CHANGED,  
    () => this.onAdVolumeChange_());
    this.eventManager.listen(this.adManager, AdManagerExports.AD_MUTED,  
    () => this.onAdVolumeChange_());
    this.eventManager.listen(this.adManager, AdManagerExports.AD_STOPPED,  
    () => this.onPresentationVolumeChange_());
    this.eventManager.listen(this.localization, LocalizationExports.LOCALE_UPDATED,  
    () => this.updateAriaLabel_());
    this.eventManager.listen(this.localization, LocalizationExports.LOCALE_CHANGED,  
    () => this.updateAriaLabel_());
     
    // Initialize volume display and label. 
    this.onPresentationVolumeChange_();
    this.updateAriaLabel_();
    if (this.ad) {
       
      // There was already an ad. 
      this.onChange();
    }
  }
   
  /**
     * Update the video element's state to match the input element's state.
     * Called by the base class when the input element changes.
     *
     * @override
     */ 
  onChange() {
    if (this.ad && this.ad.isLinear()) {
      this.ad.setVolume(this.getValue());
    } else {
      this.video.volume = this.getValue();
      if (this.video.volume == 0) {
        this.video.muted = true;
      } else {
        this.video.muted = false;
      }
    }
  }
   
  private onPresentationVolumeChange_() {
    if (this.video.muted) {
      this.setValue(0);
    } else {
      this.setValue(this.video.volume);
    }
    this.updateColors_();
  }
   
  private onAdVolumeChange_() {
    asserts.assert(this.ad != null, 'This.ad should exist at this point!');
    const volume = this.ad.getVolume();
    this.setValue(volume);
    this.updateColors_();
  }
   
  private updateColors_() {
    const colors = this.config_.volumeBarColors;
    const gradient = ['to right'];
    gradient.push(colors.level + this.getValue() * 100 + '%');
    gradient.push(colors.base + this.getValue() * 100 + '%');
    gradient.push(colors.base + '100%');
    this.container.style.background = 'linear-gradient(' + gradient.join(',') + ')';
  }
   
  private updateAriaLabel_() {
    this.bar.ariaLabel = this.localization.resolve(shaka.ui.Locales.Ids.VOLUME);
  }
}
 
/**
 * @final
 */ 
export class Factory implements shaka.extern.IUIElement.Factory {
   
  /** @override */ 
  create(rootElement, controls) {
    return new VolumeBar(rootElement, controls);
  }
}
Controls.registerElement('volume', new Factory());
