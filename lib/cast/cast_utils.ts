/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {TimeRangesUtils} from './../media/time_ranges_utils';
import * as FakeEventExports from './../util/fake_event';
import {FakeEvent} from './../util/fake_event';

/**
 * @summary A set of cast utility functions and variables shared between sender
 *   and receiver.
 */
export class CastUtils {
  /**
   * Serialize as JSON, but specially encode things JSON will not otherwise
   * represent.
   */
  static serialize(thing: any): string {
    return JSON.stringify(thing, (key, value) => {
      if (typeof value == 'function') {
        // Functions can't be (safely) serialized.
        return undefined;
      }
      if (value instanceof Event || value instanceof FakeEvent) {
        // Events don't serialize to JSON well because of the DOM objects
        // and other complex objects they contain, so we strip these out.
        // Note that using Object.keys or JSON.stringify directly on the event
        // will not capture its properties.  We must use a for loop.
        const simpleEvent = {};
        for (const eventKey in value) {
          const eventValue = value[eventKey];

          // Strip out non-null object types because they are complex and we
          // don't need them.
          if (eventValue && typeof eventValue == 'object') {
            if (eventKey == 'detail') {
              // Keep the detail value, because it contains important
              // information for diagnosing errors.
              simpleEvent[eventKey] = eventValue;
            }
          } else {
            // Strip out keys that are found on Event itself because they are
            // class-level constants we don't need, like Event.MOUSEMOVE == 16.
            if (eventKey in Event) {
            } else {
              simpleEvent[eventKey] = eventValue;
            }
          }
        }
        return simpleEvent;
      }
      if (value instanceof Error) {
        // Errors don't serialize to JSON well, either.  TypeError, for example,
        // turns in "{}", leading to messages like "Error UNKNOWN.UNKNOWN" when
        // deserialized on the sender and displayed in the demo app.
        return CastUtils.unpackError_(value);
      }
      if (value instanceof TimeRanges) {
        // TimeRanges must be unpacked into plain data for serialization.
        return CastUtils.unpackTimeRanges_(value);
      }
      if (value instanceof Uint8Array) {
        // Some of our code cares about Uint8Arrays actually being Uint8Arrays,
        // so this gives them special treatment.
        return CastUtils.unpackUint8Array_(value);
      }
      if (typeof value == 'number') {
        // NaN and infinity cannot be represented directly in JSON.
        if (isNaN(value)) {
          return 'NaN';
        }
        if (isFinite(value)) {
          return value;
        }
        if (value < 0) {
          return '-Infinity';
        }
        return 'Infinity';
      }
      return value;
    });
  }

  /**
   * Deserialize JSON using our special encodings.
   */
  static deserialize(str: string): any {
    return JSON.parse(str, (key, value) => {
      if (value == 'NaN') {
        return NaN;
      } else {
        if (value == '-Infinity') {
          return -Infinity;
        } else {
          if (value == 'Infinity') {
            return Infinity;
          } else {
            if (value && typeof value == 'object' &&
                value['__type__'] == 'TimeRanges') {
              // TimeRanges objects have been unpacked and sent as plain data.
              // Simulate the original TimeRanges object.
              return CastUtils.simulateTimeRanges_(value);
            } else {
              if (value && typeof value == 'object' &&
                  value['__type__'] == 'Uint8Array') {
                return CastUtils.makeUint8Array_(value);
              } else {
                if (value && typeof value == 'object' &&
                    value['__type__'] == 'Error') {
                  return CastUtils.makeError_(value);
                }
              }
            }
          }
        }
      }
      return value;
    });
  }

  private static unpackTimeRanges_(ranges: TimeRanges): Object {
    const obj = {
      '__type__': 'TimeRanges',
      // a signal to deserialize
      'length': ranges.length,
      'start': [],
      'end': []
    };
    const TimeRangesUtils = TimeRangesUtils;
    for (const {start, end} of TimeRangesUtils.getBufferedInfo(ranges)) {
      obj['start'].push(start);
      obj['end'].push(end);
    }
    return obj;
  }

  /**
   * Creates a simulated TimeRanges object from data sent by the cast receiver.
   * @return {{
   *   length: number,
   *   start: function(number): number,
   *   end: function(number): number
   * }}
   */
  private static simulateTimeRanges_(obj: any): {
    length: number,
    start: (p1: number) => number,
    end: (p1: number) => number
  } {
    return {
      length: obj.length,
      // NOTE: a more complete simulation would throw when |i| was out of range,
      // but for simplicity we will assume a well-behaved application that uses
      // length instead of catch to stop iterating.
      start: (i) => {
        return obj.start[i];
      },
      end: (i) => {
        return obj.end[i];
      }
    };
  }

  private static unpackUint8Array_(array: Uint8Array): Object {
    return {
      '__type__': 'Uint8Array',
      // a signal to deserialize
      'entries': Array.from(array)
    };
  }

  /**
   * Creates a Uint8Array object from data sent by the cast receiver.
   */
  private static makeUint8Array_(obj: any): Uint8Array {
    return new Uint8Array((obj['entries'] as number[]));
  }

  private static unpackError_(error: Error): Object {
    // None of the properties in TypeError are enumerable, but there are some
    // common Error properties we expect.  We also enumerate any enumerable
    // properties and "own" properties of the type, in case there is an Error
    // subtype with additional properties we don't know about in advance.
    const properties = new Set(['name', 'message', 'stack']);
    for (const key in error) {
      properties.add(key);
    }
    for (const key of Object.getOwnPropertyNames(error)) {
      properties.add(key);
    }
    const contents = {};
    for (const key of properties) {
      contents[key] = error[key];
    }
    return {
      '__type__': 'Error',
      // a signal to deserialize
      'contents': contents
    };
  }

  /**
   * Creates an Error object from data sent by the cast receiver.
   */
  private static makeError_(obj: any): Error {
    const contents = obj['contents'];
    const error = new Error(contents['message']);
    for (const key in contents) {
      error[key] = contents[key];
    }
    return error;
  }
}

/**
 * HTMLMediaElement events that are proxied while casting.
 */
export const VideoEvents: string[] = [
  'ended', 'play', 'playing', 'pause', 'pausing', 'ratechange', 'seeked',
  'seeking', 'timeupdate', 'volumechange'
];

/**
 * HTMLMediaElement attributes that are proxied while casting.
 */
export const VideoAttributes: string[] = [
  'buffered', 'currentTime', 'duration', 'ended', 'loop', 'muted', 'paused',
  'playbackRate', 'seeking', 'videoHeight', 'videoWidth', 'volume'
];

/**
 * HTMLMediaElement attributes that are transferred when casting begins.
 */
export const VideoInitStateAttributes: string[] = ['loop', 'playbackRate'];

/**
 * HTMLMediaElement methods with no return value that are proxied while casting.
 */
export const VideoVoidMethods: string[] = ['pause', 'play'];

/**
 * Player getter methods that are proxied while casting.
 * The key is the method, the value is the frequency of updates.
 * Frequency 1 translates to every update; frequency 2 to every 2 updates, etc.
 */
export const PlayerGetterMethods: {[key: string]: number} = {
  // NOTE: The 'drmInfo' property is not proxied, as it is very large.
  'getAssetUri': 2,
  'getAudioLanguages': 4,
  'getAudioLanguagesAndRoles': 4,
  'getBufferFullness': 1,
  'getBufferedInfo': 2,
  // NOTE: The 'getSharedConfiguration' property is not proxied as it would
  //       not be possible to share a reference.
  'getConfiguration': 4,
  'getExpiration': 2,
  'getKeyStatuses': 2,
  // NOTE: The 'getManifest' property is not proxied, as it is very large.
  // NOTE: The 'getManifestParserFactory' property is not proxied, as it would
  // not serialize.
  'getPlaybackRate': 2,
  'getTextLanguages': 4,
  'getTextLanguagesAndRoles': 4,
  'getTextTracks': 2,
  'getStats': 5,
  'getVariantTracks': 2,
  'getImageTracks': 2,
  'getThumbnails': 2,
  'isAudioOnly': 10,
  'isBuffering': 1,
  'isInProgress': 1,
  'isLive': 10,
  'isTextTrackVisible': 1,
  'keySystem': 10,
  'seekRange': 1,
  'getLoadMode': 10
};

/**
 * Player getter methods that are proxied while casting, but only when casting
 * a livestream.
 * The key is the method, the value is the frequency of updates.
 * Frequency 1 translates to every update; frequency 2 to every 2 updates, etc.
 */
export const PlayerGetterMethodsThatRequireLive: {[key: string]: number} = {
  'getPlayheadTimeAsDate': 1,
  'getPresentationStartTimeAsDate': 20
};

/**
 * Player getter and setter methods that are used to transfer state when casting
 * begins.
 */
export const PlayerInitState: string[][] = [['getConfiguration', 'configure']];

/**
 * Player getter and setter methods that are used to transfer state after
 * load() is resolved.
 */
export const PlayerInitAfterLoadState: string[][] =
    [['isTextTrackVisible', 'setTextTrackVisibility']];

/**
 * Player methods with no return value that are proxied while casting.
 */
export const PlayerVoidMethods: string[] = [
  'addChaptersTrack', 'addTextTrackAsync', 'cancelTrickPlay', 'configure',
  'getChapters', 'getChaptersTracks', 'resetConfiguration', 'retryStreaming',
  'selectAudioLanguage', 'selectTextLanguage', 'selectTextTrack',
  'selectVariantTrack', 'selectVariantsByLabel', 'setTextTrackVisibility',
  'trickPlay', 'updateStartTime', 'goToLive'
];

/**
 * Player methods returning a Promise that are proxied while casting.
 */
export const PlayerPromiseMethods: string[] = [
  'attach', 'detach',
  // The manifestFactory parameter of load is not supported.
  'load', 'unload'
];
type InitStateType = {
  video: Object,
  player: Object,
  manifest: string|null,
  startTime: number|null
};

export {InitStateType};

/**
 * The namespace for Shaka messages on the cast bus.
 */
export const SHAKA_MESSAGE_NAMESPACE: string = 'urn:x-cast:com.google.shaka.v2';

/**
 * The namespace for generic messages on the cast bus.
 */
export const GENERIC_MESSAGE_NAMESPACE: string =
    'urn:x-cast:com.google.cast.media';
