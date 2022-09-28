/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.ui {
  /**
   * @final
   * @export
   */
  export class SmallPlayButton extends shaka.ui.PlayButton {
    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      this.button.classList.add("shaka-small-play-button");
      this.button.classList.add("material-icons-round");
      this.button.classList.add("shaka-tooltip");
      this.updateIcon();
      this.updateAriaLabel();
    }

    /** @override */
    updateIcon() {
      const Icons = shaka.ui.Enums.MaterialDesignIcons;
      if (this.video.ended) {
        this.button.textContent = Icons.REPLAY;
      } else {
        this.button.textContent = this.isPaused() ? Icons.PLAY : Icons.PAUSE;
      }
    }

    /** @override */
    updateAriaLabel() {
      const LocIds = shaka.ui.Locales.Ids;
      if (this.video.ended) {
        this.button.ariaLabel = this.localization.resolve(LocIds.REPLAY);
      } else {
        const label = this.isPaused() ? LocIds.PLAY : LocIds.PAUSE;
        this.button.ariaLabel = this.localization.resolve(label);
      }
    }
  }
}

namespace shaka.ui.SmallPlayButton {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.SmallPlayButton(rootElement, controls);
    }
  }
}
shaka.ui.Controls.registerElement(
  "play_pause",
  new shaka.ui.SmallPlayButton.Factory()
);
