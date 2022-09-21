/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './debug___log';
import {log} from './debug___log';
import * as NetworkingEngineExports from './net___networking_engine';
import {NetworkingEngine} from './net___networking_engine';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import * as StringUtilsExports from './util___string_utils';
import {StringUtils} from './util___string_utils';

/**
 * @summary A set of http networking utility functions.
 * @exportDoc
 */
export class HttpPluginUtils {
  static makeResponse(
      headers: {[key: string]: string}, data: BufferSource, status: number,
      uri: string, responseURL: string,
      requestType: NetworkingEngineExports.RequestType): shaka.extern.Response {
    if (status >= 200 && status <= 299 && status != 202) {
      // Most 2xx HTTP codes are success cases.
      const response: shaka.extern.Response = {
        uri: responseURL || uri,
        originalUri: uri,
        data: data,
        status: status,
        headers: headers,
        fromCache: !!headers['x-shaka-from-cache']
      };
      return response;
    } else {
      let responseText = null;
      try {
        responseText = StringUtils.fromBytesAutoDetect(data);
      } catch (exception) {
      }
      log.debug('HTTP error text:', responseText);
      const severity = status == 401 || status == 403 ?
          ErrorExports.Severity.CRITICAL :
          ErrorExports.Severity.RECOVERABLE;
      throw new Error(
          severity, ErrorExports.Category.NETWORK,
          ErrorExports.Code.BAD_HTTP_STATUS, uri, status, responseText, headers,
          requestType);
    }
  }
}
