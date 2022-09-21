/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';
import {Element} from './dev-workspace.shaka-player-fork.ui.element';
goog.require('shaka.ui.Locales');
import {Utils} from './dev-workspace.shaka-player-fork.ui.ui_utils';
import {Dom} from './dev-workspace.shaka-player-fork.lib.util.dom_utils';

/**
 * @final
 * @export
 */
export class PresentationTimeTracker extends Element {
  currentTime_: HTMLButtonElement;

  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    this.currentTime_ = Dom.createButton();
    this.currentTime_.classList.add('shaka-current-time');
    this.setValue_('0:00');
    this.parent.appendChild(this.currentTime_);
    this.eventManager.listen(this.currentTime_, 'click', () => {
      // Jump to LIVE if the user clicks on the current time.
      if (this.player.isLive()) {
        this.video.currentTime = this.player.seekRange().end;
      }
    });
    this.eventManager.listen(this.controls, 'timeandseekrangeupdated', () => {
      this.updateTime_();
    });
    this.eventManager.listen(this.player, 'trackschanged', () => {
      this.onTracksChanged_();
    });
  }

  private setValue_(value) {
    // To avoid constant updates to the DOM, which makes debugging more
    // difficult, only set the value if it has changed.  If we don't do this
    // check, the DOM updates constantly, this element flashes in the debugger
    // in Chrome, and you can't make changes in the CSS panel.
    if (value != this.currentTime_.textContent) {
      this.currentTime_.textContent = value;
    }
  }

  private updateTime_() {
    const isSeeking = this.controls.isSeeking();
    let displayTime = this.controls.getDisplayTime();
    const duration = this.video.duration;
    const seekRange = this.player.seekRange();
    const seekRangeSize = seekRange.end - seekRange.start;
    const Utils = Utils;
    if (this.player.isLive()) {
      // The amount of time we are behind the live edge.
      const behindLive = Math.floor(seekRange.end - displayTime);
      displayTime = Math.max(0, behindLive);
      const showHour = seekRangeSize >= 3600;

      // Consider "LIVE" when less than 1 second behind the live-edge.  Always
      // show the full time string when seeking, including the leading '-';
      // otherwise, the time string "flickers" near the live-edge.
      // The button should only be clickable when it's live stream content, and
      // the current play time is behind live edge.
      if (displayTime >= 1 || isSeeking) {
        this.setValue_('- ' + Utils.buildTimeString(displayTime, showHour));
        this.currentTime_.disabled = false;
      } else {
        this.setValue_(this.localization.resolve(shaka.ui.Locales.Ids.LIVE));
        this.currentTime_.disabled = true;
      }
    } else {
      const showHour = duration >= 3600;
      let value = Utils.buildTimeString(displayTime, showHour);
      if (duration) {
        value += ' / ' + Utils.buildTimeString(duration, showHour);
      }
      this.setValue_(value);
      this.currentTime_.disabled = true;
    }
  }

  /**
   * Set the aria label to be 'Live' when the content is live stream.
   */
  private onTracksChanged_() {
    if (this.player.isLive()) {
      const ariaLabel = shaka.ui.Locales.Ids.SKIP_TO_LIVE;
      this.currentTime_.ariaLabel = this.localization.resolve(ariaLabel);
    }
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new PresentationTimeTracker(rootElement, controls);
  }
}
Controls.registerElement('time_and_duration', new Factory());
