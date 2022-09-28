/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.net {
  /**
   * @summary A networking plugin to handle http and https URIs via XHR.
   * @export
   */
  export class HttpXHRPlugin {
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
      const xhr = new shaka.net.HttpXHRPlugin.Xhr_();

      // Last time stamp when we got a progress event.
      let lastTime = Date.now();

      // Last number of bytes loaded, from progress event.
      let lastLoaded = 0;
      const promise = new Promise((resolve, reject) => {
        xhr.open(request.method, uri, true);
        xhr.responseType = "arraybuffer";
        xhr.timeout = request.retryParameters.timeout;
        xhr.withCredentials = request.allowCrossSiteCredentials;
        xhr.onabort = () => {
          reject(
            new shaka.util.Error(
              shaka.util.Error.Severity.RECOVERABLE,
              shaka.util.Error.Category.NETWORK,
              shaka.util.Error.Code.OPERATION_ABORTED,
              uri,
              requestType
            )
          );
        };
        let calledHeadersReceived = false;
        xhr.onreadystatechange = (event) => {
          // See if the readyState is 2 ("HEADERS_RECEIVED").
          if (xhr.readyState == 2 && !calledHeadersReceived) {
            const headers =
              shaka.net.HttpXHRPlugin.headersToGenericObject_(xhr);
            headersReceived(headers);

            // Don't send out this event twice.
            calledHeadersReceived = true;
          }
        };
        xhr.onload = (event) => {
          const headers = shaka.net.HttpXHRPlugin.headersToGenericObject_(xhr);
          goog.asserts.assert(
            xhr.response instanceof ArrayBuffer,
            "XHR should have a response by now!"
          );
          const xhrResponse = xhr.response;
          try {
            const response = shaka.net.HttpPluginUtils.makeResponse(
              headers,
              xhrResponse,
              xhr.status,
              uri,
              xhr.responseURL,
              requestType
            );
            resolve(response);
          } catch (error) {
            goog.asserts.assert(
              error instanceof shaka.util.Error,
              "Wrong error type!"
            );
            reject(error);
          }
        };
        xhr.onerror = (event) => {
          reject(
            new shaka.util.Error(
              shaka.util.Error.Severity.RECOVERABLE,
              shaka.util.Error.Category.NETWORK,
              shaka.util.Error.Code.HTTP_ERROR,
              uri,
              event,
              requestType
            )
          );
        };
        xhr.ontimeout = (event) => {
          reject(
            new shaka.util.Error(
              shaka.util.Error.Severity.RECOVERABLE,
              shaka.util.Error.Category.NETWORK,
              shaka.util.Error.Code.TIMEOUT,
              uri,
              requestType
            )
          );
        };
        xhr.onprogress = (event) => {
          const currentTime = Date.now();

          // If the time between last time and this time we got progress event
          // is long enough, or if a whole segment is downloaded, call
          // progressUpdated().
          if (
            currentTime - lastTime > 100 ||
            (event.lengthComputable && event.loaded == event.total)
          ) {
            progressUpdated(
              currentTime - lastTime,
              event.loaded - lastLoaded,
              event.total - event.loaded
            );
            lastLoaded = event.loaded;
            lastTime = currentTime;
          }
        };
        for (const key in request.headers) {
          // The Fetch API automatically normalizes outgoing header keys to
          // lowercase. For consistency's sake, do it here too.
          const lowercasedKey = key.toLowerCase();
          xhr.setRequestHeader(lowercasedKey, request.headers[key]);
        }
        xhr.send(request.body);
      });
      return new shaka.util.AbortableOperation(promise, () => {
        xhr.abort();
        return Promise.resolve();
      });
    }

    private static headersToGenericObject_(xhr: XMLHttpRequest): {
      [key: string]: string;
    } {
      // Since Edge incorrectly return the header with a leading new
      // line character ('\n'), we trim the header here.
      const headerLines = xhr.getAllResponseHeaders().trim().split("\r\n");
      const headers = {};
      for (const header of headerLines) {
        const parts: string[] = header.split(": ");
        headers[parts[0].toLowerCase()] = parts.slice(1).join(": ");
      }
      return headers;
    }
  }
}

namespace shaka.net.HttpXHRPlugin {
  /**
   * Overridden in unit tests, but compiled out in production.
   *
   */
  export const Xhr_: () => any = window.XMLHttpRequest;
}
shaka.net.NetworkingEngine.registerScheme(
  "http",
  shaka.net.HttpXHRPlugin.parse,
  shaka.net.NetworkingEngine.PluginPriority.FALLBACK,
  /* progressSupport= */
  true
);
shaka.net.NetworkingEngine.registerScheme(
  "https",
  shaka.net.HttpXHRPlugin.parse,
  shaka.net.NetworkingEngine.PluginPriority.FALLBACK,
  /* progressSupport= */
  true
);
shaka.net.NetworkingEngine.registerScheme(
  "blob",
  shaka.net.HttpXHRPlugin.parse,
  shaka.net.NetworkingEngine.PluginPriority.FALLBACK,
  /* progressSupport= */
  true
);
