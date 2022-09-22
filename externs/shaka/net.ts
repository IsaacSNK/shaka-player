/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface RetryParameters {
  maxAttempts: number;
  baseDelay: number;
  backoffFactor: number;
  fuzzFactor: number;
  timeout: number;
  stallTimeout: number;
  connectionTimeout: number;
}

export interface Request {
  uris: string[];
  method: string;
  body: BufferSource|null;
  headers: {[key: string]: string};
  allowCrossSiteCredentials: boolean;
  retryParameters: shaka.extern.RetryParameters;
  licenseRequestType: string|null;
  sessionId: string|null;
  drmInfo: shaka.extern.DrmInfo|null;
  initData: Uint8Array|null;
  initDataType: string|null;
  streamDataCallback: ((p1: BufferSource) => Promise)|null;
}

export interface Response {
  uri: string;
  data: BufferSource;
  status: number|undefined;
  headers: {[key: string]: string};
  timeMs: number|undefined;
  fromCache: boolean|undefined;
}
type SchemePlugin =
    (p1: string, p2: shaka.extern.Request,
     p3: shaka.net.NetworkingEngine.RequestType,
     p4: shaka.extern.ProgressUpdated, p5: shaka.extern.HeadersReceived) =>
        shaka.extern.IAbortableOperation<shaka.extern.Response>;
type ProgressUpdated = (p1: number, p2: number, p3: number) => any;
type HeadersReceived = (p1: {[key: string]: string}) => any;
type RequestFilter =
    (p1: shaka.net.NetworkingEngine.RequestType, p2: shaka.extern.Request) =>
        Promise|undefined;
type ResponseFilter =
    (p1: shaka.net.NetworkingEngine.RequestType, p2: shaka.extern.Response) =>
        Promise|undefined;
