/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  // TODO: revisit this when Closure Compiler supports partially-exported classes.
  /** @export */
  export class Dom {
    /**
     * Creates an element, and cast the type from Element to HTMLElement.
     *
     */
    static createHTMLElement(tagName: string): HTMLElement {
      const element = document.createElement(tagName) as HTMLElement;
      return element;
    }

    /**
     * Create a "button" element with the correct type.
     *
     * The compiler is very picky about the use of the "disabled" property on
     * HTMLElement, since it is only defined on certain subclasses of that.  This
     * method merely creates a button and casts it to the correct type.
     *
     */
    static createButton(): HTMLButtonElement {
      return document.createElement("button") as HTMLButtonElement;
    }

    /**
     * Cast a Node/Element to an HTMLElement
     *
     */
    static asHTMLElement(original: Node | Element): HTMLElement {
      return original as HTMLElement;
    }

    /**
     * Cast a Node/Element to an HTMLMediaElement
     *
     */
    static asHTMLMediaElement(original: Node | Element): HTMLMediaElement {
      return original as HTMLMediaElement;
    }

    /**
     * Returns the element with a given class name.
     * Assumes the class name to be unique for a given parent.
     *
     */
    static getElementByClassName(
      className: string,
      parent: HTMLElement
    ): HTMLElement {
      const elements = parent.getElementsByClassName(className);
      goog.asserts.assert(
        elements.length == 1,
        "Should only be one element with class name " + className
      );
      return shaka.util.Dom.asHTMLElement(elements[0]);
    }

    /**
     * Remove all of the child nodes of an element.
     * @export
     */
    static removeAllChildren(element: Element) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }
  }
}
