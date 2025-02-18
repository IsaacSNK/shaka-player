/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.ui {
  export class Utils {
    static getFirstDescendantWithClassName(
      element: HTMLElement,
      className: string
    ): HTMLElement {
      // TODO: This can be replaced by shaka.util.Dom.getElementByClassName
      const descendant = shaka.ui.Utils.getDescendantIfExists(
        element,
        className
      );
      goog.asserts.assert(descendant != null, "Should not be null!");
      return descendant;
    }

    static getDescendantIfExists(
      element: HTMLElement,
      className: string
    ): HTMLElement | null {
      const childrenWithClassName = element.getElementsByClassName(className);
      if (childrenWithClassName.length) {
        return childrenWithClassName[0] as HTMLElement;
      }
      return null;
    }

    /**
     * Finds a descendant of |menu| that has a 'shaka-chosen-item' class
     * and focuses on its' parent.
     *
     */
    static focusOnTheChosenItem(menu: HTMLElement) {
      if (!menu) {
        return;
      }
      const chosenItem = shaka.ui.Utils.getDescendantIfExists(
        menu,
        "shaka-chosen-item"
      );
      if (chosenItem) {
        chosenItem.parentElement.focus();
      }
    }

    static checkmarkIcon(): Element {
      const icon = shaka.util.Dom.createHTMLElement("i");
      icon.classList.add("material-icons-round");
      icon.classList.add("shaka-chosen-item");
      icon.textContent = shaka.ui.Enums.MaterialDesignIcons.CHECKMARK;

      // Screen reader should ignore icon text.
      icon.ariaHidden = "true";
      return icon;
    }

    /**
     * Depending on the value of display, sets/removes the css class of element to
     * either display it or hide it.
     *
     */
    static setDisplay(element: Element, display: boolean) {
      if (!element) {
        return;
      }
      if (display) {
        // Removing a non-existent class doesn't throw, so, even if
        // the element is not hidden, this should be fine.
        element.classList.remove("shaka-hidden");
      } else {
        element.classList.add("shaka-hidden");
      }
    }

    /**
     * Builds a time string, e.g., 01:04:23, from |displayTime|.
     *
     * @param displayTime (in seconds)
     */
    static buildTimeString(displayTime: number, showHour: boolean): string {
      const h = Math.floor(displayTime / 3600);
      const m = Math.floor((displayTime / 60) % 60);
      let s = Math.floor(displayTime % 60);
      if (s < 10) {
        s = "0" + s;
      }
      let text = m + ":" + s;
      if (showHour) {
        if (m < 10) {
          text = "0" + text;
        }
        text = h + ":" + text;
      }
      return text;
    }
  }
}
