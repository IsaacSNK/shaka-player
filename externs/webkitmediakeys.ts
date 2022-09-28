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
declare class WebKitMediaKeys {
  constructor(keySystem: string);

  static isTypeSupported(keySystem: string, contentType: string): boolean;

  createSession(
    contentType: string,
    initData: Uint8Array
  ): WebKitMediaKeySession;
}

interface WebKitMediaKeySession extends EventTarget {
  sessionId: string;
  error: WebKitMediaKeyError;

  update(message: Uint8Array);

  close();

  /** @override */
  addEventListener(type, listener, useCapture);

  /** @override */
  removeEventListener(type, listener, useCapture);

  /** @override */
  dispatchEvent(evt);
}
// HTMLMediaElement.prototype.webkitSetMediaKeys = function (
//   mediaKeys: WebKitMediaKeys
// );;
// HTMLMediaElement.prototype.webkitKeys;

class WebKitMediaKeyError {
  code: number;
  systemCode: number;
  MEDIA_KEYERR_UNKNOWN: number;
  MEDIA_KEYERR_CLIENT: number;
  MEDIA_KEYERR_SERVICE: number;
  MEDIA_KEYERR_OUTPUT: number;
  MEDIA_KEYERR_HARDWARECHANGE: number;
  MEDIA_KEYERR_DOMAIN: number;
}