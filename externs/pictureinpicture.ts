/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for picture-in-picture methods.
 *
 */
//@ts-ignore
HTMLDocument.prototype.exitPictureInPicture = function(): Promise<any> {};
HTMLDocument.prototype.pictureInPictureElement;
HTMLDocument.prototype.pictureInPictureEnabled;
//@ts-ignore
HTMLMediaElement.prototype.requestPictureInPicture = function(): Promise {};
//@ts-ignore
HTMLMediaElement.prototype.disablePictureInPicture;
//@ts-ignore
HTMLMediaElement.prototype.webkitSetPresentationMode = function(mode: string):boolean {};
//@ts-ignore
HTMLMediaElement.prototype.webkitSupportsPresentationMode = function(mode: string): boolean {};
//@ts-ignore
HTMLMediaElement.prototype.webkitPresentationMode;
