/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface ParsedBox {
  parser: shaka.util.Mp4Parser;
  partialOkay: boolean;
  start: number;
  size: number;
  version: number|null;
  flags: number|null;
  reader: shaka.util.DataViewReader;
  has64BitSize: boolean;
}
