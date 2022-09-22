/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RequestType } from "../../lib/net/networking_engine";
import { IAbortableOperation } from "./abortable";
import { DrmInfo } from "./manifest";

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
  retryParameters: RetryParameters;
  licenseRequestType: string|null;
  sessionId: string|null;
  drmInfo: DrmInfo|null;
  initData: Uint8Array|null;
  initDataType: string|null;
  streamDataCallback: ((p1: BufferSource) => Promise<any>)|null;
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
    (p1: string, p2: Request,
     p3: RequestType,
     p4: ProgressUpdated, p5: HeadersReceived) =>
       IAbortableOperation< Response>;
type ProgressUpdated = (p1: number, p2: number, p3: number) => any;
type HeadersReceived = (p1: {[key: string]: string}) => any;
type RequestFilter =
    (p1: RequestType, p2:Request) =>
        Promise<any>|undefined;
type ResponseFilter =
    (p1: RequestType, p2: Response) =>
        Promise<any>|undefined;
