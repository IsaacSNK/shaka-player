/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface Payload {
  mediaElement: HTMLMediaElement;
  mimeType: string | null;
  startTime: number | null;
  startTimeOfLoad: number;
  uri: string | null;
}

export { Payload };
