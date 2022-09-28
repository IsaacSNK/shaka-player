/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  export class MediaReadyState {
    static waitForReadyState(
      mediaElement: HTMLMediaElement,
      readyState: number,
      eventManager: EventManager,
      callback: () => any
    ) {
      if (
        readyState == HTMLMediaElement.HAVE_NOTHING ||
        mediaElement.readyState >= readyState
      ) {
        callback();
      } else {
        const MediaReadyState = shaka.util.MediaReadyState;
        const eventName =
          MediaReadyState.READY_STATES_TO_EVENT_NAMES_.value().get(readyState);
        //@ts-ignore
        eventManager.listenOnce(mediaElement, eventName, callback);
      }
    }
  }
}

namespace shaka.util.MediaReadyState {
  export const READY_STATES_TO_EVENT_NAMES_: Lazy<Map<number, string>> =
    new shaka.util.Lazy(
      () =>
        new Map([
          [HTMLMediaElement.HAVE_METADATA, "loadedmetadata"],
          [HTMLMediaElement.HAVE_CURRENT_DATA, "loadeddata"],
          [HTMLMediaElement.HAVE_FUTURE_DATA, "canplay"],
          [HTMLMediaElement.HAVE_ENOUGH_DATA, "canplaythrough"],
        ])
    );
}
