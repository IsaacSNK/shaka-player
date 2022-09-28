/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  has64BitSize
 *   If true, the box header had a 64-bit size field.  This affects the offsets
 *   of other fields.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface ParsedBox {
    parser: shaka.util.Mp4Parser;
    partialOkay: boolean;
    start: number;
    size: number;
    version: number | null;
    flags: number | null;
    reader: shaka.util.DataViewReader;
    has64BitSize: boolean;
  }
}
