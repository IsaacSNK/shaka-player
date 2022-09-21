/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Dom} from './dev-workspace.shaka-player-fork.lib.util.dom_utils';
import {Controls} from './dev-workspace.shaka-player-fork.ui.controls';
import {Element} from './dev-workspace.shaka-player-fork.ui.element';

/**
 * @final
 * @export
 */
export class Spacer extends Element {
  constructor(parent: HTMLElement, controls: Controls) {
    super(parent, controls);
    const div: HTMLElement = Dom.createHTMLElement('div');
    div.classList.add('shaka-spacer');

    // Make screen readers ignore the spacer
    div.ariaHidden = 'true';
    this.parent.appendChild(div);
  }
}

/**
 * @final
 */
export class Factory implements shaka.
extern.IUIElement.Factory {
  /** @override */
  create(rootElement, controls) {
    return new Spacer(rootElement, controls);
  }
}
Controls.registerElement('spacer', new Factory());
