/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.polyfill {
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
      shaka.log.debug("Symbol.install");

      // eslint-disable-next-line no-restricted-syntax
      const proto = Symbol.prototype;
      if (!("description" in proto)) {
        Object.defineProperty(proto, "description", {
          get: shaka.polyfill.Symbol.getSymbolDescription_,
        });
      }
    }

    /**
     * @this {Symbol}
     */
    private static getSymbolDescription_(): string | undefined {
      const m = /\((.*)\)/.exec(this.toString());
      return m ? m[1] : undefined;
    }
  }
}
shaka.polyfill.register(shaka.polyfill.Symbol.install);
