/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.polyfill {
  /**
   * @summary A polyfill to provide MSE VideoPlaybackQuality metrics.
   * Many browsers do not yet provide this API, and Chrome currently provides
   * similar data through individual prefixed attributes on HTMLVideoElement.
   * @export
   */
  export class VideoPlaybackQuality {
    /**
     * Install the polyfill if needed.
     * @export
     */
    static install() {
      if (!window.HTMLVideoElement) {
        // Avoid errors on very old browsers.
        return;
      }

      // eslint-disable-next-line no-restricted-syntax
      const proto = HTMLVideoElement.prototype;
      if (proto.getVideoPlaybackQuality) {
        // No polyfill needed.
        return;
      }
      if (
        "webkitDroppedFrameCount" in proto ||
        shaka.util.Platform.isWebOS3()
      ) {
        // @ts-ignore
        proto.getVideoPlaybackQuality =
          shaka.polyfill.VideoPlaybackQuality.webkit_;
      }
    }

    /**
     * @this {HTMLVideoElement}
     */
    private static webkit_(): VideoPlaybackQuality {
      return {
        droppedVideoFrames: this.webkitDroppedFrameCount,
        totalVideoFrames: this.webkitDecodedFrameCount,
        // Not provided by this polyfill:
        corruptedVideoFrames: 0,
        creationTime: NaN,
        totalFrameDelay: 0,
      };
    }
  }
}
shaka.polyfill.register(shaka.polyfill.VideoPlaybackQuality.install);
