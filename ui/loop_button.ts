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
  export class LoopButton extends shaka.ui.Element {
    private button_: HTMLButtonElement;
    private icon_: HTMLElement;
    nameSpan_: any;
    private currentState_: HTMLElement;
    private loopEnabled_: boolean;

    // No event is fired when the video.loop property changes, so
    // in order to detect a manual change to the property, we have
    // two options:
    // 1) set an observer that gets triggered every time the video
    // object is mutated and check is the loop property was changed.
    // 2) create a timer that checks the state of the loop property
    // regularly.
    // I (ismena) opted to go for #2 as at least video.currentTime
    // will be changing constatntly during playback, to say nothing
    // about other video properties. I expect the timer to be less
    // of a performence hit.
    /**
     * The timer that tracks down the ad progress.
     *
     */
    private timer_: Timer;

    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      const LocIds = shaka.ui.Locales.Ids;
      this.button_ = shaka.util.Dom.createButton();
      this.button_.classList.add("shaka-loop-button");
      this.button_.classList.add("shaka-tooltip");
      this.icon_ = shaka.util.Dom.createHTMLElement("i");
      this.icon_.classList.add("material-icons-round");
      this.icon_.textContent = shaka.ui.Enums.MaterialDesignIcons.LOOP;
      this.button_.appendChild(this.icon_);
      const label = shaka.util.Dom.createHTMLElement("label");
      label.classList.add("shaka-overflow-button-label");
      label.classList.add("shaka-overflow-menu-only");
      this.nameSpan_ = shaka.util.Dom.createHTMLElement("span");
      this.nameSpan_.textContent = this.localization.resolve(LocIds.LOOP);
      label.appendChild(this.nameSpan_);
      this.currentState_ = shaka.util.Dom.createHTMLElement("span");
      this.currentState_.classList.add("shaka-current-selection-span");
      label.appendChild(this.currentState_);
      this.button_.appendChild(label);
      this.updateLocalizedStrings_();
      this.parent.appendChild(this.button_);
      this.eventManager.listen(
        this.localization,
        shaka.ui.Localization.LOCALE_UPDATED,
        () => {
          this.updateLocalizedStrings_();
        }
      );
      this.eventManager.listen(
        this.localization,
        shaka.ui.Localization.LOCALE_CHANGED,
        () => {
          this.updateLocalizedStrings_();
        }
      );
      this.eventManager.listen(this.button_, "click", () => {
        this.onClick_();
      });
      this.loopEnabled_ = this.video.loop;
      this.timer_ = new shaka.util.Timer(() => {
        this.onTimerTick_();
      });
      this.timer_.tickEvery(1);
    }

    /**
     * @override
     */
    release() {
      this.timer_.stop();
      this.timer_ = null;
      super.release();
    }

    private onClick_() {
      this.video.loop = !this.video.loop;
      this.timer_.tickNow();
      this.timer_.tickEvery(1);
    }

    private onTimerTick_() {
      if (this.loopEnabled_ == this.video.loop) {
        return;
      }
      this.updateLocalizedStrings_();
      this.loopEnabled_ = this.video.loop;
    }

    private updateLocalizedStrings_() {
      const LocIds = shaka.ui.Locales.Ids;
      const Icons = shaka.ui.Enums.MaterialDesignIcons;
      this.nameSpan_.textContent = this.localization.resolve(LocIds.LOOP);
      const labelText = this.video.loop ? LocIds.ON : LocIds.OFF;
      this.currentState_.textContent = this.localization.resolve(labelText);
      const icon = this.video.loop ? Icons.UNLOOP : Icons.LOOP;
      this.icon_.textContent = icon;
      const ariaText = this.video.loop
        ? LocIds.EXIT_LOOP_MODE
        : LocIds.ENTER_LOOP_MODE;
      this.button_.ariaLabel = this.localization.resolve(ariaText);
    }
  }
}

namespace shaka.ui.LoopButton {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.LoopButton(rootElement, controls);
    }
  }
}
shaka.ui.OverflowMenu.registerElement(
  "loop",
  new shaka.ui.LoopButton.Factory()
);
shaka.ui.Controls.registerElement("loop", new shaka.ui.LoopButton.Factory());
shaka.ui.ContextMenu.registerElement("loop", new shaka.ui.LoopButton.Factory());
