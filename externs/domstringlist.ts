/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for DOMStringList to override those provided by the
 * Closure Compiler.
 *
 * TODO: contribute fixes to the Closure Compiler externs
 *
 *
 */

/**
 * This is an Iterable, but Closure's built-in extern doesn't seem to declare it
 * as such in this version of the compiler (20200406).
 *
 * Here we override that definition.
 *
 * @suppress {duplicate}
 */
class DOMStringList implements IArrayLike<string>, Iterable<string> {}
