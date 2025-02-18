/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for less.js library.
 *
 */
declare class less {
  static registerStylesheetsImmediately();

  static refresh(
    reload: boolean,
    modifyVars: boolean,
    clearFileCache: boolean
  ): // @ts-ignore
  Promise;
}
