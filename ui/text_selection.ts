/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{Controls}from './controls';
import*as Enums from './enums';
goog.require('shaka.ui.LanguageUtils');
goog.require('shaka.ui.Locales');
import{Localization}from './localization';
import*as LocalizationExports from './localization';
import{OverflowMenu}from './overflow_menu';
import*as OverflowMenuExports from './overflow_menu';
import{SettingsMenu}from './settings_menu';
import{Utils}from './ui_utils';
import{Dom}from './dom_utils';
import{FakeEvent}from './fake_event';
import*as FakeEventExports from './fake_event';
import{Controls}from './controls';
 
/**
 * @final
 * @export
 */ 
export class TextSelection extends SettingsMenu {
  private captionsOffSpan_: HTMLElement;
   
  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls, Enums.MaterialDesignIcons.CLOSED_CAPTIONS);
    this.button.classList.add('shaka-caption-button');
    this.button.classList.add('shaka-tooltip-status');
    this.menu.classList.add('shaka-text-languages');
    if (this.player && this.player.isTextTrackVisible()) {
      this.button.ariaPressed = 'true';
    } else {
      this.button.ariaPressed = 'false';
    }
    this.addOffOption_();
    this.eventManager.listen(this.localization, LocalizationExports.LOCALE_UPDATED,  
    () => {
      this.updateLocalizedStrings_();
       
      // If captions/subtitles are off, this string needs localization.
      // TODO: is there a more efficient way of updating just the strings
      // we need instead of running the whole language update? 
      this.updateTextLanguages_();
    });
    this.eventManager.listen(this.localization, LocalizationExports.LOCALE_CHANGED,  
    () => {
      this.updateLocalizedStrings_();
       
      // If captions/subtitles are off, this string needs localization.
      // TODO: is there a more efficient way of updating just the strings
      // we need instead of running the whole language update? 
      this.updateTextLanguages_();
    });
    this.eventManager.listen(this.player, 'texttrackvisibility',  
    () => {
      this.onCaptionStateChange_();
      this.updateTextLanguages_();
    });
    this.eventManager.listen(this.player, 'textchanged',  
    () => {
      this.updateTextLanguages_();
    });
    this.eventManager.listen(this.player, 'trackschanged',  
    () => {
      this.onTracksChanged_();
    });
     
    // Initialize caption state with a fake event. 
    this.onCaptionStateChange_();
     
    // Set up all the strings in the user's preferred language. 
    this.updateLocalizedStrings_();
    this.updateTextLanguages_();
    this.onTracksChanged_();
  }
   
  private addOffOption_() {
    const off = Dom.createButton();
    off.ariaSelected = 'true';
    this.menu.appendChild(off);
    off.appendChild(Utils.checkmarkIcon());
    this.captionsOffSpan_ = Dom.createHTMLElement('span');
    this.captionsOffSpan_.classList.add('shaka-auto-span');
    off.appendChild(this.captionsOffSpan_);
  }
   
  private onCaptionStateChange_() {
    if (this.player.isTextTrackVisible()) {
      this.icon.textContent = Enums.MaterialDesignIcons.CLOSED_CAPTIONS;
      this.button.ariaPressed = 'true';
    } else {
      this.icon.textContent = Enums.MaterialDesignIcons.CLOSED_CAPTIONS_OFF;
      this.button.ariaPressed = 'false';
    }
    this.controls.dispatchEvent(new FakeEvent('captionselectionupdated'));
  }
   
  private updateTextLanguages_() {
    const tracks = this.player.getTextTracks();
    shaka.ui.LanguageUtils.updateTracks(tracks, this.menu,  
    (track) => this.onTextTrackSelected_(track),  
    // Don't mark current text language as chosen unless captions are
    // enabled 
    this.player.isTextTrackVisible(), this.currentSelection, this.localization, this.controls.getConfig().trackLabelFormat);
     
    // Add the Off button 
    const offButton = Dom.createButton();
    offButton.classList.add('shaka-turn-captions-off-button');
    this.eventManager.listen(offButton, 'click',  
    () => {
      this.player.setTextTrackVisibility(false);
      this.updateTextLanguages_();
    });
    offButton.appendChild(this.captionsOffSpan_);
    this.menu.appendChild(offButton);
    if (!this.player.isTextTrackVisible()) {
      offButton.ariaSelected = 'true';
      offButton.appendChild(Utils.checkmarkIcon());
      this.captionsOffSpan_.classList.add('shaka-chosen-item');
      this.currentSelection.textContent = this.localization.resolve(shaka.ui.Locales.Ids.OFF);
    }
    this.button.setAttribute('shaka-status', this.currentSelection.textContent);
    Utils.focusOnTheChosenItem(this.menu);
    this.controls.dispatchEvent(new FakeEvent('captionselectionupdated'));
  }
   
  private async onTextTrackSelected_(track: shaka.extern.Track): Promise {
     
    // setTextTrackVisibility should be called after selectTextTrack.
    // selectTextTrack sets a text stream, and setTextTrackVisiblity(true)
    // will set a text stream if it isn't already set. Consequently, reversing
    // the order of these calls makes two languages display simultaneously
    // if captions are turned off -> on in a different language. 
    this.player.selectTextTrack(track);
    await this.player.setTextTrackVisibility(true);
  }
   
  private updateLocalizedStrings_() {
    const LocIds = shaka.ui.Locales.Ids;
    this.button.ariaLabel = this.localization.resolve(LocIds.CAPTIONS);
    this.backButton.ariaLabel = this.localization.resolve(LocIds.BACK);
    this.nameSpan.textContent = this.localization.resolve(LocIds.CAPTIONS);
    this.backSpan.textContent = this.localization.resolve(LocIds.CAPTIONS);
    this.captionsOffSpan_.textContent = this.localization.resolve(LocIds.OFF);
  }
   
  private onTracksChanged_() {
    const hasText = this.player.getTextTracks().length > 0;
    Utils.setDisplay(this.button, hasText);
    this.updateTextLanguages_();
  }
}
 
/**
 * @final
 */ 
export class Factory implements shaka.extern.IUIElement.Factory {
   
  /** @override */ 
  create(rootElement, controls) {
    return new TextSelection(rootElement, controls);
  }
}
OverflowMenu.registerElement('captions', new Factory());
Controls.registerElement('captions', new Factory());
