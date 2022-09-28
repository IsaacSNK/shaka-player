/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.ui.Controls");

namespace shaka.ui {
  /**
   * @export
   */
  export class PlayButton extends shaka.ui.Element {
    protected button: HTMLButtonElement;

    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      const AdManager = shaka.ads.AdManager;
      this.button = shaka.util.Dom.createButton();
      this.parent.appendChild(this.button);
      const LOCALE_UPDATED = shaka.ui.Localization.LOCALE_UPDATED;
      this.eventManager.listen(this.localization, LOCALE_UPDATED, () => {
        this.updateAriaLabel();
      });
      const LOCALE_CHANGED = shaka.ui.Localization.LOCALE_CHANGED;
      this.eventManager.listen(this.localization, LOCALE_CHANGED, () => {
        this.updateAriaLabel();
      });
      this.eventManager.listen(this.video, "play", () => {
        this.updateAriaLabel();
        this.updateIcon();
      });
      this.eventManager.listen(this.video, "pause", () => {
        this.updateAriaLabel();
        this.updateIcon();
      });
      this.eventManager.listen(this.video, "seeking", () => {
        this.updateAriaLabel();
        this.updateIcon();
      });
      this.eventManager.listen(this.adManager, AdManager.AD_PAUSED, () => {
        this.updateAriaLabel();
        this.updateIcon();
      });
      this.eventManager.listen(this.adManager, AdManager.AD_RESUMED, () => {
        this.updateAriaLabel();
        this.updateIcon();
      });
      this.eventManager.listen(this.adManager, AdManager.AD_STARTED, () => {
        this.updateAriaLabel();
        this.updateIcon();
      });
      this.eventManager.listen(this.button, "click", () => {
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
    updateAriaLabel() {}

    /**
     * Called when the button's icon needs to change.
     * To be overridden by subclasses.
     */
    updateIcon() {}
  }
}
