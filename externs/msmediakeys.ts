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
export interface MSMediaKeys {
  constructor(keySystem: string) ;
  isTypeSupported(keySystem: string, contentType: string): boolean ;
  createSession(
      contentType: string, initData: Uint8Array,
      cdmData?: Uint8Array): MSMediaKeySession ;
}

interface MSMediaKeySession extends EventTarget {
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
//@ts-ignore
HTMLMediaElement.prototype.msSetMediaKeys = function(mediaKeys: MSMediaKeys) {};

class MSMediaKeyError {
  static MS_MEDIA_KEYERR_UNKNOWN: number;
  static MS_MEDIA_KEYERR_CLIENT: number;
  static MS_MEDIA_KEYERR_SERVICE: number;
  static MS_MEDIA_KEYERR_OUTPUT: number;
  static MS_MEDIA_KEYERR_HARDWARECHANGE: number;
  static MS_MEDIA_KEYERR_DOMAIN: number;
  code: number;
  systemCode: number;
}
