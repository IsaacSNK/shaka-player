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
  export class ContextMenu extends shaka.ui.Element {
    private config_: shaka.extern.UIConfiguration;
    private controlsContainer_: HTMLElement;
    private children_: shaka.extern.IUIElement[] = [];
    private contextMenu_: HTMLElement;

    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      this.config_ = this.controls.getConfig();
      this.controlsContainer_ = this.controls.getControlsContainer();
      this.contextMenu_ = shaka.util.Dom.createHTMLElement("div");
      this.contextMenu_.classList.add("shaka-no-propagation");
      this.contextMenu_.classList.add("shaka-context-menu");
      this.contextMenu_.classList.add("shaka-hidden");
      this.controlsContainer_.appendChild(this.contextMenu_);
      this.eventManager.listen(this.controlsContainer_, "contextmenu", (e) => {
        if (this.contextMenu_.classList.contains("shaka-hidden")) {
          e.preventDefault();
          const controlsLocation =
            this.controlsContainer_.getBoundingClientRect();
          this.contextMenu_.style.left = `${
            e.clientX - controlsLocation.left
          }px`;
          this.contextMenu_.style.top = `${e.clientY - controlsLocation.top}px`;
          shaka.ui.Utils.setDisplay(this.contextMenu_, true);
        } else {
          shaka.ui.Utils.setDisplay(this.contextMenu_, false);
        }
      });
      this.eventManager.listen(window, "click", () => {
        shaka.ui.Utils.setDisplay(this.contextMenu_, false);
      });
      this.createChildren_();
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
      shaka.ui.ContextMenu.elementNamesToFactories_.set(name, factory);
    }

    private createChildren_() {
      for (const name of this.config_.contextMenuElements) {
        const factory = shaka.ui.ContextMenu.elementNamesToFactories_.get(name);
        if (factory) {
          goog.asserts.assert(this.controls, "Controls should not be null!");
          this.children_.push(factory.create(this.contextMenu_, this.controls));
        } else {
          shaka.log.alwaysWarn("Unrecognized context menu element:", name);
        }
      }
    }
  }
}

namespace shaka.ui.ContextMenu {
  export const elementNamesToFactories_: Map<
    string,
    shaka.extern.IUIElement.Factory
  > = new Map();
}
