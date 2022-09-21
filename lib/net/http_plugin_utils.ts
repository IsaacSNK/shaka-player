/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{log}from './log';
import*as logExports from './log';
import{Error}from './error';
import*as ErrorExports from './error';
import{StringUtils}from './string_utils';
import*as StringUtilsExports from './string_utils';
import{NetworkingEngine}from './networking_engine';
import*as NetworkingEngineExports from './networking_engine';
 
/**
 * @summary A set of http networking utility functions.
 * @exportDoc
 */ 
export class HttpPluginUtils {
   
  static makeResponse(headers: {[key:string]:string}, data: BufferSource, status: number, uri: string, responseURL: string, requestType: NetworkingEngineExports.RequestType): shaka.extern.Response {
    if (status >= 200 && status <= 299 && status != 202) {
       
      // Most 2xx HTTP codes are success cases. 
      const response: shaka.extern.Response = {uri:responseURL || uri, originalUri:uri, data:data, status:status, headers:headers, fromCache:!!headers['x-shaka-from-cache']};
      return response;
    } else {
      let responseText = null;
      try {
        responseText = StringUtils.fromBytesAutoDetect(data);
      } catch (exception) {
      }
      log.debug('HTTP error text:', responseText);
      const severity = status == 401 || status == 403 ? ErrorExports.Severity.CRITICAL : ErrorExports.Severity.RECOVERABLE;
      throw new Error(severity, ErrorExports.Category.NETWORK, ErrorExports.Code.BAD_HTTP_STATUS, uri, status, responseText, headers, requestType);
    }
  }
}
