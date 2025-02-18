/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.ui.Controls");

namespace shaka.ui {
  /**
   * @final
   * @export
   */
  export class BigPlayButton extends shaka.ui.PlayButton {
    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      this.button.classList.add("shaka-play-button");
      this.button.classList.add("shaka-no-propagation");
      this.updateIcon();
      this.updateAriaLabel();
    }

    /** @override */
    updateIcon() {
      if (this.isPaused()) {
        this.button.setAttribute("icon", "play");
      } else {
        this.button.setAttribute("icon", "pause");
      }
    }

    /** @override */
    updateAriaLabel() {
      const LocIds = shaka.ui.Locales.Ids;
      const label = this.isPaused() ? LocIds.PLAY : LocIds.PAUSE;
      this.button.ariaLabel = this.localization.resolve(label);
    }
  }
}
