/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as polyfillExports from './dev-workspace.shaka-player-fork.lib.polyfill.all';
import {polyfill} from './dev-workspace.shaka-player-fork.lib.polyfill.all';

/**
 * @summary A polyfill to provide VTTCue.
 * @export
 */
export class VTTCue {
  /**
   * Install the polyfill if needed.
   * @export
   */
  static install() {
    if (window.VTTCue) {
      log.info('Using native VTTCue.');
      return;
    }
    if (!window.TextTrackCue) {
      log.error('VTTCue not available.');
      return;
    }
    let replacement: ((p1: number, p2: number, p3: string) => TextTrackCue)|
        null = null;
    const constructorLength = TextTrackCue.length;
    if (constructorLength == 3) {
      log.info('Using VTTCue polyfill from 3 argument TextTrackCue.');
      replacement = VTTCue.from3ArgsTextTrackCue_;
    } else {
      if (constructorLength == 6) {
        log.info('Using VTTCue polyfill from 6 argument TextTrackCue.');
        replacement = VTTCue.from6ArgsTextTrackCue_;
      } else {
        if (VTTCue.canUse3ArgsTextTrackCue_()) {
          log.info('Using VTTCue polyfill from 3 argument TextTrackCue.');
          replacement = VTTCue.from3ArgsTextTrackCue_;
        }
      }
    }
    if (!replacement) {
      log.error('No recognized signature for TextTrackCue found!');
      return;
    }

    // The polyfilled VTTCue must be callable with "new", but the static methods
    // in this class cannot be called that way on legacy Edge.  So we must wrap
    // the replacement in a plain function.
    // eslint-disable-next-line no-restricted-syntax
    window['VTTCue'] = function(start, end, text) {
      return replacement(start, end, text);
    };
  }

  /**
   * Draft spec TextTrackCue with 3 constructor arguments.
   * @see {@link https://bit.ly/2IdyKbA W3C Working Draft 25 October 2012}.
   *
   */
  private static from3ArgsTextTrackCue_(
      startTime: number, endTime: number, text: string): TextTrackCue {
    return new window.TextTrackCue(startTime, endTime, text);
  }

  /**
   * Draft spec TextTrackCue with 6 constructor arguments (5th & 6th are
   * optional).
   * @see {@link https://bit.ly/2KaGSP2 W3C Working Draft 29 March 2012}.
   *
   */
  private static from6ArgsTextTrackCue_(
      startTime: number, endTime: number, text: string): TextTrackCue {
    const id = startTime + '-' + endTime + '-' + text;

    // Quoting the access to the TextTrackCue object to satisfy the compiler.
    return new window['TextTrackCue'](id, startTime, endTime, text);
  }

  /**
   * Edge returns TextTrackCue.length = 0, although it accepts 3
   * constructor arguments.
   *
   */
  private static canUse3ArgsTextTrackCue_(): boolean {
    try {
      return !!VTTCue.from3ArgsTextTrackCue_(1, 2, '');
    } catch (error) {
      return false;
    }
  }
}
polyfill.register(VTTCue.install);
