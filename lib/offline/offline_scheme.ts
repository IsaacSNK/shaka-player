/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.offline {
  /**
   * @summary A plugin that handles requests for offline content.
   * @export
   */
  export class OfflineScheme {
    /**
     * @param progressUpdated Called when a
     *   progress event happened.
     * @export
     */
    static plugin(
      uri: string,
      request: shaka.extern.Request,
      requestType: RequestType,
      progressUpdated: shaka.extern.ProgressUpdated
    ): shaka.extern.IAbortableOperation<shaka.extern.Response> {
      const offlineUri = shaka.offline.OfflineUri.parse(uri);
      if (offlineUri && offlineUri.isManifest()) {
        return shaka.offline.OfflineScheme.getManifest_(uri);
      }
      if (offlineUri && offlineUri.isSegment()) {
        return shaka.offline.OfflineScheme.getSegment_(
          offlineUri.key(),
          offlineUri
        );
      }
      return shaka.util.AbortableOperation.failed(
        new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.NETWORK,
          shaka.util.Error.Code.MALFORMED_OFFLINE_URI,
          uri
        )
      );
    }

    private static getManifest_(
      uri: string
    ): shaka.extern.IAbortableOperation<shaka.extern.Response> {
      const response: shaka.extern.Response = {
        uri: uri,
        // @ts-ignore
        originalUri: uri,
        data: new ArrayBuffer(0),
        headers: { "content-type": "application/x-offline-manifest" },
      };
      return shaka.util.AbortableOperation.completed(response);
    }

    private static getSegment_(
      id: number,
      uri: OfflineUri
    ): shaka.extern.IAbortableOperation<shaka.extern.Response> {
      goog.asserts.assert(
        uri.isSegment(),
        "Only segment uri's should be given to getSegment"
      );
      const muxer: StorageMuxer = new shaka.offline.StorageMuxer();
      return shaka.util.AbortableOperation.completed(undefined)
        .chain(() => muxer.init())
        .chain(() => muxer.getCell(uri.mechanism(), uri.cell()))
        .chain((cell) => cell.getSegments([uri.key()]))
        .chain((segments) => {
          const segment = segments[0];
          return { uri: uri, data: segment.data, headers: {} };
        })
        .finally(() => muxer.destroy());
    }
  }
}
shaka.net.NetworkingEngine.registerScheme(
  "offline",
  shaka.offline.OfflineScheme.plugin
);
