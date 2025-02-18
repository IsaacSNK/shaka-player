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
  export class FastForwardButton extends shaka.ui.Element {
    private button_: HTMLButtonElement;
    private fastForwardRates_: number[];

    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      this.button_ = shaka.util.Dom.createButton();
      this.button_.classList.add("material-icons-round");
      this.button_.classList.add("shaka-fast-forward-button");
      this.button_.classList.add("shaka-tooltip-status");
      this.button_.setAttribute("shaka-status", "1x");
      this.button_.textContent =
        shaka.ui.Enums.MaterialDesignIcons.FAST_FORWARD;
      this.parent.appendChild(this.button_);
      this.updateAriaLabel_();
      this.fastForwardRates_ = this.controls.getConfig().fastForwardRates;
      this.eventManager.listen(
        this.localization,
        shaka.ui.Localization.LOCALE_UPDATED,
        () => {
          this.updateAriaLabel_();
        }
      );
      this.eventManager.listen(
        this.localization,
        shaka.ui.Localization.LOCALE_CHANGED,
        () => {
          this.updateAriaLabel_();
        }
      );
      this.eventManager.listen(this.button_, "click", () => {
        this.fastForward_();
      });
    }

    private updateAriaLabel_() {
      this.button_.ariaLabel = this.localization.resolve(
        shaka.ui.Locales.Ids.FAST_FORWARD
      );
    }

    /**
     * Cycles trick play rate between the selected fast forward rates.
     */
    private fastForward_() {
      if (!this.video.duration) {
        return;
      }
      const trickPlayRate = this.player.getPlaybackRate();
      const newRateIndex = this.fastForwardRates_.indexOf(trickPlayRate) + 1;

      // When the button is clicked, the next rate in this.fastForwardRates_ is
      // selected. If no more rates are available, the first one is set.
      const newRate =
        newRateIndex != this.fastForwardRates_.length
          ? this.fastForwardRates_[newRateIndex]
          : this.fastForwardRates_[0];
      this.player.trickPlay(newRate);
      this.button_.setAttribute("shaka-status", newRate + "x");
    }
  }
}

namespace shaka.ui.FastForwardButton {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.FastForwardButton(rootElement, controls);
    }
  }
}
shaka.ui.Controls.registerElement(
  "fast_forward",
  new shaka.ui.FastForwardButton.Factory()
);
