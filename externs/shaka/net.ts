/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  connectionTimeout
 *   The request connection timeout, in milliseconds.  Zero means "unlimited".
 *   <i>Defaults to 10000 milliseconds.</i>
 *
 * @tutorial network-and-buffering-config
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface RetryParameters {
    maxAttempts: number;
    baseDelay: number;
    backoffFactor: number;
    fuzzFactor: number;
    timeout: number;
    stallTimeout: number;
    connectionTimeout: number;
  }
}
/**
 *  streamDataCallback
 *   A callback function to handle the chunked data of the ReadableStream.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Request {
    uris: string[];
    method: string;
    body: BufferSource | null;
    headers: { [key: string]: string };
    allowCrossSiteCredentials: boolean;
    retryParameters: shaka.extern.RetryParameters;
    licenseRequestType: string | null;
    sessionId: string | null;
    drmInfo: shaka.extern.DrmInfo | null;
    initData: Uint8Array | null;
    initDataType: string | null;
    // @ts-ignore
    streamDataCallback: ((p1: BufferSource) => Promise) | null;
  }
}
/**
 *  fromCache
 *   Optional. If true, this response was from a cache and should be ignored
 *   for bandwidth estimation.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Response {
    uri: string;
    data: BufferSource;
    status: number | undefined;
    headers: { [key: string]: string };
    timeMs: number | undefined;
    fromCache: boolean | undefined;
  }
}
/**
 * @description
 * Defines a plugin that handles a specific scheme.
 *
 * The functions accepts four parameters, uri string, request, request type,
 * a progressUpdated function, and a headersReceived function.  The
 * progressUpdated and headersReceived functions can be ignored by plugins that
 * do not have this information, but it will always be provided by
 * NetworkingEngine.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  type SchemePlugin = (
    p1: string,
    p2: shaka.extern.Request,
    p3: shaka.net.NetworkingEngine.RequestType,
    p4: shaka.extern.ProgressUpdated,
    p5: shaka.extern.HeadersReceived
  ) => shaka.extern.IAbortableOperation<shaka.extern.Response>;
}
/**
 *
 * @description
 * A callback function to handle progress event through networking engine in
 * player.
 * The first argument is a number for duration in milliseconds, that the request
 * took to complete.
 * The second argument is the total number of bytes downloaded during that
 * time.
 * The third argument is the number of bytes remaining to be loaded in a
 * segment.
 * @exportDoc
 */
declare namespace shaka.extern {
  type ProgressUpdated = (p1: number, p2: number, p3: number) => any;
}
/**
 *
 * @description
 * A callback function to handle headers received events through networking
 * engine in player.
 * The first argument is the headers object of the response.
 */
declare namespace shaka.extern {
  type HeadersReceived = (p1: { [key: string]: string }) => any;
}
/**
 * Defines a filter for requests.  This filter takes the request and modifies
 * it before it is sent to the scheme plugin.
 * A request filter can run asynchronously by returning a promise; in this case,
 * the request will not be sent until the promise is resolved.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  type RequestFilter = (
    p1: shaka.net.NetworkingEngine.RequestType,
    p2: shaka.extern.Request
    // @ts-ignore
  ) => Promise | undefined;
}
/**
 * Defines a filter for responses.  This filter takes the response and modifies
 * it before it is returned.
 * A response filter can run asynchronously by returning a promise.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  type ResponseFilter = (
    p1: shaka.net.NetworkingEngine.RequestType,
    p2: shaka.extern.Response
    // @ts-ignore
  ) => Promise | undefined;
}
