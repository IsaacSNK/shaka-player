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
  export class AirPlayButton extends shaka.ui.Element {
    private airplayButton_: HTMLButtonElement;
    private airplayIcon_: HTMLElement;
    airplayNameSpan_: any;
    airplayCurrentSelectionSpan_: any;

    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      this.airplayButton_ = shaka.util.Dom.createButton();
      this.airplayButton_.classList.add("shaka-airplay-button");
      this.airplayButton_.classList.add("shaka-tooltip");
      this.airplayButton_.ariaPressed = "false";
      this.airplayIcon_ = shaka.util.Dom.createHTMLElement("i");
      this.airplayIcon_.classList.add("material-icons-round");
      this.airplayIcon_.textContent =
        shaka.ui.Enums.MaterialDesignIcons.AIRPLAY;
      this.airplayButton_.appendChild(this.airplayIcon_);

      // Don't show the button if AirPlay is not supported.
      if (!window.WebKitPlaybackTargetAvailabilityEvent) {
        this.airplayButton_.classList.add("shaka-hidden");
      }
      const label = shaka.util.Dom.createHTMLElement("label");
      label.classList.add("shaka-overflow-button-label");
      label.classList.add("shaka-overflow-menu-only");
      this.airplayNameSpan_ = shaka.util.Dom.createHTMLElement("span");
      label.appendChild(this.airplayNameSpan_);
      this.airplayCurrentSelectionSpan_ =
        shaka.util.Dom.createHTMLElement("span");
      this.airplayCurrentSelectionSpan_.classList.add(
        "shaka-current-selection-span"
      );
      label.appendChild(this.airplayCurrentSelectionSpan_);
      this.airplayButton_.appendChild(label);
      this.parent.appendChild(this.airplayButton_);

      // Setup strings in the correct language
      this.updateLocalizedStrings_();

      // Setup button display and state according to the current airplay status
      this.onAirPlayStatusChange_();
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
      this.eventManager.listen(this.airplayButton_, "click", () => {
        this.onAirPlayClick_();
      });
      const video = this.controls.getVideo();
      goog.asserts.assert(video != null, "Should have a video!");
      this.eventManager.listen(
        video,
        "webkitplaybacktargetavailabilitychanged",
        (e) => {
          const event = e as AirPlayEvent;
          this.onAirPlayAvailabilityChange_(event);
        }
      );
      this.eventManager.listen(
        video,
        "webkitcurrentplaybacktargetiswirelesschanged",
        () => {
          this.onAirPlayStatusChange_();
        }
      );
    }

    private onAirPlayClick_() {
      const video = this.controls.getVideo();
      goog.asserts.assert(video != null, "Should have a video!");
      video.webkitShowPlaybackTargetPicker();
    }

    private onAirPlayAvailabilityChange_(e) {
      const canCast = e.availability == "available";
      const loadMode = this.player.getLoadMode();
      const srcMode = loadMode == shaka.Player.LoadMode.SRC_EQUALS;
      shaka.ui.Utils.setDisplay(this.airplayButton_, canCast && srcMode);
    }

    private onAirPlayStatusChange_() {
      const video = this.controls.getVideo();
      goog.asserts.assert(video != null, "Should have a video!");
      const isCasting = video && video.webkitCurrentPlaybackTargetIsWireless;

      // Aria-pressed set to true when casting, set to false otherwise.
      if (isCasting) {
        this.airplayButton_.ariaPressed = "true";
      } else {
        this.airplayButton_.ariaPressed = "false";
      }
    }

    private updateLocalizedStrings_() {
      const LocIds = shaka.ui.Locales.Ids;
      this.airplayButton_.ariaLabel = this.localization.resolve(LocIds.AIRPLAY);
      this.airplayNameSpan_.textContent = this.localization.resolve(
        LocIds.AIRPLAY
      );
    }
  }
}

namespace shaka.ui.AirPlayButton {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.AirPlayButton(rootElement, controls);
    }
  }
}
shaka.ui.OverflowMenu.registerElement(
  "airplay",
  new shaka.ui.AirPlayButton.Factory()
);
shaka.ui.Controls.registerElement(
  "airplay",
  new shaka.ui.AirPlayButton.Factory()
);
