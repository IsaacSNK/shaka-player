/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.ads {
  /**
   * @export
   */
  export class ServerSideAd implements shaka.extern.IAd {
    private ad_: google.ima.dai.api.Ad;
    private adProgressData_: google.ima.dai.api.AdProgressData | null = null;
    private video_: HTMLMediaElement;

    constructor(imaAd: google.ima.dai.api.Ad, video: HTMLMediaElement) {
      this.ad_ = imaAd;
      this.video_ = video;
    }

    setProgressData(data: google.ima.dai.api.AdProgressData) {
      this.adProgressData_ = data;
    }

    /**
     * @override
     * @export
     */
    getDuration() {
      if (!this.adProgressData_) {
        // Unknown yet
        return -1;
      }
      return this.adProgressData_.duration;
    }

    /**
     * @override
     * @export
     */
    getMinSuggestedDuration() {
      return this.getDuration();
    }

    /**
     * @override
     * @export
     */
    getRemainingTime() {
      if (!this.adProgressData_) {
        // Unknown yet
        return -1;
      }
      return this.adProgressData_.duration - this.adProgressData_.currentTime;
    }

    /**
     * @override
     * @export
     */
    isPaused() {
      return this.video_.paused;
    }

    /**
     * @override
     * @export
     */
    isSkippable() {
      return this.ad_.isSkippable();
    }

    /**
     * @override
     * @export
     */
    getTimeUntilSkippable() {
      const skipOffset = this.ad_.getSkipTimeOffset();
      const canSkipIn = this.getRemainingTime() - skipOffset;
      return Math.max(canSkipIn, 0);
    }

    /**
     * @override
     * @export
     */
    canSkipNow() {
      return this.getTimeUntilSkippable() == 0;
    }

    /**
     * @override
     * @export
     */
    skip() {
      this.video_.currentTime += this.getRemainingTime();
    }

    /**
     * @override
     * @export
     */
    pause() {
      return this.video_.pause();
    }

    /**
     * @override
     * @export
     */
    play() {
      return this.video_.play();
    }

    /**
     * @override
     * @export
     */
    getVolume() {
      return this.video_.volume;
    }

    /**
     * @override
     * @export
     */
    setVolume(volume) {
      this.video_.volume = volume;
    }

    /**
     * @override
     * @export
     */
    isMuted() {
      return this.video_.muted;
    }

    /**
     * @override
     * @export
     */
    isLinear() {
      return true;
    }

    /**
     * @override
     * @export
     */
    resize(width, height) {}

    // Nothing
    /**
     * @override
     * @export
     */
    setMuted(muted) {
      this.video_.muted = muted;
    }

    /**
     * @override
     * @export
     */
    getSequenceLength() {
      const podInfo = this.ad_.getAdPodInfo();
      if (podInfo == null) {
        // No pod, just one ad.
        return 1;
      }
      return podInfo.getTotalAds();
    }

    /**
     * @override
     * @export
     */
    getPositionInSequence() {
      const podInfo = this.ad_.getAdPodInfo();
      if (podInfo == null) {
        // No pod, just one ad.
        return 1;
      }
      return podInfo.getAdPosition();
    }

    /**
     * @override
     * @export
     */
    release() {
      this.ad_ = null;
      this.adProgressData_ = null;
      this.video_ = null;
    }
  }
}
