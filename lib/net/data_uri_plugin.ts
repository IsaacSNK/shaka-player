/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.net {
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
      uri: string,
      request: shaka.extern.Request,
      requestType: RequestType,
      progressUpdated: shaka.extern.ProgressUpdated
    ): shaka.extern.IAbortableOperation<shaka.extern.Response> {
      try {
        const parsed = shaka.net.DataUriPlugin.parseRaw(uri);
        const response: shaka.extern.Response = {
          uri: uri,
          // @ts-ignore
          originalUri: uri,
          data: parsed.data,
          headers: { "content-type": parsed.contentType },
        };
        return shaka.util.AbortableOperation.completed(response);
      } catch (error) {
        return shaka.util.AbortableOperation.failed(error);
      }
    }

    static parseRaw(uri: string): { data: BufferSource; contentType: string } {
      // Extract the scheme.
      const parts = uri.split(":");
      if (parts.length < 2 || parts[0] != "data") {
        shaka.log.error("Bad data URI, failed to parse scheme");
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.NETWORK,
          shaka.util.Error.Code.MALFORMED_DATA_URI,
          uri
        );
      }
      const path = parts.slice(1).join(":");

      // Extract the encoding and MIME type (required but can be empty).
      const infoAndData = path.split(",");
      if (infoAndData.length < 2) {
        shaka.log.error(
          "Bad data URI, failed to extract encoding and MIME type"
        );
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.NETWORK,
          shaka.util.Error.Code.MALFORMED_DATA_URI,
          uri
        );
      }
      const info = infoAndData[0];
      const dataStr = window.decodeURIComponent(infoAndData.slice(1).join(","));

      // The MIME type is always the first thing in the semicolon-separated list
      // of type parameters.  It may be blank.
      const typeInfoList = info.split(";");
      const contentType = typeInfoList[0];

      // Check for base64 encoding, which is always the last in the
      // semicolon-separated list if present.
      let base64Encoded = false;
      if (
        typeInfoList.length > 1 &&
        typeInfoList[typeInfoList.length - 1] == "base64"
      ) {
        base64Encoded = true;
        typeInfoList.pop();
      }

      // Convert the data.
      let data: BufferSource;
      if (base64Encoded) {
        data = shaka.util.Uint8ArrayUtils.fromBase64(dataStr);
      } else {
        data = shaka.util.StringUtils.toUTF8(dataStr);
      }
      return { data: data, contentType };
    }
  }
}
shaka.net.NetworkingEngine.registerScheme(
  "data",
  shaka.net.DataUriPlugin.parse
);
