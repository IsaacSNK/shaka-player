/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, Code, Severity } from "../../lib/util/error";

export interface RestrictionInfo {
  hasAppRestrictions: boolean;
  missingKeys: string[];
  restrictedKeyStatuses: string[];
}

/**
 * @exportDoc
 */
export class IShakaError{
  /**
   * @exportDoc
   */
  severity: Severity;

  /**
   * @exportDoc
   */
  category: Category;

  /**
   * @exportDoc
   */
  code: Code;

  /**
   * @exportDoc
   */
  data: any[];

  /**
   * @exportDoc
   */
  handled: boolean;
};
