/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka {
  /**
   * @export
   */
  export class dependencies {
    /**
     * Registers a new dependency.
     *
     * @param key which is used for retrieving a
     *   dependency
     * @param dep a dependency
     * @export
     */
    static add(key: Allowed, dep: any) {
      if (!shaka.dependencies.Allowed[key]) {
        throw new Error(`${key} is not supported`);
      }
      shaka.dependencies.dependencies_.set(key, () => dep);
    }

    /**
     * Check if we have a dependency for the key.
     *
     * @param key key
     * @export
     */
    static has(key: Allowed): boolean {
      return shaka.dependencies.dependencies_.has(key);
    }

    static muxjs(): muxjs | null {
      return shaka.dependencies.dependencies_.get(
        shaka.dependencies.Allowed.muxjs
      )() as muxjs | null;
    }
  }
}

namespace shaka.dependencies {
  /**
   * @export
   */
  export enum Allowed {
    muxjs = "muxjs",
  }
}

namespace shaka.dependencies {
  /**
   * Contains accessor functions to shared dependencies that could be used by
   * other components.  The default accessors can be overridden.
   *
   */
  export const dependencies_: Map<Allowed, () => any> = new Map([
    [shaka.dependencies.Allowed.muxjs, () => window.muxjs],
  ]);
}
