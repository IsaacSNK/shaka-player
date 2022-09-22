/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataViewReader } from "../../lib/util/data_view_reader";
import { Mp4Parser } from "../../lib/util/mp4_parser";

export interface ParsedBox {
  parser: Mp4Parser;
  partialOkay: boolean;
  start: number;
  size: number;
  version: number|null;
  flags: number|null;
  reader: DataViewReader;
  has64BitSize: boolean;
}
