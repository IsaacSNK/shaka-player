/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.require('goog.Uri');
import {asserts} from './../debug/asserts';
import * as assertsExports from './../debug/asserts';
import {Backoff} from './/backoff';
import {AbortableOperation} from './../util/abortable_operation';
import {BufferUtils} from './../util/buffer_utils';
import {Error} from './../util/error';
import * as ErrorExports from './../util/error';
import {FakeEvent} from './../util/fake_event';
import * as FakeEventExports from './../util/fake_event';
import {FakeEventTarget} from './../util/fake_event_target';
import * as FakeEventTargetExports from './../util/fake_event_target';
import {IDestroyable} from './../util/i_destroyable';
import {ObjectUtils} from './../util/object_utils';
import {OperationManager} from './../util/operation_manager';
import {Timer} from './../util/timer';

/**
 * @event shaka.net.NetworkingEngine.RetryEvent
 * @description Fired when the networking engine receives a recoverable error
 *   and retries.
 * @property {string} type
 *   'retry'
 * @property {?ShakaError} error
 *   The error that caused the retry. If it was a non-Shaka error, this is set
 *   to null.
 * @exportDoc
 */

/**
 * NetworkingEngine wraps all networking operations.  This accepts plugins that
 * handle the actual request.  A plugin is registered using registerScheme.
 * Each scheme has at most one plugin to handle the request.
 *
 * @export
 */
export class NetworkingEngine extends FakeEventTarget implements IDestroyable {
  private destroyed_: boolean = false;
  private operationManager_: OperationManager;
  private requestFilters_: Set<shaka.extern.RequestFilter>;
  private responseFilters_: Set<shaka.extern.ResponseFilter>;
  private onProgressUpdated_: ((p1: number, p2: number) => any)|null;
  private onHeadersReceived_: OnHeadersReceived|null;
  private onDownloadFailed_: OnDownloadFailed|null;
  private forceHTTPS_: boolean = false;

  /**
   * @param onProgressUpdated Called when a progress
   *   event is triggered. Passed the duration, in milliseconds, that the
   *   request took, and the number of bytes transferred.
   *   Called when the headers are received for a download.
   *   Called when a download fails, for any reason.
   */
  constructor(
      onProgressUpdated?: (p1: number, p2: number) => any,
      onHeadersReceived?: OnHeadersReceived,
      onDownloadFailed?: OnDownloadFailed) {
    super();
    this.operationManager_ = new OperationManager();
    this.requestFilters_ = new Set();
    this.responseFilters_ = new Set();
    this.onProgressUpdated_ = onProgressUpdated || null;
    this.onHeadersReceived_ = onHeadersReceived || null;
    this.onDownloadFailed_ = onDownloadFailed || null;
  }

  /**
   * @export
   */
  setForceHTTPS(forceHTTPS: boolean) {
    this.forceHTTPS_ = forceHTTPS;
  }

  /**
   * Registers a scheme plugin.  This plugin will handle all requests with the
   * given scheme.  If a plugin with the same scheme already exists, it is
   * replaced, unless the existing plugin is of higher priority.
   * If no priority is provided, this defaults to the highest priority of
   * APPLICATION.
   *
   * @export
   */
  static registerScheme(
      scheme: string, plugin: shaka.extern.SchemePlugin, priority?: number,
      progressSupport: boolean = false) {
    asserts.assert(
        priority == undefined || priority > 0, 'explicit priority must be > 0');
    priority = priority || PluginPriority.APPLICATION;
    const existing = schemes_[scheme];
    if (!existing || priority >= existing.priority) {
      schemes_[scheme] = {
        priority: priority,
        plugin: plugin,
        progressSupport: progressSupport
      };
    }
  }

  /**
   * Removes a scheme plugin.
   *
   * @export
   */
  static unregisterScheme(scheme: string) {
    delete schemes_[scheme];
  }

  /**
   * Registers a new request filter.  All filters are applied in the order they
   * are registered.
   *
   * @export
   */
  registerRequestFilter(filter: shaka.extern.RequestFilter) {
    this.requestFilters_.add(filter);
  }

  /**
   * Removes a request filter.
   *
   * @export
   */
  unregisterRequestFilter(filter: shaka.extern.RequestFilter) {
    this.requestFilters_.delete(filter);
  }

  /**
   * Clears all request filters.
   *
   * @export
   */
  clearAllRequestFilters() {
    this.requestFilters_.clear();
  }

  /**
   * Registers a new response filter.  All filters are applied in the order they
   * are registered.
   *
   * @export
   */
  registerResponseFilter(filter: shaka.extern.ResponseFilter) {
    this.responseFilters_.add(filter);
  }

  /**
   * Removes a response filter.
   *
   * @export
   */
  unregisterResponseFilter(filter: shaka.extern.ResponseFilter) {
    this.responseFilters_.delete(filter);
  }

  /**
   * Clears all response filters.
   *
   * @export
   */
  clearAllResponseFilters() {
    this.responseFilters_.clear();
  }

  /**
   * Gets a copy of the default retry parameters.
   *
   *
   * NOTE: The implementation moved to shaka.net.Backoff to avoid a circular
   * dependency between the two classes.
   *
   * @export
   */
  static defaultRetryParameters(): shaka.extern.RetryParameters {
    return Backoff.defaultRetryParameters();
  }

  /**
   * Makes a simple network request for the given URIs.
   *
   * @export
   */
  static makeRequest(
      uris: string[], retryParams: shaka.extern.RetryParameters,
      streamDataCallback: ((p1: BufferSource) => Promise)|
      null = null): shaka.extern.Request {
    return {
      uris: uris,
      method: 'GET',
      body: null,
      headers: {},
      allowCrossSiteCredentials: false,
      retryParameters: retryParams,
      licenseRequestType: null,
      sessionId: null,
      drmInfo: null,
      initData: null,
      initDataType: null,
      streamDataCallback: streamDataCallback
    };
  }

  /**
   * @override
   * @export
   */
  destroy() {
    this.destroyed_ = true;
    this.requestFilters_.clear();
    this.responseFilters_.clear();

    // FakeEventTarget implements IReleasable
    super.release();
    return this.operationManager_.destroy();
  }

  /**
   * Makes a network request and returns the resulting data.
   *
   * @export
   */
  request(type: RequestType, request: shaka.extern.Request): PendingRequest {
    const ObjectUtils = ObjectUtils;
    const numBytesRemainingObj = new NumBytesRemainingClass();

    // Reject all requests made after destroy is called.
    if (this.destroyed_) {
      const p = Promise.reject(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
          ErrorExports.Code.OPERATION_ABORTED));

      // Silence uncaught rejection errors, which may otherwise occur any place
      // we don't explicitly handle aborted operations.
      p.catch(() => {});
      return new PendingRequest(
          p, () => Promise.resolve(), numBytesRemainingObj);
    }
    asserts.assert(
        request.uris && request.uris.length, 'Request without URIs!');

    // If a request comes from outside the library, some parameters may be left
    // undefined.  To make it easier for application developers, we will fill
    // them in with defaults if necessary.
    // We clone retryParameters and uris so that if a filter modifies the
    // request, it doesn't contaminate future requests.
    request.method = request.method || 'GET';
    request.headers = request.headers || {};
    request.retryParameters = request.retryParameters ?
        ObjectUtils.cloneObject(request.retryParameters) :
        NetworkingEngine.defaultRetryParameters();
    request.uris = ObjectUtils.cloneObject(request.uris);

    // Apply the registered filters to the request.
    const requestFilterOperation = this.filterRequest_(type, request);
    const requestOperation = requestFilterOperation.chain(
        () => this.makeRequestWithRetry_(type, request, numBytesRemainingObj));
    const responseFilterOperation = requestOperation.chain(
        (responseAndGotProgress) =>
            this.filterResponse_(type, responseAndGotProgress));

    // Keep track of time spent in filters.
    const requestFilterStartTime = Date.now();
    let requestFilterMs = 0;
    requestFilterOperation.promise.then(
        () => {
          requestFilterMs = Date.now() - requestFilterStartTime;
        },
        // Silence errors in this fork of the Promise chain.
        () => {});
    let responseFilterStartTime = 0;
    requestOperation.promise.then(
        () => {
          responseFilterStartTime = Date.now();
        },
        // Silence errors in this fork of the Promise chain.
        () => {});
    const op = responseFilterOperation.chain(
        (responseAndGotProgress) => {
          const responseFilterMs = Date.now() - responseFilterStartTime;
          const response = responseAndGotProgress.response;
          response.timeMs += requestFilterMs;
          response.timeMs += responseFilterMs;
          if (!responseAndGotProgress.gotProgress && this.onProgressUpdated_ &&
              !response.fromCache && type == RequestType.SEGMENT) {
            this.onProgressUpdated_(response.timeMs, response.data.byteLength);
          }
          return response;
        },
        (e) => {
          // Any error thrown from elsewhere should be recategorized as CRITICAL
          // here.  This is because by the time it gets here, we've exhausted
          // retries.
          if (e) {
            asserts.assert(e instanceof Error, 'Wrong error type');
            e.severity = ErrorExports.Severity.CRITICAL;
          }
          throw e;
        });

    // Return the pending request, which carries the response operation, and the
    // number of bytes remaining to be downloaded, updated by the progress
    // events.  Add the operation to the manager for later cleanup.
    const pendingRequest =
        new PendingRequest(op.promise, () => op.abort(), numBytesRemainingObj);
    this.operationManager_.manage(pendingRequest);
    return pendingRequest;
  }

  private filterRequest_(type: RequestType, request: shaka.extern.Request):
      AbortableOperation<undefined> {
    let filterOperation = AbortableOperation.completed(undefined);
    for (const requestFilter of this.requestFilters_) {
      // Request filters are run sequentially.
      filterOperation = filterOperation.chain(() => {
        if (request.body) {
          // TODO: For v4.0 we should remove this or change to always pass a
          // Uint8Array.  To make it easier for apps to write filters, it may be
          // better to always pass a Uint8Array so they know what they are
          // getting; but we shouldn't use ArrayBuffer since that would require
          // copying buffers if this is a partial view.
          request.body = BufferUtils.toArrayBuffer(request.body);
        }
        return requestFilter(type, request);
      });
    }

    // Catch any errors thrown by request filters, and substitute
    // them with a Shaka-native error.
    return filterOperation.chain(undefined, (e) => {
      if (e instanceof Error && e.code == ErrorExports.Code.OPERATION_ABORTED) {
        // Don't change anything if the operation was aborted.
        throw e;
      }
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.NETWORK,
          ErrorExports.Code.REQUEST_FILTER_ERROR, e);
    });
  }

  /**
   * @param
   *            numBytesRemainingObj
   * @return {!shaka.extern.IAbortableOperation.<
   *            shaka.net.NetworkingEngine.ResponseAndGotProgress>}
   */
  private makeRequestWithRetry_(
      type: RequestType, request: shaka.extern.Request,
      numBytesRemainingObj: NumBytesRemainingClass):
      shaka.extern.IAbortableOperation<ResponseAndGotProgress> {
    const backoff = new Backoff(
        request.retryParameters,
        /* autoReset= */
        false);
    const index = 0;
    return this.send_(
        type, request, backoff, index,
        /* lastError= */
        null, numBytesRemainingObj);
  }

  /**
   * Sends the given request to the correct plugin and retry using Backoff.
   *
   * @param
   *     numBytesRemainingObj
   * @return {!shaka.extern.IAbortableOperation.<
   *               shaka.net.NetworkingEngine.ResponseAndGotProgress>}
   */
  private send_(
      type: RequestType, request: shaka.extern.Request, backoff: Backoff,
      index: number, lastError: Error|null,
      numBytesRemainingObj: NumBytesRemainingClass):
      shaka.extern.IAbortableOperation<ResponseAndGotProgress> {
    if (this.forceHTTPS_) {
      request.uris[index] = request.uris[index].replace('http://', 'https://');
    }
    const uri = new goog.Uri(request.uris[index]);
    let scheme = uri.getScheme();

    // Whether it got a progress event.
    let gotProgress = false;
    if (!scheme) {
      // If there is no scheme, infer one from the location.
      scheme = NetworkingEngine.getLocationProtocol_();
      asserts.assert(
          scheme[scheme.length - 1] == ':',
          'location.protocol expected to end with a colon!');

      // Drop the colon.
      scheme = scheme.slice(0, -1);

      // Override the original URI to make the scheme explicit.
      uri.setScheme(scheme);
      request.uris[index] = uri.toString();
    }

    // Schemes are meant to be case-insensitive.
    // See https://github.com/shaka-project/shaka-player/issues/2173
    // and https://tools.ietf.org/html/rfc3986#section-3.1
    scheme = scheme.toLowerCase();
    const object = schemes_[scheme];
    const plugin = object ? object.plugin : null;
    if (!plugin) {
      return AbortableOperation.failed(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.NETWORK,
          ErrorExports.Code.UNSUPPORTED_SCHEME, uri));
    }
    const progressSupport = object.progressSupport;

    // Every attempt must have an associated backoff.attempt() call so that the
    // accounting is correct.
    const backoffOperation = AbortableOperation.notAbortable(backoff.attempt());
    let connectionTimer: Timer|null = null;
    let stallTimer: Timer|null = null;
    let aborted = false;
    let headersReceivedCalled = false;
    let startTimeMs;
    const sendOperation =
        backoffOperation
            .chain(() => {
              if (this.destroyed_) {
                return AbortableOperation.aborted();
              }
              startTimeMs = Date.now();
              const segment = RequestType.SEGMENT;
              const progressUpdated = (time, bytes, numBytesRemaining) => {
                if (connectionTimer) {
                  connectionTimer.stop();
                }
                if (stallTimer) {
                  stallTimer.tickAfter(stallTimeoutMs / 1000);
                }
                if (this.onProgressUpdated_ && type == segment) {
                  this.onProgressUpdated_(time, bytes);
                  gotProgress = true;
                  numBytesRemainingObj.setBytes(numBytesRemaining);
                }
              };
              const headersReceived = (headers) => {
                if (this.onHeadersReceived_) {
                  this.onHeadersReceived_(headers, request, type);
                }
                headersReceivedCalled = true;
              };
              const requestPlugin = plugin(
                  request.uris[index], request, type, progressUpdated,
                  headersReceived);
              if (!progressSupport) {
                return requestPlugin;
              }
              const connectionTimeoutMs =
                  request.retryParameters.connectionTimeout;
              if (connectionTimeoutMs) {
                connectionTimer = new Timer(() => {
                  aborted = true;
                  requestPlugin.abort();
                });
                connectionTimer.tickAfter(connectionTimeoutMs / 1000);
              }
              const stallTimeoutMs = request.retryParameters.stallTimeout;
              if (stallTimeoutMs) {
                stallTimer = new Timer(() => {
                  aborted = true;
                  requestPlugin.abort();
                });
              }
              return requestPlugin;
            })
            .chain(
                (response) => {
                  if (connectionTimer) {
                    connectionTimer.stop();
                  }
                  if (stallTimer) {
                    stallTimer.stop();
                  }
                  if (response.timeMs == undefined) {
                    response.timeMs = Date.now() - startTimeMs;
                  }
                  const responseAndGotProgress = {
                    response: response,
                    gotProgress: gotProgress
                  };
                  if (!headersReceivedCalled) {
                    // The plugin did not call headersReceived, perhaps because
                    // it is not able to track that information. So, fire the
                    // event manually.
                    if (this.onHeadersReceived_) {
                      this.onHeadersReceived_(response.headers, request, type);
                    }
                  }
                  return responseAndGotProgress;
                },
                (error) => {
                  if (connectionTimer) {
                    connectionTimer.stop();
                  }
                  if (stallTimer) {
                    stallTimer.stop();
                  }
                  if (this.onDownloadFailed_) {
                    let shakaError = null;
                    let httpResponseCode = 0;
                    if (error instanceof Error) {
                      shakaError = error;
                      if (error.code == ErrorExports.Code.BAD_HTTP_STATUS) {
                        httpResponseCode = (error.data[1] as number);
                      }
                    }
                    this.onDownloadFailed_(
                        request, shakaError, httpResponseCode, aborted);
                  }
                  if (this.destroyed_) {
                    return AbortableOperation.aborted();
                  }
                  if (aborted) {
                    // It is necessary to change the error code to the correct
                    // one because otherwise the retry logic would not work.
                    error = new Error(
                        ErrorExports.Severity.RECOVERABLE,
                        ErrorExports.Category.NETWORK,
                        ErrorExports.Code.TIMEOUT, request.uris[index], type);
                  }
                  if (error instanceof Error) {
                    if (error.code == ErrorExports.Code.OPERATION_ABORTED) {
                      // Don't change anything if the operation was aborted.
                      throw error;
                    } else {
                      if (error.code == ErrorExports.Code.ATTEMPTS_EXHAUSTED) {
                        asserts.assert(lastError, 'Should have last error');
                        throw lastError;
                      }
                    }
                    if (error.severity == ErrorExports.Severity.RECOVERABLE) {
                      const data = (new Map()).set('error', error);
                      const event = new FakeEvent('retry', data);
                      this.dispatchEvent(event);

                      // Move to the next URI.
                      index = (index + 1) % request.uris.length;
                      return this.send_(
                          type, request, backoff, index, error,
                          numBytesRemainingObj);
                    }
                  }

                  // The error was not recoverable, so do not try again.
                  throw error;
                });
    return sendOperation;
  }

  /**
   * @param
   *        responseAndGotProgress
   * @return {!shaka.extern.IAbortableOperation.<
   *               shaka.net.NetworkingEngine.ResponseAndGotProgress>}
   */
  private filterResponse_(
      type: RequestType, responseAndGotProgress: ResponseAndGotProgress):
      shaka.extern.IAbortableOperation<ResponseAndGotProgress> {
    let filterOperation = AbortableOperation.completed(undefined);
    for (const responseFilter of this.responseFilters_) {
      // Response filters are run sequentially.
      filterOperation = filterOperation.chain(() => {
        const resp = responseAndGotProgress.response;
        if (resp.data) {
          // TODO: See TODO in filterRequest_.
          resp.data = BufferUtils.toArrayBuffer(resp.data);
        }
        return responseFilter(type, resp);
      });
    }

    // If successful, return the filtered response with whether it got
    // progress.
    return filterOperation.chain(
        () => {
          return responseAndGotProgress;
        },
        (e) => {
          // Catch any errors thrown by request filters, and substitute
          // them with a Shaka-native error.

          // The error is assumed to be critical if the original wasn't a Shaka
          // error.
          let severity = ErrorExports.Severity.CRITICAL;
          if (e instanceof Error) {
            if (e.code == ErrorExports.Code.OPERATION_ABORTED) {
              // Don't change anything if the operation was aborted.
              throw e;
            }
            severity = e.severity;
          }
          throw new Error(
              severity, ErrorExports.Category.NETWORK,
              ErrorExports.Code.RESPONSE_FILTER_ERROR, e);
        });
  }

  /**
   * This is here only for testability.  We can't mock location in our tests on
   * all browsers, so instead we mock this.
   *
   * @return The value of location.protocol.
   */
  private static getLocationProtocol_(): string {
    return location.protocol;
  }
}

/**
 * A wrapper class for the number of bytes remaining to be downloaded for the
 * request.
 * Instead of using PendingRequest directly, this class is needed to be sent to
 * plugin as a parameter, and a Promise is returned, before PendingRequest is
 * created.
 *
 * @export
 */
export class NumBytesRemainingClass {
  private bytesToLoad_: number = 0;

  /**
   * Constructor
   */
  constructor() {}

  setBytes(bytesToLoad: number) {
    this.bytesToLoad_ = bytesToLoad;
  }

  getBytes(): number {
    return this.bytesToLoad_;
  }
}

/**
 * A pending network request. This can track the current progress of the
 * download, and allows the request to be aborted if the network is slow.
 *
 * @export
 */
export class PendingRequest extends AbortableOperation implements shaka.
extern.IAbortableOperation<shaka.extern.Response> {
  private bytesRemaining_: NumBytesRemainingClass;

  /**
   *   A Promise which represents the underlying operation.  It is resolved
   *   when the operation is complete, and rejected if the operation fails or
   *   is aborted.  Aborted operations should be rejected with a
   *   ShakaError object using the error code OPERATION_ABORTED.
   *   Will be called by this object to abort the underlying operation.  This
   *   is not cancelation, and will not necessarily result in any work being
   *   undone.  abort() should return a Promise which is resolved when the
   *   underlying operation has been aborted.  The returned Promise should
   *   never be rejected.
   * @param
   *   numBytesRemainingObj
   */
  constructor(
      promise: Promise, onAbort: () => Promise,
      numBytesRemainingObj: NumBytesRemainingClass) {
    super(promise, onAbort);
    this.bytesRemaining_ = numBytesRemainingObj;
  }

  getBytesRemaining(): number {
    return this.bytesRemaining_.getBytes();
  }
}

/**
 * Request types.  Allows a filter to decide which requests to read/alter.
 *
 * @export
 */
export enum RequestType {
  MANIFEST,
  SEGMENT,
  LICENSE,
  APP,
  TIMING,
  SERVER_CERTIFICATE,
  KEY
}

/**
 * Priority level for network scheme plugins.
 * If multiple plugins are provided for the same scheme, only the
 * highest-priority one is used.
 *
 * @export
 */
export enum PluginPriority {
  FALLBACK = 1,
  PREFERRED,
  APPLICATION
}
type SchemeObject = {
  plugin: shaka.extern.SchemePlugin,
  priority: number,
  progressSupport: boolean
};

export {SchemeObject};
type ResponseAndGotProgress = {
  response: shaka.extern.Response,
  gotProgress: boolean
};

export {ResponseAndGotProgress};
type OnHeadersReceived =
    (p1: {[key: string]: string}, p2: shaka.extern.Request, p3: RequestType) =>
        any;

export {OnHeadersReceived};
type OnDownloadFailed =
    (p1: shaka.extern.Request, p2: Error|null, p3: number, p4: boolean) => any;

export {OnDownloadFailed};
