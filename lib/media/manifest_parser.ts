/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  // TODO: revisit this when Closure Compiler supports partially-exported classes.
  /**
   * @summary An interface to register manifest parsers.
   * @export
   */
  export class ManifestParser {
    /**
     * Registers a manifest parser by file extension.
     *
     * @param extension The file extension of the manifest.
     * @param parserFactory The factory
     *   used to create parser instances.
     * @export
     */
    static registerParserByExtension(
      extension: string,
      parserFactory: shaka.extern.ManifestParser.Factory
    ) {
      shaka.media.ManifestParser.parsersByExtension[extension] = parserFactory;
    }

    /**
     * Registers a manifest parser by MIME type.
     *
     * @param mimeType The MIME type of the manifest.
     * @param parserFactory The factory
     *   used to create parser instances.
     * @export
     */
    static registerParserByMime(
      mimeType: string,
      parserFactory: shaka.extern.ManifestParser.Factory
    ) {
      shaka.media.ManifestParser.parsersByMime[mimeType] = parserFactory;
    }

    /**
     * Unregisters a manifest parser by MIME type.
     *
     * @param mimeType The MIME type of the manifest.
     * @export
     */
    static unregisterParserByMime(mimeType: string) {
      delete shaka.media.ManifestParser.parsersByMime[mimeType];
    }

    /**
     * Returns a map of manifest support for well-known types.
     *
     */
    static probeSupport(): { [key: string]: boolean } {
      const ManifestParser = shaka.media.ManifestParser;
      const support = {};

      // Make sure all registered parsers are shown, but only for MSE-enabled
      // platforms where our parsers matter.
      if (shaka.util.Platform.supportsMediaSource()) {
        for (const type in ManifestParser.parsersByMime) {
          support[type] = true;
        }
        for (const type in ManifestParser.parsersByExtension) {
          support[type] = true;
        }
      }

      // Make sure all well-known types are tested as well, just to show an
      // explicit false for things people might be expecting.
      const testMimeTypes = [
        // DASH
        "application/dash+xml",
        // HLS
        "application/x-mpegurl",
        "application/vnd.apple.mpegurl",
        // SmoothStreaming
        "application/vnd.ms-sstr+xml",
      ];
      const testExtensions = {
        // DASH
        mpd: "application/dash+xml",
        // HLS
        m3u8: "application/x-mpegurl",
        // SmoothStreaming
        ism: "application/vnd.ms-sstr+xml",
      };
      for (const type of testMimeTypes) {
        // Only query our parsers for MSE-enabled platforms.  Otherwise, query a
        // temporary media element for native support for these types.
        if (shaka.util.Platform.supportsMediaSource()) {
          support[type] = !!ManifestParser.parsersByMime[type];
        } else {
          support[type] = shaka.util.Platform.supportsMediaType(type);
        }
      }
      for (const extension in testExtensions) {
        // Only query our parsers for MSE-enabled platforms.  Otherwise, query a
        // temporary media element for native support for these MIME type for the
        // extension.
        if (shaka.util.Platform.supportsMediaSource()) {
          support[extension] = !!ManifestParser.parsersByExtension[extension];
        } else {
          const type = testExtensions[extension];
          support[extension] = shaka.util.Platform.supportsMediaType(type);
        }
      }
      return support;
    }

    /**
     * Get a factory that can create a manifest parser that should be able to
     * parse the manifest at |uri|.
     *
     */
    static async getFactory(
      uri: string,
      netEngine: NetworkingEngine,
      retryParams: shaka.extern.RetryParameters,
      mimeType: string | null
    ): Promise<shaka.extern.ManifestParser.Factory> {
      const ManifestParser = shaka.media.ManifestParser;

      // Try using the MIME type we were given.
      if (mimeType) {
        const factory = ManifestParser.parsersByMime[mimeType.toLowerCase()];
        if (factory) {
          return factory;
        }
        shaka.log.warning(
          "Could not determine manifest type using MIME type ",
          mimeType
        );
      }
      const extension = ManifestParser.getExtension(uri);
      if (extension) {
        const factory = ManifestParser.parsersByExtension[extension];
        if (factory) {
          return factory;
        }
        shaka.log.warning(
          "Could not determine manifest type for extension ",
          extension
        );
      } else {
        shaka.log.warning("Could not find extension for ", uri);
      }
      if (!mimeType) {
        mimeType = await ManifestParser.getMimeType(
          uri,
          netEngine,
          retryParams
        );
        if (mimeType) {
          const factory = shaka.media.ManifestParser.parsersByMime[mimeType];
          if (factory) {
            return factory;
          }
          shaka.log.warning(
            "Could not determine manifest type using MIME type",
            mimeType
          );
        }
      }
      throw new shaka.util.Error(
        shaka.util.Error.Severity.CRITICAL,
        shaka.util.Error.Category.MANIFEST,
        shaka.util.Error.Code.UNABLE_TO_GUESS_MANIFEST_TYPE,
        uri
      );
    }

    static async getMimeType(
      uri: string,
      netEngine: NetworkingEngine,
      retryParams: shaka.extern.RetryParameters
    ): Promise<string> {
      const type = shaka.net.NetworkingEngine.RequestType.MANIFEST;
      const request = shaka.net.NetworkingEngine.makeRequest(
        [uri],
        retryParams
      );
      request.method = "HEAD";
      const response = await netEngine.request(type, request).promise;

      // https://bit.ly/2K9s9kf says this header should always be available,
      // but just to be safe:
      const mimeType = response.headers["content-type"];
      return mimeType ? mimeType.toLowerCase().split(";").shift() : "";
    }

    static getExtension(uri: string): string {
      const uriObj = new goog.Uri(uri);
      const uriPieces = uriObj.getPath().split("/");
      const uriFilename = uriPieces.pop();
      const filenamePieces = uriFilename.split(".");

      // Only one piece means there is no extension.
      if (filenamePieces.length == 1) {
        return "";
      }
      return filenamePieces.pop().toLowerCase();
    }

    /**
     * Determines whether or not this URI and MIME type are supported by our own
     * manifest parsers on this platform.  This takes into account whether or not
     * MediaSource is available, as well as which parsers are registered to the
     * system.
     *
     */
    static isSupported(uri: string, mimeType: string): boolean {
      // Without MediaSource, our own parsers are useless.
      if (!shaka.util.Platform.supportsMediaSource()) {
        return false;
      }
      if (mimeType in shaka.media.ManifestParser.parsersByMime) {
        return true;
      }
      const extension = shaka.media.ManifestParser.getExtension(uri);
      if (extension in shaka.media.ManifestParser.parsersByExtension) {
        return true;
      }
      return false;
    }
  }
}
