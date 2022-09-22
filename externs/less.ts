/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for less.js library.
 *
 */
export interface less {
   registerStylesheetsImmediately() ;
   refresh(reload: boolean, modifyVars: boolean, clearFileCache: boolean):Promise<any>
}
