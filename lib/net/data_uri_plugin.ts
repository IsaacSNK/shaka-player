/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './debug___log';
import {log} from './debug___log';
import * as NetworkingEngineExports from './net___networking_engine';
import {NetworkingEngine} from './net___networking_engine';
import {AbortableOperation} from './util___abortable_operation';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import * as StringUtilsExports from './util___string_utils';
import {StringUtils} from './util___string_utils';
import {Uint8ArrayUtils} from './util___uint8array_utils';

/**
 * @summary A networking plugin to handle data URIs.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs
 * @export
 */
export class DataUriPlugin {
  /**
   * @param progressUpdated Called when a
   *   progress event happened.
   * @export
   */
  static parse(
      uri: string, request: shaka.extern.Request,
      requestType: NetworkingEngineExports.RequestType,
      progressUpdated: shaka.extern.ProgressUpdated):
      shaka.extern.IAbortableOperation<shaka.extern.Response> {
    try {
      const parsed = DataUriPlugin.parseRaw(uri);
      const response: shaka.extern.Response = {
        uri: uri,
        originalUri: uri,
        data: parsed.data,
        headers: {'content-type': parsed.contentType}
      };
      return AbortableOperation.completed(response);
    } catch (error) {
      return AbortableOperation.failed(error);
    }
  }

  static parseRaw(uri: string): {data: BufferSource, contentType: string} {
    // Extract the scheme.
    const parts = uri.split(':');
    if (parts.length < 2 || parts[0] != 'data') {
      log.error('Bad data URI, failed to parse scheme');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.NETWORK,
          ErrorExports.Code.MALFORMED_DATA_URI, uri);
    }
    const path = parts.slice(1).join(':');

    // Extract the encoding and MIME type (required but can be empty).
    const infoAndData = path.split(',');
    if (infoAndData.length < 2) {
      log.error('Bad data URI, failed to extract encoding and MIME type');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.NETWORK,
          ErrorExports.Code.MALFORMED_DATA_URI, uri);
    }
    const info = infoAndData[0];
    const dataStr = window.decodeURIComponent(infoAndData.slice(1).join(','));

    // The MIME type is always the first thing in the semicolon-separated list
    // of type parameters.  It may be blank.
    const typeInfoList = info.split(';');
    const contentType = typeInfoList[0];

    // Check for base64 encoding, which is always the last in the
    // semicolon-separated list if present.
    let base64Encoded = false;
    if (typeInfoList.length > 1 &&
        typeInfoList[typeInfoList.length - 1] == 'base64') {
      base64Encoded = true;
      typeInfoList.pop();
    }

    // Convert the data.
    let data: BufferSource;
    if (base64Encoded) {
      data = Uint8ArrayUtils.fromBase64(dataStr);
    } else {
      data = StringUtils.toUTF8(dataStr);
    }
    return {data: data, contentType};
  }
}
NetworkingEngine.registerScheme('data', DataUriPlugin.parse);
