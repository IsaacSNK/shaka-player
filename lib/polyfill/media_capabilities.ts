/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.polyfill {
  /**
   * @summary A polyfill to provide navigator.mediaCapabilities on all browsers.
   * This is necessary for Tizen 3, Xbox One and possibly others we have yet to
   * discover.
   * @export
   */
  export class MediaCapabilities {
    /**
     * Install the polyfill if needed.
     * @suppress {const}
     * @export
     */
    static install() {
      // Since MediaCapabilities is not fully supported on some Chromecast yet,
      // we should always install polyfill for all Chromecast not Android-based.
      // TODO: re-evaluate MediaCapabilities in the future versions of Chromecast.
      // Since MediaCapabilities implementation is buggy in Apple browsers, we
      // should always install polyfill for Apple browsers.
      // See: https://github.com/shaka-project/shaka-player/issues/3530
      // TODO: re-evaluate MediaCapabilities in the future versions of Apple
      // Browsers.
      // Since MediaCapabilities implementation is buggy in PS5 browsers, we
      // should always install polyfill for PS5 browsers.
      // See: https://github.com/shaka-project/shaka-player/issues/3582
      // TODO: re-evaluate MediaCapabilities in the future versions of PS5
      // Browsers.
      // Since MediaCapabilities implementation does not exist in PS4 browsers, we
      // should always install polyfill.
      // Since MediaCapabilities implementation is buggy in Tizen browsers, we
      // should always install polyfill for Tizen browsers.
      // Since MediaCapabilities implementation is buggy in WebOS browsers, we
      // should always install polyfill for WebOS browsers.
      let canUseNativeMCap = true;
      if (
        shaka.util.Platform.isApple() ||
        shaka.util.Platform.isPS5() ||
        shaka.util.Platform.isPS4() ||
        shaka.util.Platform.isWebOS() ||
        shaka.util.Platform.isTizen() ||
        shaka.util.Platform.isChromecast()
      ) {
        canUseNativeMCap = false;
      }
      if (shaka.util.Platform.isAndroidCastDevice()) {
        canUseNativeMCap = true;
      }
      if (canUseNativeMCap && navigator.mediaCapabilities) {
        shaka.log.info(
          "MediaCapabilities: Native mediaCapabilities support found."
        );
        return;
      }
      shaka.log.info("MediaCapabilities: install");
      if (!navigator.mediaCapabilities) {
        navigator.mediaCapabilities = {} as MediaCapabilities;
      }

      // Keep the patched MediaCapabilities object from being garbage-collected in
      // Safari.
      // See https://github.com/shaka-project/shaka-player/issues/3696#issuecomment-1009472718
      shaka.polyfill.MediaCapabilities.originalMcap =
        navigator.mediaCapabilities;
      navigator.mediaCapabilities.decodingInfo =
        shaka.polyfill.MediaCapabilities.decodingInfo_;
    }

    private static async decodingInfo_(
      mediaDecodingConfig: MediaDecodingConfiguration
    ): Promise<MediaCapabilitiesDecodingInfo> {
      const res = {
        supported: false,
        powerEfficient: true,
        smooth: true,
        keySystemAccess: null,
        configuration: mediaDecodingConfig,
      };
      if (!mediaDecodingConfig) {
        return res;
      }
      if (mediaDecodingConfig.type == "media-source") {
        if (!shaka.util.Platform.supportsMediaSource()) {
          return res;
        }

        // Use 'MediaSource.isTypeSupported' to check if the stream is supported.
        if (mediaDecodingConfig["video"]) {
          const contentType = mediaDecodingConfig["video"].contentType;
          const isSupported = MediaSource.isTypeSupported(contentType);
          if (!isSupported) {
            return res;
          }
        }
        if (mediaDecodingConfig["audio"]) {
          const contentType = mediaDecodingConfig["audio"].contentType;
          const isSupported = MediaSource.isTypeSupported(contentType);
          if (!isSupported) {
            return res;
          }
        }
      } else {
        if (mediaDecodingConfig.type == "file") {
          if (mediaDecodingConfig["video"]) {
            const contentType = mediaDecodingConfig["video"].contentType;
            const isSupported =
              shaka.util.Platform.supportsMediaType(contentType);
            if (!isSupported) {
              return res;
            }
          }
          if (mediaDecodingConfig["audio"]) {
            const contentType = mediaDecodingConfig["audio"].contentType;
            const isSupported =
              shaka.util.Platform.supportsMediaType(contentType);
            if (!isSupported) {
              return res;
            }
          }
        } else {
          // Otherwise not supported.
          return res;
        }
      }
      if (!mediaDecodingConfig.keySystemConfiguration) {
        // The variant is supported if it's unencrypted.
        res.supported = true;
        return Promise.resolve(res);
      } else {
        // Get the MediaKeySystemAccess for the key system.
        // Convert the MediaDecodingConfiguration object to a
        // MediaKeySystemConfiguration object.
        const mediaCapkeySystemConfig: MediaCapabilitiesKeySystemConfiguration =
          mediaDecodingConfig.keySystemConfiguration;
        const audioCapabilities = [];
        const videoCapabilities = [];
        if (mediaCapkeySystemConfig.audio) {
          const capability = {
            robustness: mediaCapkeySystemConfig.audio.robustness || "",
            // @ts-ignore
            contentType: mediaDecodingConfig.audio.contentType,
          };
          audioCapabilities.push(capability);
        }
        if (mediaCapkeySystemConfig.video) {
          const capability = {
            robustness: mediaCapkeySystemConfig.video.robustness || "",
            // @ts-ignore
            contentType: mediaDecodingConfig.video.contentType,
          };
          videoCapabilities.push(capability);
        }
        const mediaKeySystemConfig: MediaKeySystemConfiguration = {
          initDataTypes: [mediaCapkeySystemConfig.initDataType],
          distinctiveIdentifier: mediaCapkeySystemConfig.distinctiveIdentifier,
          persistentState: mediaCapkeySystemConfig.persistentState,
          sessionTypes: mediaCapkeySystemConfig.sessionTypes,
        };

        // Only add the audio video capabilities if they have valid data.
        // Otherwise the query will fail.
        if (audioCapabilities.length) {
          mediaKeySystemConfig.audioCapabilities = audioCapabilities;
        }
        if (videoCapabilities.length) {
          mediaKeySystemConfig.videoCapabilities = videoCapabilities;
        }
        let keySystemAccess;
        try {
          keySystemAccess = await navigator.requestMediaKeySystemAccess(
            mediaCapkeySystemConfig.keySystem,
            [mediaKeySystemConfig]
          );
        } catch (e) {
          shaka.log.info("navigator.requestMediaKeySystemAccess failed.");
        }
        if (keySystemAccess) {
          res.supported = true;
          res.keySystemAccess = keySystemAccess;
        }
      }
      return res;
    }
  }
}

namespace shaka.polyfill.MediaCapabilities {
  /**
   * A copy of the MediaCapabilities instance, to prevent Safari from
   * garbage-collecting the polyfilled method on it.  We make it public and export
   * it to ensure that it is not stripped out by the compiler.
   *
   * @export
   */
  // @ts-ignore
  export const originalMcap: MediaCapabilities = null;
}

// Install at a lower priority than MediaSource polyfill, so that we have
// MediaSource available first.
shaka.polyfill.register(shaka.polyfill.MediaCapabilities.install, -1);
