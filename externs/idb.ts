/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for IndexedDB to override the ones provided by the
 * Closure Compiler.
 *
 * TODO: contribute fixes to the Closure Compiler externs
 *
 *
 */

/**
 * @suppress {duplicate}
 * The upstream extern doesn't have the correct type for Result.
 */
class IDBOpenDBRequest extends IDBRequest {
  result: IDBDatabase;
}
