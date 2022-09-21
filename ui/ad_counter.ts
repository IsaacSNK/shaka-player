/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as AdManagerExports from './dev-workspace.shaka-player-fork.lib.ads.ad_manager';
import {AdManager} from './dev-workspace.shaka-player-fork.lib.ads.ad_manager';
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {Element} from './dev-workspace.shaka-player-fork.ui.element';

goog.require('shaka.ui.Locales');
import {Localization} from './dev-workspace.shaka-player-fork.ui.localization';
import * as LocalizationExports from './dev-workspace.shaka-player-fork.ui.localization';
import {Utils} from './dev-workspace.shaka-player-fork.ui.ui_utils';
import {Dom} from './dev-workspace.shaka-player-fork.lib.util.dom_utils';
import {Timer} from './dev-workspace.shaka-player-fork.lib.util.timer';
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';

/**
 * @final
 * @export
 */
export class AdCounter extends Element {
  private container_: HTMLElement;
  private span_: HTMLElement;

  /**
   * The timer that tracks down the ad progress.
   *
   */
  private timer_: Timer;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.container_ = Dom.createHTMLElement('div');
    this.container_.classList.add('shaka-ad-counter');
    this.parent.appendChild(this.container_);
    this.span_ = Dom.createHTMLElement('span');
    this.span_.classList.add('shaka-ad-counter-span');
    this.container_.appendChild(this.span_);
    this.timer_ = new Timer(() => {
      this.onTimerTick_();
    });
    this.updateAriaLabel_();
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
          this.onAdStarted_();
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STOPPED, () => {
          this.reset_();
        });
    if (this.ad) {
      // There was already an ad.
      this.onAdStarted_();
    }
  }

  private updateAriaLabel_() {}

  // TODO
  private onAdStarted_() {
    this.timer_.tickNow();
    this.timer_.tickEvery(0.5);
  }

  private onTimerTick_() {
    asserts.assert(this.ad != null, 'this.ad should exist at this point');
    const secondsLeft = Math.round(this.ad.getRemainingTime());
    const adDuration = this.ad.getDuration();
    if (secondsLeft == -1 || adDuration == -1) {
      // Not enough information about the ad. Don't show the
      // counter just yet.
      return;
    }
    if (secondsLeft > 0) {
      const timePassed = adDuration - secondsLeft;
      const timePassedStr = Utils.buildTimeString(
          timePassed,
          /* showHour= */
          false);
      const adLength = Utils.buildTimeString(
          adDuration,
          /* showHour= */
          false);
      const timeString = timePassedStr + ' / ' + adLength;
      const adsInAdPod = this.ad.getSequenceLength();

      // If there's more than one ad in the sequence, show the time
      // without the word 'Ad' (it will be shown by another element).
      // Otherwise, the format is "Ad: 0:05 / 0:10."
      if (adsInAdPod > 1) {
        this.span_.textContent = timeString;
      } else {
        const LocIds = shaka.ui.Locales.Ids;
        const raw = this.localization.resolve(LocIds.AD_TIME);
        this.span_.textContent = raw.replace('[AD_TIME]', timeString);
      }
    } else {
      this.reset_();
    }
  }

  private reset_() {
    this.timer_.stop();

    // Controls are going to hide the whole ad panel once the ad is over,
    // this is just a safeguard.
    this.span_.textContent = '';
  }

  /**
   * @override
   */
  release() {
    this.timer_.stop();
    this.timer_ = null;
    super.release();
  }
}
