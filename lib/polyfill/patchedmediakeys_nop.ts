/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.polyfill {
  /**
   * @summary A polyfill to stub out
   * {@link https://bit.ly/EmeMar15 EME draft 12 March 2015} on browsers without
   * EME.
   * All methods will fail.
   * @export
   */
  export class PatchedMediaKeysNop {
    /**
     * Installs the polyfill if needed.
     * @export
     */
    static install() {
      if (
        !window.HTMLVideoElement ||
        (navigator.requestMediaKeySystemAccess &&
          // eslint-disable-next-line no-restricted-syntax
          MediaKeySystemAccess.prototype.getConfiguration)
      ) {
        return;
      }
      shaka.log.info("EME not available.");

      // Alias.
      const PatchedMediaKeysNop = shaka.polyfill.PatchedMediaKeysNop;

      // Install patches.
      navigator.requestMediaKeySystemAccess =
        PatchedMediaKeysNop.requestMediaKeySystemAccess;

      // Delete mediaKeys to work around strict mode compatibility issues.
      // eslint-disable-next-line no-restricted-syntax
      delete HTMLMediaElement.prototype["mediaKeys"];

      // Work around read-only declaration for mediaKeys by using a string.
      // eslint-disable-next-line no-restricted-syntax
      HTMLMediaElement.prototype["mediaKeys"] = null;

      // eslint-disable-next-line no-restricted-syntax
      HTMLMediaElement.prototype.setMediaKeys =
        PatchedMediaKeysNop.setMediaKeys;

      // These are not usable, but allow Player.isBrowserSupported to pass.
      // @ts-ignore
      window.MediaKeys = PatchedMediaKeysNop.MediaKeys;
      // @ts-ignore
      window.MediaKeySystemAccess = PatchedMediaKeysNop.MediaKeySystemAccess;
      window.shakaMediaKeysPolyfill = true;
    }

    /**
     * An implementation of navigator.requestMediaKeySystemAccess.
     * Retrieves a MediaKeySystemAccess object.
     *
     * @this {!Navigator}
     */
    static requestMediaKeySystemAccess(
      keySystem: string,
      supportedConfigurations: MediaKeySystemConfiguration[]
    ): Promise<MediaKeySystemAccess> {
      shaka.log.debug("PatchedMediaKeysNop.requestMediaKeySystemAccess");
      goog.asserts.assert(
        this == navigator,
        'bad "this" for requestMediaKeySystemAccess'
      );
      return Promise.reject(
        new Error("The key system specified is not supported.")
      );
    }

    /**
     * An implementation of HTMLMediaElement.prototype.setMediaKeys.
     * Attaches a MediaKeys object to the media element.
     *
     * @this {!HTMLMediaElement}
     */
    // @ts-ignore
    static setMediaKeys(mediaKeys: MediaKeys): Promise {
      shaka.log.debug("PatchedMediaKeysNop.setMediaKeys");
      goog.asserts.assert(
        this instanceof HTMLMediaElement,
        'bad "this" for setMediaKeys'
      );
      if (mediaKeys == null) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("MediaKeys not supported."));
    }
  }
}

namespace shaka.polyfill.PatchedMediaKeysNop {
  /**
   * An unusable constructor for MediaKeys.
   */
  export class MediaKeys implements MediaKeys {
    constructor() {
      throw new TypeError("Illegal constructor.");
    }

    /** @override */
    createSession() {}

    /** @override */
    setServerCertificate() {}
  }
}

namespace shaka.polyfill.PatchedMediaKeysNop {
  /**
   * An unusable constructor for MediaKeySystemAccess.
   */
  export class MediaKeySystemAccess implements MediaKeySystemAccess {
    /** @override */
    keySystem: any = "";

    constructor() {
      // For the compiler.
      throw new TypeError("Illegal constructor.");
    }

    /** @override */
    getConfiguration() {}

    /** @override */
    createMediaKeys() {}
  }
}

// A low priority ensures this is the last and acts as a fallback.
shaka.polyfill.register(shaka.polyfill.PatchedMediaKeysNop.install, -10);
