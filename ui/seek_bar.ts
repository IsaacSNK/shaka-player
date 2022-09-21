/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as AdManagerExports from './dev-workspace.shaka-player-fork.lib.ads.ad_manager';
import {AdManager} from './dev-workspace.shaka-player-fork.lib.ads.ad_manager';
import * as Constants from './dev-workspace.shaka-player-fork.ui.constants';

goog.require('shaka.ui.Locales');
import {Localization} from './dev-workspace.shaka-player-fork.ui.localization';
import * as LocalizationExports from './dev-workspace.shaka-player-fork.ui.localization';
import {RangeElement} from './dev-workspace.shaka-player-fork.ui.range_element';
import {Utils} from './dev-workspace.shaka-player-fork.ui.ui_utils';
import {Dom} from './dev-workspace.shaka-player-fork.lib.util.dom_utils';
import {Timer} from './dev-workspace.shaka-player-fork.lib.util.timer';
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';

/**
 * @final
 * @export
 */
export class SeekBar extends RangeElement implements shaka.
extern.IUISeekBar {
  private adMarkerContainer_: HTMLElement;
  private config_: shaka.extern.UIConfiguration;

  /**
   * This timer is used to introduce a delay between the user scrubbing across
   * the seek bar and the seek being sent to the player.
   *
   */
  private seekTimer_: Timer;

  /**
   * The timer is activated for live content and checks if
   * new ad breaks need to be marked in the current seek range.
   *
   */
  private adBreaksTimer_: Timer;

  /**
   * When user is scrubbing the seek bar - we should pause the video - see
   * https://github.com/google/shaka-player/pull/2898#issuecomment-705229215
   * but will conditionally pause or play the video after scrubbing
   * depending on its previous state
   *
   */
  private wasPlaying_: boolean = false;
  private adCuePoints_: shaka.extern.AdCuePoint[] = [];

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls, ['shaka-seek-bar-container'], [
      'shaka-seek-bar', 'shaka-no-propagation',
      'shaka-show-controls-on-mouse-over'
    ]);
    this.adMarkerContainer_ = Dom.createHTMLElement('div');
    this.adMarkerContainer_.classList.add('shaka-ad-markers');

    // Insert the ad markers container as a first child for proper
    // positioning.
    this.container.insertBefore(
        this.adMarkerContainer_, this.container.childNodes[0]);
    this.config_ = this.controls.getConfig();
    this.seekTimer_ = new Timer(() => {
      this.video.currentTime = this.getValue();
    });
    this.adBreaksTimer_ = new Timer(() => {
      this.markAdBreaks_();
    });
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_UPDATED,
        () => this.updateAriaLabel_());
    this.eventManager.listen(
        this.localization, LocalizationExports.LOCALE_CHANGED,
        () => this.updateAriaLabel_());
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STARTED, () => {
          if (!this.shouldBeDisplayed_()) {
            Utils.setDisplay(this.container, false);
          }
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.AD_STOPPED, () => {
          if (this.shouldBeDisplayed_()) {
            Utils.setDisplay(this.container, true);
          }
        });
    this.eventManager.listen(
        this.adManager, AdManagerExports.CUEPOINTS_CHANGED, (e) => {
          this.adCuePoints_ = e['cuepoints'];
          this.onAdCuePointsChanged_();
        });
    this.eventManager.listen(this.player, 'unloading', () => {
      this.adCuePoints_ = [];
      this.onAdCuePointsChanged_();
    });

    // Initialize seek state and label.
    this.setValue(this.video.currentTime);
    this.update();
    this.updateAriaLabel_();
    if (this.ad) {
      // There was already an ad.
      Utils.setDisplay(this.container, false);
    }
  }

  /** @override */
  release() {
    if (this.seekTimer_) {
      this.seekTimer_.stop();
      this.seekTimer_ = null;
      this.adBreaksTimer_.stop();
      this.adBreaksTimer_ = null;
    }
    super.release();
  }

  /**
   * Called by the base class when user interaction with the input element
   * begins.
   *
   * @override
   */
  onChangeStart() {
    this.wasPlaying_ = !this.video.paused;
    this.controls.setSeeking(true);
    this.video.pause();
  }

  /**
   * Update the video element's state to match the input element's state.
   * Called by the base class when the input element changes.
   *
   * @override
   */
  onChange() {
    if (!this.video.duration) {
      // Can't seek yet.  Ignore.
      return;
    }

    // Update the UI right away.
    this.update();

    // We want to wait until the user has stopped moving the seek bar for a
    // little bit to reduce the number of times we ask the player to seek.
    // To do this, we will start a timer that will fire in a little bit, but if
    // we see another seek bar change, we will cancel that timer and re-start
    // it.
    // Calling |start| on an already pending timer will cancel the old request
    // and start the new one.
    this.seekTimer_.tickAfter(
        /* seconds= */
        0.125);
  }

  /**
   * Called by the base class when user interaction with the input element
   * ends.
   *
   * @override
   */
  onChangeEnd() {
    // They just let go of the seek bar, so cancel the timer and manually
    // call the event so that we can respond immediately.
    this.seekTimer_.tickNow();
    this.controls.setSeeking(false);
    if (this.wasPlaying_) {
      this.video.play();
    }
  }

  /**
   * @override
   */
  isShowing() {
    // It is showing by default, so it is hidden if shaka-hidden is in the list.
    return !this.container.classList.contains('shaka-hidden');
  }

  /**
   * @override
   */
  update() {
    const colors = this.config_.seekBarColors;
    const currentTime = this.getValue();
    const bufferedLength = this.video.buffered.length;
    const bufferedStart = bufferedLength ? this.video.buffered.start(0) : 0;
    const bufferedEnd =
        bufferedLength ? this.video.buffered.end(bufferedLength - 1) : 0;
    const seekRange = this.player.seekRange();
    const seekRangeSize = seekRange.end - seekRange.start;
    this.setRange(seekRange.start, seekRange.end);
    if (!this.shouldBeDisplayed_()) {
      Utils.setDisplay(this.container, false);
    } else {
      Utils.setDisplay(this.container, true);
      if (bufferedLength == 0) {
        this.container.style.background = colors.base;
      } else {
        const clampedBufferStart = Math.max(bufferedStart, seekRange.start);
        const clampedBufferEnd = Math.min(bufferedEnd, seekRange.end);
        const clampedCurrentTime =
            Math.min(Math.max(currentTime, seekRange.start), seekRange.end);
        const bufferStartDistance = clampedBufferStart - seekRange.start;
        const bufferEndDistance = clampedBufferEnd - seekRange.start;
        const playheadDistance = clampedCurrentTime - seekRange.start;

        // NOTE: the fallback to zero eliminates NaN.
        const bufferStartFraction = bufferStartDistance / seekRangeSize || 0;
        const bufferEndFraction = bufferEndDistance / seekRangeSize || 0;
        const playheadFraction = playheadDistance / seekRangeSize || 0;
        const unbufferedColor =
            this.config_.showUnbufferedStart ? colors.base : colors.played;
        const gradient = [
          'to right', this.makeColor_(unbufferedColor, bufferStartFraction),
          this.makeColor_(colors.played, bufferStartFraction),
          this.makeColor_(colors.played, playheadFraction),
          this.makeColor_(colors.buffered, playheadFraction),
          this.makeColor_(colors.buffered, bufferEndFraction),
          this.makeColor_(colors.base, bufferEndFraction)
        ];
        this.container.style.background =
            'linear-gradient(' + gradient.join(',') + ')';
      }
    }
  }

  private markAdBreaks_() {
    if (!this.adCuePoints_.length) {
      this.adMarkerContainer_.style.background = 'transparent';
      return;
    }
    const seekRange = this.player.seekRange();
    const seekRangeSize = seekRange.end - seekRange.start;
    const gradient = ['to right'];
    const pointsAsFractions = [];
    const adBreakColor = this.config_.seekBarColors.adBreaks;
    let postRollAd = false;
    for (const point of this.adCuePoints_) {
      // Post-roll ads are marked as starting at -1 in CS IMA ads.
      if (point.start == -1 && !point.end) {
        postRollAd = true;
      }

      // Filter point within the seek range. For points with no endpoint
      // (client side ads) check that the start point is within range.
      if (point.start >= seekRange.start && point.start < seekRange.end) {
        if (point.end && point.end > seekRange.end) {
          continue;
        }
        const startDist = point.start - seekRange.start;
        const startFrac = startDist / seekRangeSize || 0;

        // For points with no endpoint assume a 1% length: not too much,
        // but enough to be visible on the timeline.
        let endFrac = startFrac + 0.01;
        if (point.end) {
          const endDist = point.end - seekRange.start;
          endFrac = endDist / seekRangeSize || 0;
        }
        pointsAsFractions.push({start: startFrac, end: endFrac});
      }
    }
    for (const point of pointsAsFractions) {
      gradient.push(this.makeColor_('transparent', point.start));
      gradient.push(this.makeColor_(adBreakColor, point.start));
      gradient.push(this.makeColor_(adBreakColor, point.end));
      gradient.push(this.makeColor_('transparent', point.end));
    }
    if (postRollAd) {
      gradient.push(this.makeColor_('transparent', 0.99));
      gradient.push(this.makeColor_(adBreakColor, 0.99));
    }
    this.adMarkerContainer_.style.background =
        'linear-gradient(' + gradient.join(',') + ')';
  }

  private makeColor_(color: string, fract: number): string {
    return color + ' ' + fract * 100 + '%';
  }

  private onAdCuePointsChanged_() {
    this.markAdBreaks_();
    const seekRange = this.player.seekRange();
    const seekRangeSize = seekRange.end - seekRange.start;
    const minSeekBarWindow = Constants.MIN_SEEK_WINDOW_TO_SHOW_SEEKBAR;

    // Seek range keeps changing for live content and some of the known
    // ad breaks might not be in the seek range now, but get into
    // it later.
    // If we have a LIVE seekable content, keep checking for ad breaks
    // every second.
    if (this.player.isLive() && seekRangeSize > minSeekBarWindow) {
      this.adBreaksTimer_.tickEvery(1);
    }
  }

  private shouldBeDisplayed_(): boolean {
    // The seek bar should be hidden when the seek window's too small or
    // there's an ad playing.
    const seekRange = this.player.seekRange();
    const seekRangeSize = seekRange.end - seekRange.start;
    if (this.player.isLive() &&
        seekRangeSize < Constants.MIN_SEEK_WINDOW_TO_SHOW_SEEKBAR) {
      return false;
    }
    return this.ad == null || !this.ad.isLinear();
  }

  private updateAriaLabel_() {
    this.bar.ariaLabel = this.localization.resolve(shaka.ui.Locales.Ids.SEEK);
  }
}

/**
 * @export
 */
export class Factory implements shaka.
extern.IUISeekBar.Factory {
  /**
   * Creates a shaka.ui.SeekBar. Use this factory to register the default
   * SeekBar when needed
   *
   * @override
   */
  create(rootElement, controls) {
    return new SeekBar(rootElement, controls);
  }
}
