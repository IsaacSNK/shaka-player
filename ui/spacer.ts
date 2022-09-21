/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{Controls}from './controls';
import{Element}from './element';
import{Dom}from './dom_utils';
 
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
export class Factory implements shaka.extern.IUIElement.Factory {
   
  /** @override */ 
  create(rootElement, controls) {
    return new Spacer(rootElement, controls);
  }
}
Controls.registerElement('spacer', new Factory());
