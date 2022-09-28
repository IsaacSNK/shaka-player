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
  export class OverflowMenu extends shaka.ui.Element {
    private config_: shaka.extern.UIConfiguration;
    private controlsContainer_: HTMLElement;
    private children_: shaka.extern.IUIElement[] = [];
    private overflowMenu_: HTMLElement;
    private overflowMenuButton_: HTMLButtonElement;

    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      this.config_ = this.controls.getConfig();
      this.controlsContainer_ = this.controls.getControlsContainer();
      this.addOverflowMenuButton_();
      this.addOverflowMenu_();
      this.createChildren_();
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
      this.eventManager.listen(
        this.adManager,
        shaka.ads.AdManager.AD_STARTED,
        () => {
          if (this.ad && this.ad.isLinear()) {
            shaka.ui.Utils.setDisplay(this.overflowMenuButton_, false);
          }
        }
      );
      this.eventManager.listen(
        this.adManager,
        shaka.ads.AdManager.AD_STOPPED,
        () => {
          shaka.ui.Utils.setDisplay(this.overflowMenuButton_, true);
        }
      );
      this.eventManager.listen(this.controls, "submenuopen", () => {
        // Hide the main overflow menu if one of the sub menus has
        // been opened.
        shaka.ui.Utils.setDisplay(this.overflowMenu_, false);
      });
      this.eventManager.listen(this.overflowMenu_, "touchstart", (event) => {
        this.controls.setLastTouchEventTime(Date.now());
        event.stopPropagation();
      });
      this.eventManager.listen(this.overflowMenuButton_, "click", () => {
        this.onOverflowMenuButtonClick_();
      });
      this.updateAriaLabel_();
      if (this.ad && this.ad.isLinear()) {
        // There was already an ad.
        shaka.ui.Utils.setDisplay(this.overflowMenuButton_, false);
      }
    }

    /** @override */
    release() {
      this.controlsContainer_ = null;
      for (const element of this.children_) {
        element.release();
      }
      this.children_ = [];
      super.release();
    }

    /**
     * @export
     */
    static registerElement(
      name: string,
      factory: shaka.extern.IUIElement.Factory
    ) {
      shaka.ui.OverflowMenu.elementNamesToFactories_.set(name, factory);
    }

    private addOverflowMenu_() {
      this.overflowMenu_ = shaka.util.Dom.createHTMLElement("div");
      this.overflowMenu_.classList.add("shaka-overflow-menu");
      this.overflowMenu_.classList.add("shaka-no-propagation");
      this.overflowMenu_.classList.add("shaka-show-controls-on-mouse-over");
      this.overflowMenu_.classList.add("shaka-hidden");
      this.controlsContainer_.appendChild(this.overflowMenu_);
    }

    private addOverflowMenuButton_() {
      this.overflowMenuButton_ = shaka.util.Dom.createButton();
      this.overflowMenuButton_.classList.add("shaka-overflow-menu-button");
      this.overflowMenuButton_.classList.add("shaka-no-propagation");
      this.overflowMenuButton_.classList.add("material-icons-round");
      this.overflowMenuButton_.classList.add("shaka-tooltip");
      this.overflowMenuButton_.textContent =
        shaka.ui.Enums.MaterialDesignIcons.OPEN_OVERFLOW;
      this.parent.appendChild(this.overflowMenuButton_);
    }

    private createChildren_() {
      for (const name of this.config_.overflowMenuButtons) {
        if (shaka.ui.OverflowMenu.elementNamesToFactories_.get(name)) {
          const factory =
            shaka.ui.OverflowMenu.elementNamesToFactories_.get(name);
          goog.asserts.assert(this.controls, "Controls should not be null!");
          this.children_.push(
            factory.create(this.overflowMenu_, this.controls)
          );
        } else {
          shaka.log.alwaysWarn(
            "Unrecognized overflow menu element requested:",
            name
          );
        }
      }
    }

    private onOverflowMenuButtonClick_() {
      if (this.controls.anySettingsMenusAreOpen()) {
        this.controls.hideSettingsMenus();
      } else {
        shaka.ui.Utils.setDisplay(this.overflowMenu_, true);
        this.controls.computeOpacity();

        // If overflow menu has currently visible buttons, focus on the
        // first one, when the menu opens.
        const isDisplayed = (element) =>
          element.classList.contains("shaka-hidden") == false;
        const Iterables = shaka.util.Iterables;
        if (Iterables.some(this.overflowMenu_.childNodes, isDisplayed)) {
          // Focus on the first visible child of the overflow menu
          const visibleElements = Iterables.filter(
            this.overflowMenu_.childNodes,
            isDisplayed
          );
          (visibleElements[0] as HTMLElement).focus();
        }
      }
    }

    private updateAriaLabel_() {
      const LocIds = shaka.ui.Locales.Ids;
      this.overflowMenuButton_.ariaLabel = this.localization.resolve(
        LocIds.MORE_SETTINGS
      );
    }
  }
}

namespace shaka.ui.OverflowMenu {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.OverflowMenu(rootElement, controls);
    }
  }
}
shaka.ui.Controls.registerElement(
  "overflow_menu",
  new shaka.ui.OverflowMenu.Factory()
);

namespace shaka.ui.OverflowMenu {
  export const elementNamesToFactories_: Map<
    string,
    shaka.extern.IUIElement.Factory
  > = new Map();
}
