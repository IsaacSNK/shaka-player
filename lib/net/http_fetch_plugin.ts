/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.net {
  /**
   * @summary A networking plugin to handle http and https URIs via the Fetch API.
   * @export
   */
  export class HttpFetchPlugin {
    /**
     * @param progressUpdated Called when a
     *   progress event happened.
     * @param headersReceived Called when the
     *   headers for the download are received, but before the body is.
     * @export
     */
    static parse(
      uri: string,
      request: shaka.extern.Request,
      requestType: RequestType,
      progressUpdated: shaka.extern.ProgressUpdated,
      headersReceived: shaka.extern.HeadersReceived
    ): shaka.extern.IAbortableOperation<shaka.extern.Response> {
      const headers = new shaka.net.HttpFetchPlugin.Headers_();
      shaka.util.MapUtils.asMap(request.headers).forEach((value, key) => {
        headers.append(key, value);
      });
      const controller = new shaka.net.HttpFetchPlugin.AbortController_();
      const init: RequestInit = {
        // Edge does not treat null as undefined for body; https://bit.ly/2luyE6x
        body: request.body || undefined,
        headers: headers,
        method: request.method,
        signal: controller.signal,
        credentials: request.allowCrossSiteCredentials ? "include" : undefined,
      };
      const abortStatus: AbortStatus = { canceled: false, timedOut: false };
      const pendingRequest = shaka.net.HttpFetchPlugin.request_(
        uri,
        requestType,
        init,
        abortStatus,
        progressUpdated,
        headersReceived,
        request.streamDataCallback
      );
      const op: AbortableOperation = new shaka.util.AbortableOperation(
        pendingRequest,
        () => {
          abortStatus.canceled = true;
          controller.abort();
          return Promise.resolve();
        }
      );

      // The fetch API does not timeout natively, so do a timeout manually using
      // the AbortController.
      const timeoutMs = request.retryParameters.timeout;
      if (timeoutMs) {
        const timer = new shaka.util.Timer(() => {
          abortStatus.timedOut = true;
          controller.abort();
        });
        timer.tickAfter(timeoutMs / 1000);

        // To avoid calling |abort| on the network request after it finished, we
        // will stop the timer when the requests resolves/rejects.
        op.finally(() => {
          timer.stop();
        });
      }
      return op;
    }

    private static async request_(
      uri: string,
      requestType: RequestType,
      init: RequestInit,
      abortStatus: AbortStatus,
      progressUpdated: shaka.extern.ProgressUpdated,
      headersReceived: shaka.extern.HeadersReceived,
      // @ts-ignore
      streamDataCallback: ((p1: BufferSource) => Promise) | null
    ): Promise<shaka.extern.Response> {
      const fetch = shaka.net.HttpFetchPlugin.fetch_;
      const ReadableStream = shaka.net.HttpFetchPlugin.ReadableStream_;
      let response;
      let arrayBuffer;
      let loaded = 0;
      let lastLoaded = 0;

      // Last time stamp when we got a progress event.
      let lastTime = Date.now();
      try {
        // The promise returned by fetch resolves as soon as the HTTP response
        // headers are available. The download itself isn't done until the promise
        // for retrieving the data (arrayBuffer, blob, etc) has resolved.
        response = await fetch(uri, init);

        // At this point in the process, we have the headers of the response, but
        // not the body yet.
        headersReceived(
          shaka.net.HttpFetchPlugin.headersToGenericObject_(response.headers)
        );

        // Getting the reader in this way allows us to observe the process of
        // downloading the body, instead of just waiting for an opaque promise to
        // resolve.
        // We first clone the response because calling getReader locks the body
        // stream; if we didn't clone it here, we would be unable to get the
        // response's arrayBuffer later.
        const reader = response.clone().body.getReader();
        const contentLengthRaw = response.headers.get("Content-Length");
        const contentLength = contentLengthRaw
          ? parseInt(contentLengthRaw, 10)
          : 0;
        const start = (controller) => {
          const push = async () => {
            let readObj;
            try {
              readObj = await reader.read();
            } catch (e) {
              // If we abort the request, we'll get an error here.  Just ignore it
              // since real errors will be reported when we read the buffer below.
              shaka.log.v1("error reading from stream", e.message);
              return;
            }
            if (!readObj.done) {
              loaded += readObj.value.byteLength;
              if (streamDataCallback) {
                await streamDataCallback(readObj.value);
              }
            }
            const currentTime = Date.now();

            // If the time between last time and this time we got progress event
            // is long enough, or if a whole segment is downloaded, call
            // progressUpdated().
            if (currentTime - lastTime > 100 || readObj.done) {
              progressUpdated(
                currentTime - lastTime,
                loaded - lastLoaded,
                contentLength - loaded
              );
              lastLoaded = loaded;
              lastTime = currentTime;
            }
            if (readObj.done) {
              goog.asserts.assert(
                !readObj.value,
                'readObj should be unset when "done" is true.'
              );
              controller.close();
            } else {
              controller.enqueue(readObj.value);
              push();
            }
          };
          push();
        };

        // Create a ReadableStream to use the reader. We don't need to use the
        // actual stream for anything, though, as we are using the response's
        // arrayBuffer method to get the body, so we don't store the
        // ReadableStream.
        new ReadableStream({ start });

        // eslint-disable-line no-new
        arrayBuffer = await response.arrayBuffer();
      } catch (error) {
        if (abortStatus.canceled) {
          throw new shaka.util.Error(
            shaka.util.Error.Severity.RECOVERABLE,
            shaka.util.Error.Category.NETWORK,
            shaka.util.Error.Code.OPERATION_ABORTED,
            uri,
            requestType
          );
        } else {
          if (abortStatus.timedOut) {
            throw new shaka.util.Error(
              shaka.util.Error.Severity.RECOVERABLE,
              shaka.util.Error.Category.NETWORK,
              shaka.util.Error.Code.TIMEOUT,
              uri,
              requestType
            );
          } else {
            throw new shaka.util.Error(
              shaka.util.Error.Severity.RECOVERABLE,
              shaka.util.Error.Category.NETWORK,
              shaka.util.Error.Code.HTTP_ERROR,
              uri,
              error,
              requestType
            );
          }
        }
      }
      const headers = shaka.net.HttpFetchPlugin.headersToGenericObject_(
        response.headers
      );
      return shaka.net.HttpPluginUtils.makeResponse(
        headers,
        arrayBuffer,
        response.status,
        uri,
        response.url,
        requestType
      );
    }

    private static headersToGenericObject_(headers: Headers): {
      [key: string]: string;
    } {
      const headersObj = {};
      headers.forEach((value, key) => {
        // Since Edge incorrectly return the header with a leading new line
        // character ('\n'), we trim the header here.
        headersObj[key.trim()] = value;
      });
      return headersObj;
    }

    /**
     * Determine if the Fetch API is supported in the browser. Note: this is
     * deliberately exposed as a method to allow the client app to use the same
     * logic as Shaka when determining support.
     * @export
     */
    static isSupported(): boolean {
      // On Edge, ReadableStream exists, but attempting to construct it results in
      // an error. See https://bit.ly/2zwaFLL
      // So this has to check that ReadableStream is present AND usable.
      if (window.ReadableStream) {
        // eslint-disable-line no-new
        try {
          new ReadableStream({});
        } catch (e) {
          return false;
        }
      } else {
        return false;
      }
      return !!(window.fetch && window.AbortController);
    }
  }
}

export interface AbortStatus {
  canceled: boolean;
  timedOut: boolean;
}

export { AbortStatus };

namespace shaka.net.HttpFetchPlugin {
  /**
   * Overridden in unit tests, but compiled out in production.
   *
   */
  export const fetch_: (p1: string, p2: RequestInit) => any = window.fetch;
}

namespace shaka.net.HttpFetchPlugin {
  /**
   * Overridden in unit tests, but compiled out in production.
   *
   */
  // @ts-ignore
  export const AbortController_: () => any = window.AbortController;
}

namespace shaka.net.HttpFetchPlugin {
  /**
   * Overridden in unit tests, but compiled out in production.
   *
   */
  // @ts-ignore
  export const ReadableStream_: (p1: Object) => any = window.ReadableStream;
}

namespace shaka.net.HttpFetchPlugin {
  /**
   * Overridden in unit tests, but compiled out in production.
   *
   */
  // @ts-ignore
  export const Headers_: () => any = window.Headers;
}
if (shaka.net.HttpFetchPlugin.isSupported()) {
  shaka.net.NetworkingEngine.registerScheme(
    "http",
    shaka.net.HttpFetchPlugin.parse,
    shaka.net.NetworkingEngine.PluginPriority.PREFERRED,
    /* progressSupport= */
    true
  );
  shaka.net.NetworkingEngine.registerScheme(
    "https",
    shaka.net.HttpFetchPlugin.parse,
    shaka.net.NetworkingEngine.PluginPriority.PREFERRED,
    /* progressSupport= */
    true
  );
  shaka.net.NetworkingEngine.registerScheme(
    "blob",
    shaka.net.HttpFetchPlugin.parse,
    shaka.net.NetworkingEngine.PluginPriority.PREFERRED,
    /* progressSupport= */
    true
  );
}
