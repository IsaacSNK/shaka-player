/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  restrictedKeyStatuses
 *   The restricted EME key statuses that the streams had.  For example,
 *   'output-restricted' would mean streams couldn't play due to restrictions
 *   on the output device (e.g. HDCP).
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface RestrictionInfo {
    hasAppRestrictions: boolean;
    missingKeys: string[];
    restrictedKeyStatuses: string[];
  }
}
declare namespace shaka.extern {
  class Error {
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
  }
}
