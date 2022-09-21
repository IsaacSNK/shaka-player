/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as polyfillExports from './dev-workspace.shaka-player-fork.lib.polyfill.all';
import {polyfill} from './dev-workspace.shaka-player-fork.lib.polyfill.all';

/**
 * @summary A polyfill to provide Symbol.prototype.description in all browsers.
 * See: https://caniuse.com/mdn-javascript_builtins_symbol_description
 * @export
 */
export class Symbol {
  /**
   * Install the polyfill if needed.
   * @export
   */
  static install() {
    log.debug('Symbol.install');

    // eslint-disable-next-line no-restricted-syntax
    const proto = Symbol.prototype;
    if (!('description' in proto)) {
      Object.defineProperty(
          proto, 'description', {get: Symbol.getSymbolDescription_});
    }
  }

  /**
   * @this {Symbol}
   */
  private static getSymbolDescription_(): string|undefined {
    const m = /\((.*)\)/.exec(this.toString());
    return m ? m[1] : undefined;
  }
}
polyfill.register(Symbol.install);
