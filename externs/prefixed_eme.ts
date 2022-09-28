/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for prefixed EME v0.1b.
 *
 */
// HTMLMediaElement.prototype.webkitAddKey = function (
//   keySystem: string,
//   key: Uint8Array,
//   keyId: Uint8Array,
//   sessionId: string
// ) {};
// HTMLMediaElement.prototype.webkitCancelKeyRequest = function (
//   keySystem: string,
//   sessionId: string
// ) {};
// HTMLMediaElement.prototype.webkitGenerateKeyRequest = function (
//   keySystem: string,
//   initData: Uint8Array
// ) {};

// /**
//  * An unprefixed variant of the webkit-prefixed API from EME v0.1b.
//  */
// HTMLMediaElement.prototype.generateKeyRequest = function (
//   keySystem: string,
//   initData: Uint8Array
// ) {};

// /**
//  * @return '', 'maybe', or 'probably'
//  * @override the standard one-argument version
//  */
// HTMLVideoElement.prototype.canPlayType = function (
//   mimeType: string,
//   keySystem?: string
// ): string {};

// class MediaKeyEvent extends Event {
//   keySystem: string;
//   sessionId: string;
//   initData: Uint8Array;
//   message: Uint8Array;
//   defaultURL: string;
//   errorCode: MediaKeyError;
//   systemCode: number;
//   target: HTMLMediaElement;

//   constructor(type: string, eventInitDict?: Object) {}
// }

// class MediaKeyError {
//   code: number;
//   systemCode: number;
// }
