/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';

/**
 * @summary
 * A console logging framework which is compiled out for deployment.  This is
 * only available when using the uncompiled version.
 * @exportDoc
 */
export class log {
  private static logMap_: {[key: Level]: (...p1: any[]) => any};
  static currentLevel: number;

  /**
   * This always logs to the console, even in Release mode.  This should only be
   * used for deprecation messages and things the app should never ignore.
   *
   */
  static alwaysError(...args) {}

  /**
   * This always logs to the console, even in Release mode.  This should only be
   * used for deprecation messages and things the app should never ignore.
   *
   */
  static alwaysWarn(...args) {}

  /**
   * This always logs to the console, even in Release mode.  This should only be
   * used for deprecation messages and things the app should never ignore.
   *
   */
  static warnOnce(id: string, ...args) {
    if (oneTimeWarningIssued_.has(id)) {
      return;
    }
    oneTimeWarningIssued_.add(id);
    log.alwaysWarn(...args);
  }

  /**
   * This log is for when an error occurs.  This should always be accompanied
   * with an error event, thrown exception, or rejected Promise.  Logs are
   * disabled in Release mode, so there should be other methods of detecting the
   * error.
   *
   */
  static error(...args) {}

  /**
   * This log is for possible errors or things that may be surprising to a user.
   * For example, if we work around unusual or bad content, we should warn that
   * they should fix their content.  Deprecation messages and messages the app
   * shouldn't ignore should use alwaysWarn instead.
   *
   */
  static warning(...args) {}

  /**
   * This log is for messages to the user about what is happening.  For example,
   * when we update a manifest or install a polyfill.
   *
   */
  static info(...args) {}

  /**
   * This log is to aid *users* in debugging their content.  This should be for
   * logs about the content and what we do with it.  For example, when we change
   * streams or what we are choosing.
   *
   */
  static debug(...args) {}

  /**
   * This log is for debugging Shaka Player itself.  This may be logs about
   * internal states or events.  This may also be for more verbose logs about
   * content, such as for segment appends.
   *
   */
  static v1(...args) {}

  /**
   * This log is for tracing and debugging Shaka Player.  These logs will happen
   * a lot, for example, logging every segment append or every update check.
   * These are mostly used for tracking which calls happen through the code.
   *
   */
  static v2(...args) {}

  /**
   * Change the log level.  Useful for debugging in uncompiled mode.
   *
   * @exportDoc
   */
  static setLevel(level: number) {
    const getLog = (curLevel) => {
      if (curLevel <= level) {
        asserts.assert(log.logMap_[curLevel], 'Unexpected log level');
        return log.logMap_[curLevel];
      } else {
        return () => {};
      }
    };
    log.currentLevel = level;
    log.error = getLog(Level.ERROR);
    log.warning = getLog(Level.WARNING);
    log.info = getLog(Level.INFO);
    log.debug = getLog(Level.DEBUG);
    log.v1 = getLog(Level.V1);
    log.v2 = getLog(Level.V2);
  }
}

/**
 * Log levels.
 * @exportDoc
 */
export enum Level {
  NONE,
  ERROR,
  WARNING,
  INFO,
  DEBUG,
  V1,
  V2
}

/**
 * @define {number} the maximum log level.
 */
export const MAX_LOG_LEVEL: number = 3;

/**
 * A Set to indicate which one-time warnings have been issued.
 *
 */
export const oneTimeWarningIssued_: Set<string> = new Set();

// IE8 has no console unless it is opened in advance.
// IE9 console methods are not Functions and have no bind.
if (window.console && window.console.log.bind) {
  log.logMap_ = {
    /* eslint-disable no-restricted-syntax */
    [Level.ERROR]: console.error.bind(console),
    [Level.WARNING]: console.warn.bind(console),
    [Level.INFO]: console.info.bind(console),
    [Level.DEBUG]: console.log.bind(console),
    [Level.V1]: console.debug.bind(console),
    [Level.V2]: console.debug.bind(console)
  };

  /* eslint-enable no-restricted-syntax */
  log.alwaysWarn = log.logMap_[Level.WARNING];
  log.alwaysError = log.logMap_[Level.ERROR];
  if (goog.DEBUG) {
    // Since we don't want to export shaka.log in production builds, we don't
    // use the @export annotation.  But the module wrapper (used in debug builds
    // since v2.5.11) hides anything non-exported.  This is a debug-only,
    // API-based export to make sure logging is available in debug builds.
    goog.exportSymbol('shaka.log', log);
    log.setLevel(MAX_LOG_LEVEL);
  } else {
    if (MAX_LOG_LEVEL >= Level.ERROR) {
      log.error = log.logMap_[Level.ERROR];
    }
    if (MAX_LOG_LEVEL >= Level.WARNING) {
      log.warning = log.logMap_[Level.WARNING];
    }
    if (MAX_LOG_LEVEL >= Level.INFO) {
      log.info = log.logMap_[Level.INFO];
    }
    if (MAX_LOG_LEVEL >= Level.DEBUG) {
      log.debug = log.logMap_[Level.DEBUG];
    }
    if (MAX_LOG_LEVEL >= Level.V1) {
      log.v1 = log.logMap_[Level.V1];
    }
    if (MAX_LOG_LEVEL >= Level.V2) {
      log.v2 = log.logMap_[Level.V2];
    }
  }
}
