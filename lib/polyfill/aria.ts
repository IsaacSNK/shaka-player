/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import * as polyfillExports from './/all';
import {polyfill} from './/all';

/**
 * @summary A polyfill to add support for the ARIAMixin interface mixin, for
 * browsers that do not implement it (e.g. Firefox).
 * Note that IE also does not support ARIAMixin, but this polyfill does not work
 * for that platform, as it relies on getters and setters.
 * @see https://w3c.github.io/aria/#ARIAMixin
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element
 * @export
 */
export class Aria {
  /**
   * Install the polyfill if needed.
   * @export
   */
  static install() {
    // eslint-disable-next-line no-restricted-syntax
    if (Object.getOwnPropertyDescriptor(Element.prototype, 'ariaHidden')) {
      log.info('Using native ARIAMixin interface.');
      return;
    }
    log.info('ARIAMixin interface not detected. Installing polyfill.');

    // Define a list of all of the ARIAMixin properties that we have externs
    // for.
    const attributes =
        ['ariaHidden', 'ariaLabel', 'ariaPressed', 'ariaSelected'];

    // Add each attribute, one by one.
    for (const attribute of attributes) {
      Aria.addARIAMixinAttribute_(attribute);
    }
  }

  /**
   * Adds an attribute with the given name.
   * @param name The name of the attribute, in camelCase.
   */
  private static addARIAMixinAttribute_(name: string) {
    const baseName = name.toLowerCase().replace(/^aria/, '');

    // NOTE: All the attributes listed in the method above begin with "aria".
    // However, to add extra protection against the possibility of XSS attacks
    // through this method, this enforces "aria-" at the beginning of the
    // snake-case name, even if somehow "aria" were missing from the input.
    const snakeCaseName = `aria-${baseName}`;

    /* eslint-disable no-restricted-syntax */
    Object.defineProperty(Element.prototype, name, {
      get() {
        const element = (this as Element);
        return element.getAttribute(snakeCaseName);
      },
      set(value) {
        const element = (this as Element);
        if (value == null || value == undefined) {
          element.removeAttribute(snakeCaseName);
        } else {
          element.setAttribute(snakeCaseName, value);
        }
      }
    });
  }
}

/* eslint-enable no-restricted-syntax */
polyfill.register(Aria.install);
