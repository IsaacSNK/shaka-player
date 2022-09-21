/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as AdManagerExports from './ads___ad_manager';
import {AdManager} from './ads___ad_manager';
import {Element} from './ui___element';

goog.require('shaka.ui.Locales');
import {Localization} from './ui___localization';
import * as LocalizationExports from './ui___localization';
import {Utils} from './ui___ui_utils';
import {Dom} from './util___dom_utils';
import {Controls} from './ui___controls';

/**
 * @final
 * @export
 */
export class AdPosition extends Element {
  private container_: HTMLElement;
  private span_: HTMLElement;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.container_ = Dom.createHTMLElement('div');
    this.container_.classList.add('shaka-ad-position');
    Utils.setDisplay(this.container_, false);
    this.parent.appendChild(this.container_);
    this.span_ = Dom.createHTMLElement('span');
    this.span_.classList.add('shaka-ad-position-span');
    this.container_.appendChild(this.span_);
    this.updateAriaLabel_();
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          if (!this.ad) {
            return;
          }
          this.updateAriaLabel_();
          this.setPosition_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          if (!this.ad) {
            return;
          }
          this.updateAriaLabel_();
          this.setPosition_();
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STARTED, () => {
          this.setPosition_();
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STOPPED, () => {
          this.span_.textContent = '';
          Utils.setDisplay(this.container_, false);
        });
    if (this.ad) {
      // There was already an ad.
      this.setPosition_();
    }
  }

  private updateAriaLabel_() {}

  // TODO
  private setPosition_() {
    const adsInAdPod = this.ad.getSequenceLength();
    if (adsInAdPod > 1) {
      // If it's a single ad, showing 'Ad 1 of 1' isn't helpful.
      // Only show this element if there's more than 1 ad.
      const LocIds = shaka.ui.Locales.Ids;
      const adPosition = this.ad.getPositionInSequence();
      this.span_.textContent = this.localization.resolve(LocIds.AD_PROGRESS)
                                   .replace('[AD_ON]', String(adPosition))
                                   .replace('[NUM_ADS]', String(adsInAdPod));
      Utils.setDisplay(this.container_, true);
    }
  }
}
