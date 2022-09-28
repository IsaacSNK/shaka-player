/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for prefixed EME v20140218 as supported by IE11/Edge
 * (http://www.w3.org/TR/2014/WD-encrypted-media-20140218).
 *
 */
declare class MSMediaKeys {
  constructor(keySystem: string);

  static isTypeSupported(keySystem: string, contentType: string): boolean;

  createSession(
    contentType: string,
    initData: Uint8Array,
    cdmData?: Uint8Array
  ): MSMediaKeySession;
}

declare interface MSMediaKeySession extends EventTarget {
  error: MSMediaKeyError;

  update(message: Uint8Array);

  close();

  /** @override */
  addEventListener(type, listener, useCapture);

  /** @override */
  removeEventListener(type, listener, useCapture);

  /** @override */
  dispatchEvent(evt);
}

// HTMLMediaElement.prototype.msSetMediaKeys = function (
//   mediaKeys: MSMediaKeys
// ) {};

declare class MSMediaKeyError {
  code: number;
  systemCode: number;

  MS_MEDIA_KEYERR_UNKNOWN: number;
  MS_MEDIA_KEYERR_CLIENT: number;
  MS_MEDIA_KEYERR_SERVICE: number;
  MS_MEDIA_KEYERR_OUTPUT: number;
  MS_MEDIA_KEYERR_HARDWARECHANGE: number;
  MS_MEDIA_KEYERR_DOMAIN: number;
}
