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
  export class PipButton extends shaka.ui.Element {
    private localVideo_: HTMLMediaElement;
    private pipButton_: HTMLButtonElement;
    private pipIcon_: HTMLElement;
    pipNameSpan_: any;
    private currentPipState_: HTMLElement;

    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      this.localVideo_ = this.controls.getLocalVideo();
      const LocIds = shaka.ui.Locales.Ids;
      this.pipButton_ = shaka.util.Dom.createButton();
      this.pipButton_.classList.add("shaka-pip-button");
      this.pipButton_.classList.add("shaka-tooltip");
      this.pipIcon_ = shaka.util.Dom.createHTMLElement("i");
      this.pipIcon_.classList.add("material-icons-round");
      this.pipIcon_.textContent = shaka.ui.Enums.MaterialDesignIcons.PIP;
      this.pipButton_.appendChild(this.pipIcon_);
      const label = shaka.util.Dom.createHTMLElement("label");
      label.classList.add("shaka-overflow-button-label");
      label.classList.add("shaka-overflow-menu-only");
      this.pipNameSpan_ = shaka.util.Dom.createHTMLElement("span");
      this.pipNameSpan_.textContent = this.localization.resolve(
        LocIds.PICTURE_IN_PICTURE
      );
      label.appendChild(this.pipNameSpan_);
      this.currentPipState_ = shaka.util.Dom.createHTMLElement("span");
      this.currentPipState_.classList.add("shaka-current-selection-span");
      label.appendChild(this.currentPipState_);
      this.pipButton_.appendChild(label);
      this.updateLocalizedStrings_();
      this.parent.appendChild(this.pipButton_);

      // Don't display the button if PiP is not supported or not allowed.
      // TODO: Can this ever change? Is it worth creating the button if the below
      // condition is true?
      if (!this.isPipAllowed_()) {
        shaka.ui.Utils.setDisplay(this.pipButton_, false);
      }
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
      this.eventManager.listen(this.pipButton_, "click", () => {
        this.onPipClick_();
      });
      this.eventManager.listen(
        this.localVideo_,
        "enterpictureinpicture",
        () => {
          this.onEnterPictureInPicture_();
        }
      );
      this.eventManager.listen(
        this.localVideo_,
        "leavepictureinpicture",
        () => {
          this.onLeavePictureInPicture_();
        }
      );
      this.eventManager.listen(this.controls, "caststatuschanged", (e) => {
        this.onCastStatusChange_(e);
      });
      this.eventManager.listen(this.player, "trackschanged", () => {
        this.onTracksChanged_();
      });
    }

    private isPipAllowed_(): boolean {
      return (
        document.pictureInPictureEnabled && !this.video.disablePictureInPicture
      );
    }

    private async onPipClick_(): Promise {
      try {
        if (!document.pictureInPictureElement) {
          // If you were fullscreen, leave fullscreen first.
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          await this.video.requestPictureInPicture();
        } else {
          await document.exitPictureInPicture();
        }
      } catch (error) {
        this.controls.dispatchEvent(
          new shaka.util.FakeEvent("error", new Map().set("detail", error))
        );
      }
    }

    private onEnterPictureInPicture_() {
      const LocIds = shaka.ui.Locales.Ids;
      this.pipIcon_.textContent = shaka.ui.Enums.MaterialDesignIcons.EXIT_PIP;
      this.pipButton_.ariaLabel = this.localization.resolve(
        LocIds.EXIT_PICTURE_IN_PICTURE
      );
      this.currentPipState_.textContent = this.localization.resolve(LocIds.ON);
    }

    private onLeavePictureInPicture_() {
      const LocIds = shaka.ui.Locales.Ids;
      this.pipIcon_.textContent = shaka.ui.Enums.MaterialDesignIcons.PIP;
      this.pipButton_.ariaLabel = this.localization.resolve(
        LocIds.ENTER_PICTURE_IN_PICTURE
      );
      this.currentPipState_.textContent = this.localization.resolve(LocIds.OFF);
    }

    private updateLocalizedStrings_() {
      const LocIds = shaka.ui.Locales.Ids;
      this.pipNameSpan_.textContent = this.localization.resolve(
        LocIds.PICTURE_IN_PICTURE
      );
      const ariaLabel = document.pictureInPictureElement
        ? LocIds.EXIT_PICTURE_IN_PICTURE
        : LocIds.ENTER_PICTURE_IN_PICTURE;
      this.pipButton_.ariaLabel = this.localization.resolve(ariaLabel);
      const currentPipState = document.pictureInPictureElement
        ? LocIds.ON
        : LocIds.OFF;
      this.currentPipState_.textContent =
        this.localization.resolve(currentPipState);
    }

    private onCastStatusChange_(e: Event) {
      const isCasting = e["newStatus"];
      if (isCasting) {
        // Picture-in-picture is not applicable if we're casting
        if (this.isPipAllowed_()) {
          shaka.ui.Utils.setDisplay(this.pipButton_, false);
        }
      } else {
        if (this.isPipAllowed_()) {
          shaka.ui.Utils.setDisplay(this.pipButton_, true);
        }
      }
    }

    /**
     * Display the picture-in-picture button only when the content contains video.
     * If it's displaying in picture-in-picture mode, and an audio only content is
     * loaded, exit the picture-in-picture display.
     */
    private async onTracksChanged_(): Promise {
      if (!this.isPipAllowed_()) {
        shaka.ui.Utils.setDisplay(this.pipButton_, false);
      } else {
        if (this.player && this.player.isAudioOnly()) {
          shaka.ui.Utils.setDisplay(this.pipButton_, false);
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          }
        } else {
          shaka.ui.Utils.setDisplay(this.pipButton_, true);
        }
      }
    }
  }
}

namespace shaka.ui.PipButton {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.PipButton(rootElement, controls);
    }
  }
}
shaka.ui.OverflowMenu.registerElement(
  "picture_in_picture",
  new shaka.ui.PipButton.Factory()
);
shaka.ui.Controls.registerElement(
  "picture_in_picture",
  new shaka.ui.PipButton.Factory()
);
shaka.ui.ContextMenu.registerElement(
  "picture_in_picture",
  new shaka.ui.PipButton.Factory()
);
