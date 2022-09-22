/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * @externs
 */


/**
 * @typedef {{
 *   hasAppRestrictions: boolean,
 *   missingKeys: !Array.<string>,
 *   restrictedKeyStatuses: !Array.<string>
 * }}
 *
 * @property {boolean} hasAppRestrictions
 *   Whether there are streams that are restricted due to app-provided
 *   restrictions.
 * @property {!Array.<string>} missingKeys
 *   The key IDs that were missing.
 * @property {!Array.<string>} restrictedKeyStatuses
 *   The restricted EME key statuses that the streams had.  For example,
 *   'output-restricted' would mean streams couldn't play due to restrictions
 *   on the output device (e.g. HDCP).
 * @exportDoc
 */
export type RestrictionInfo = { hasAppRestrictions : boolean , missingKeys : string [] , restrictedKeyStatuses : string [] } ;


/**
 * @interface
 * @exportDoc
 */
 interface Error {
  category : shaka.util.Error.Category ;
  code : shaka.util.Error.Code ;
  data : any [] ;
  handled : boolean ;
  severity : shaka.util.Error.Severity ;
}