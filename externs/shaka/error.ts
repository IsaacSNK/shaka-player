/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface RestrictionInfo {
  hasAppRestrictions: boolean;
  missingKeys: string[];
  restrictedKeyStatuses: string[];
}

/**
 * @exportDoc
 */
export class Error{
  /**
   * @exportDoc
   */
  severity: shaka.util.Error.Severity;

  /**
   * @exportDoc
   */
  category: shaka.util.Error.Category;

  /**
   * @exportDoc
   */
  code: shaka.util.Error.Code;

  /**
   * @exportDoc
   */
  data: any[];

  /**
   * @exportDoc
   */
  handled: boolean;
};
