/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for Awesomplete methods.
 *
 */
declare class Awesomplete {
  list: string[];
  minChars: number;

  constructor(input: Element);

  evaluate();
}
