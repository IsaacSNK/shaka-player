/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An interface to standardize how objects release internal references
 * synchronously. If an object needs to asynchronously release references, then
 * it should use 'shaka.util.IDestroyable'.
 *
 * @exportInterface
 */
export class IReleasable {
  /**
   * Request that this object release all internal references.
   *
   * @exportInterface
   */
  release() {}
}
