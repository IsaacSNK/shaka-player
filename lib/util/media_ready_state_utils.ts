/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as EventManagerExports from './/event_manager';
import {EventManager} from './/event_manager';
import {Lazy} from './/lazy';

export class MediaReadyState {
  static waitForReadyState(
      mediaElement: HTMLMediaElement, readyState: number,
      eventManager: EventManager, callback: () => any) {
    if (readyState == HTMLMediaElement.HAVE_NOTHING ||
        mediaElement.readyState >= readyState) {
      callback();
    } else {
      const MediaReadyState = MediaReadyState;
      const eventName =
          MediaReadyState.READY_STATES_TO_EVENT_NAMES_.value().get(readyState);
      eventManager.listenOnce(mediaElement, eventName, callback);
    }
  }
}

export const READY_STATES_TO_EVENT_NAMES_: Lazy<Map<number, string>> =
    new Lazy(() => new Map([
               [HTMLMediaElement.HAVE_METADATA, 'loadedmetadata'],
               [HTMLMediaElement.HAVE_CURRENT_DATA, 'loadeddata'],
               [HTMLMediaElement.HAVE_FUTURE_DATA, 'canplay'],
               [HTMLMediaElement.HAVE_ENOUGH_DATA, 'canplaythrough']
             ]));
