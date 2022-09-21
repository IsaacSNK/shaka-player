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
export class SkipAdButton extends Element {
  private container_: HTMLElement;
  private counter_: HTMLElement;
  private button_: HTMLButtonElement;

  /**
   * The timer that tracks down the ad progress until it can be skipped.
   *
   */
  private timer_: Timer;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.container_ = Dom.createHTMLElement('div');
    this.container_.classList.add('shaka-skip-ad-container');
    this.parent.appendChild(this.container_);
    this.counter_ = Dom.createHTMLElement('div');
    this.counter_.classList.add('shaka-skip-ad-counter');
    Utils.setDisplay(this.counter_, false);
    this.container_.appendChild(this.counter_);
    this.button_ = Dom.createButton();
    this.button_.classList.add('shaka-skip-ad-button');
    this.button_.disabled = true;
    Utils.setDisplay(this.button_, false);
    this.button_.classList.add('shaka-no-propagation');
    this.container_.appendChild(this.button_);
    this.updateAriaLabel_();
    this.updateLocalizedStrings_();
    this.timer_ = new Timer(() => {
      this.onTimerTick_();
    });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED, () => {
          this.updateAriaLabel_();
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED, () => {
          this.updateAriaLabel_();
          this.updateLocalizedStrings_();
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STARTED, () => {
          this.onAdStarted_();
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_SKIP_STATE_CHANGED, () => {
          this.onSkipStateChanged_();
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STOPPED, () => {
          this.reset_();
        });
    this.eventManager.listen(this.button_, 'click', () => {
      this.ad.skip();
    });
    if (this.ad) {
      // There was already an ad.
      this.onAdStarted_();
    }
  }

  /**
   * @override
   */
  release() {
    this.timer_.stop();
    this.timer_ = null;
    super.release();
  }

  private updateLocalizedStrings_() {
    const LocIds = shaka.ui.Locales.Ids;
    this.button_.textContent = this.localization.resolve(LocIds.SKIP_AD);
  }

  private updateAriaLabel_() {}

  // TODO
  private onAdStarted_() {
    if (this.ad.isSkippable()) {
      Utils.setDisplay(this.button_, true);
      Utils.setDisplay(this.counter_, true);
      this.counter_.textContent = '';
      this.timer_.tickNow();
      this.timer_.tickEvery(0.5);
    }
  }

  private onTimerTick_() {
    asserts.assert(this.ad != null, 'this.ad should exist at this point');
    const secondsLeft = Math.round(this.ad.getTimeUntilSkippable());
    if (secondsLeft > 0) {
      this.counter_.textContent = secondsLeft;
    } else {
      // The ad should now be skippable. OnSkipStateChanged() is
      // listening for a SKIP_STATE_CHANGED event and will take care
      // of the button. Here we just stop the timer and hide the counter.
      // NOTE: onSkipStateChanged_() also hides the counter.
      this.timer_.stop();
      Utils.setDisplay(this.counter_, false);
    }
  }

  private onSkipStateChanged_() {
    // Double-check that the ad is now skippable
    if (this.ad.canSkipNow()) {
      this.button_.disabled = false;
      this.timer_.stop();
      Utils.setDisplay(this.counter_, false);
    }
  }

  private reset_() {
    this.timer_.stop();
    this.button_.disabled = true;
    Utils.setDisplay(this.button_, false);
    Utils.setDisplay(this.counter_, false);
  }
}
