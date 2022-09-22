/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for picture-in-picture methods.
 *
 */
HTMLDocument.prototype.exitPictureInPicture = function(): Promise {};
HTMLDocument.prototype.pictureInPictureElement;
HTMLDocument.prototype.pictureInPictureEnabled;
HTMLMediaElement.prototype.requestPictureInPicture = function(): Promise {};
HTMLMediaElement.prototype.disablePictureInPicture;
HTMLMediaElement.prototype.webkitSetPresentationMode = function(mode: string):
    boolean {};
HTMLMediaElement.prototype.webkitSupportsPresentationMode = function(
    mode: string): boolean {};
HTMLMediaElement.prototype.webkitPresentationMode;
