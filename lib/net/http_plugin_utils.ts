/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.net.NetworkingEngine");

namespace shaka.net {
  /**
   * @summary A set of http networking utility functions.
   * @exportDoc
   */
  export class HttpPluginUtils {
    static makeResponse(
      headers: { [key: string]: string },
      data: BufferSource,
      status: number,
      uri: string,
      responseURL: string,
      requestType: RequestType
    ): shaka.extern.Response {
      if (status >= 200 && status <= 299 && status != 202) {
        // Most 2xx HTTP codes are success cases.
        const response: shaka.extern.Response = {
          uri: responseURL || uri,
          // @ts-ignore
          originalUri: uri,
          data: data,
          status: status,
          headers: headers,
          fromCache: !!headers["x-shaka-from-cache"],
        };
        return response;
      } else {
        let responseText = null;
        try {
          // @ts-ignore
          responseText = shaka.util.StringUtils.fromBytesAutoDetect(data);
        } catch (exception) {}
        shaka.log.debug("HTTP error text:", responseText);
        const severity =
          status == 401 || status == 403
            ? shaka.util.Error.Severity.CRITICAL
            : shaka.util.Error.Severity.RECOVERABLE;
        throw new shaka.util.Error(
          severity,
          shaka.util.Error.Category.NETWORK,
          shaka.util.Error.Code.BAD_HTTP_STATUS,
          uri,
          status,
          responseText,
          headers,
          requestType
        );
      }
    }
  }
}
