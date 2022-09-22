/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';

/**
 * @summary Create an Event work-alike object based on the provided dictionary.
 * The event should contain all of the same properties from the dict.
 *
 * @export
 */
export class FakeEvent {
  bubbles: boolean = false;
  cancelable: boolean = false;
  defaultPrevented: boolean = false;

  /**
   * According to MDN, Chrome uses high-res timers instead of epoch time.
   * Follow suit so that timeStamps on FakeEvents use the same base as
   * on native Events.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Event/timeStamp
   */
  timeStamp: number;
  isTrusted: boolean = false;
  currentTarget: EventTarget = null;
  target: EventTarget = null;

  /**
   * Non-standard property read by FakeEventTarget to stop processing
   * listeners.
   */
  stopped: boolean = false;

  static fromRealEvent(event: Event): FakeEvent {
    const fakeEvent = new FakeEvent(event.type);
    for (const key in event) {
      Object.defineProperty(
          fakeEvent, key,
          {value: event[key], writable: true, enumerable: true});
    }
    return fakeEvent;
  }

  /**
   * Allows us to tell the compiler that the dictionary "map" is actually a
   * generic object, for backwards compatibility.
   * @suppress {invalidCasts}
   */
  private static recastDictAsObject_(dict: Map<string, Object>): Object {
    asserts.assert(!(dict instanceof Map), 'dict should not be a map');
    return (dict as Object);
  }

  constructor(public readonly type: string, dict?: Map<string, Object>) {
    if (dict) {
      if (dict instanceof Map) {
        // Take properties from dict if present.
        for (const key of dict.keys()) {
          Object.defineProperty(
              this, key,
              {value: dict.get(key), writable: true, enumerable: true});
        }
      } else {
        // For backwards compatibility with external apps that may make use of
        // this public constructor, this should still accept generic objects.
        const obj = FakeEvent.recastDictAsObject_(dict);
        for (const key in obj) {
          Object.defineProperty(
              this, key, {value: obj[key], writable: true, enumerable: true});
        }
      }
    }

    // The properties below cannot be set by the dict.  They are all provided
    // for compatibility with native events.
    this.timeStamp = window.performance && window.performance.now ?
        window.performance.now() :
        Date.now();
  }

  /**
   * Prevents the default action of the event.  Has no effect if the event isn't
   * cancellable.
   * @override
   */
  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  /**
   * Stops processing event listeners for this event.  Provided for
   * compatibility with native Events.
   * @override
   */
  stopImmediatePropagation() {
    this.stopped = true;
  }

  /**
   * Does nothing, since FakeEvents do not bubble.  Provided for compatibility
   * with native Events.
   * @override
   */
  stopPropagation() {}
}

/**
 * An internal enum that contains the string values of all of the player events.
 * This exists primarily to act as an implicit list of events, for tests.
 *
 */
export enum EventName {
  AbrStatusChanged = 'abrstatuschanged',
  Adaptation = 'adaptation',
  Buffering = 'buffering',
  DownloadFailed = 'downloadfailed',
  DownloadHeadersReceived = 'downloadheadersreceived',
  DrmSessionUpdate = 'drmsessionupdate',
  Emsg = 'emsg',
  Prft = 'prft',
  Error = 'error',
  ExpirationUpdated = 'expirationupdated',
  GapJumped = 'gapjumped',
  Loaded = 'loaded',
  Loading = 'loading',
  ManifestParsed = 'manifestparsed',
  MediaQualityChanged = 'mediaqualitychanged',
  Metadata = 'metadata',
  OnStateChange = 'onstatechange',
  OnStateIdle = 'onstateidle',
  RateChange = 'ratechange',
  SegmentAppended = 'segmentappended',
  SessionDataEvent = 'sessiondata',
  StallDetected = 'stalldetected',
  Streaming = 'streaming',
  TextChanged = 'textchanged',
  TextTrackVisibility = 'texttrackvisibility',
  TimelineRegionAdded = 'timelineregionadded',
  TimelineRegionEnter = 'timelineregionenter',
  TimelineRegionExit = 'timelineregionexit',
  TracksChanged = 'trackschanged',
  Unloading = 'unloading',
  VariantChanged = 'variantchanged'
}
