/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as NetworkingEngineExports from './../net/networking_engine';
import {NetworkingEngine} from './../net/networking_engine';

/**
 * A collection of shared utilities that bridge the gap between our networking
 * code and the other parts of our code base. This is to allow
 * |shaka.net.NetworkingEngine| to remain general.
 *
 * @final
 */
export class Networking {
  /**
   * Create a request message for a segment. Providing |start| and |end|
   * will set the byte range. A non-zero start must be provided for |end| to
   * be used.
   *
   */
  static createSegmentRequest(
      uris: string[], start: number|null, end: number|null,
      retryParameters: shaka.extern.RetryParameters,
      streamDataCallback?: ((p1: BufferSource) => Promise)|
      null): shaka.extern.Request {
    const request =
        NetworkingEngine.makeRequest(uris, retryParameters, streamDataCallback);

    // This is a request for the entire segment.  The Range header is not
    // required.  Note that some web servers don't accept Range headers, so
    // don't set one if it's not strictly required.
    if (start == 0 && end == null) {
    } else {
      if (end) {
        request.headers['Range'] = 'bytes=' + start + '-' + end;
      } else {
        request.headers['Range'] = 'bytes=' + start + '-';
      }
    }
    return request;
  }
}
