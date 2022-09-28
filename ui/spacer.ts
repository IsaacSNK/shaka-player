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
  export class Spacer extends shaka.ui.Element {
    constructor(parent: HTMLElement, controls: Controls) {
      super(parent, controls);
      const div: HTMLElement = shaka.util.Dom.createHTMLElement("div");
      div.classList.add("shaka-spacer");

      // Make screen readers ignore the spacer
      div.ariaHidden = "true";
      this.parent.appendChild(div);
    }
  }
}

namespace shaka.ui.Spacer {
  /**
   * @final
   */
  export class Factory implements shaka.extern.IUIElement.Factory {
    /** @override */
    create(rootElement, controls) {
      return new shaka.ui.Spacer(rootElement, controls);
    }
  }
}
shaka.ui.Controls.registerElement("spacer", new shaka.ui.Spacer.Factory());
