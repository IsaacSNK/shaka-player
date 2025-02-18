/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.ads {
  /**
   * @export
   */
  export class ClientSideAd implements shaka.extern.IAd {
    private ad_: google.ima.Ad;
    private manager_: google.ima.AdsManager;
    private video_: HTMLMediaElement;
    private isPaused_: boolean = false;
    private volume_: number;
    private eventManager_: EventManager;

    constructor(
      imaAd: google.ima.Ad,
      imaAdManager: google.ima.AdsManager,
      video: HTMLMediaElement
    ) {
      this.ad_ = imaAd;
      this.manager_ = imaAdManager;
      this.video_ = video;
      this.volume_ = this.manager_.getVolume();
      this.eventManager_ = new shaka.util.EventManager();
      this.eventManager_.listen(
        this.manager_,
        google.ima.AdEvent.Type.PAUSED,
        () => {
          this.isPaused_ = true;
        }
      );
      this.eventManager_.listen(
        this.manager_,
        google.ima.AdEvent.Type.RESUMED,
        () => {
          this.isPaused_ = false;
        }
      );
    }

    /**
     * @override
     * @export
     */
    getDuration() {
      return this.ad_.getDuration();
    }

    /**
     * @override
     * @export
     */
    getMinSuggestedDuration() {
      return this.ad_.getMinSuggestedDuration();
    }

    /**
     * @override
     * @export
     */
    getRemainingTime() {
      return this.manager_.getRemainingTime();
    }

    /**
     * @override
     * @export
     */
    isPaused() {
      return this.isPaused_;
    }

    /**
     * @override
     * @export
     */
    isSkippable() {
      // IMA returns -1 for non-skippable ads. Any positive number is a genuine
      // skip offset, meaning the ad is skippable.
      return this.ad_.getSkipTimeOffset() >= 0;
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
      return this.manager_.getAdSkippableState();
    }

    /**
     * @override
     * @export
     */
    skip() {
      return this.manager_.skip();
    }

    setPaused(paused: boolean) {
      this.isPaused_ = paused;
    }

    /**
     * @override
     * @export
     */
    pause() {
      return this.manager_.pause();
    }

    /**
     * @override
     * @export
     */
    play() {
      return this.manager_.resume();
    }

    /**
     * @override
     * @export
     */
    getVolume() {
      return this.manager_.getVolume();
    }

    /**
     * @override
     * @export
     */
    setVolume(volume) {
      return this.manager_.setVolume(volume);
    }

    /**
     * @override
     * @export
     */
    isMuted() {
      return this.manager_.getVolume() == 0;
    }

    /**
     * @override
     * @export
     */
    isLinear() {
      return this.ad_.isLinear();
    }

    /**
     * @override
     * @export
     */
    resize(width, height) {
      let isInFullscreen = false;
      const video = this.video_ as HTMLVideoElement;
      if (document.fullscreenEnabled) {
        isInFullscreen = !!document.fullscreenElement;
      } else {
        if (video.webkitSupportsFullscreen) {
          isInFullscreen = video.webkitDisplayingFullscreen;
        }
      }
      const viewMode = isInFullscreen
        ? google.ima.ViewMode.FULLSCREEN
        : google.ima.ViewMode.NORMAL;
      this.manager_.resize(width, height, viewMode);
    }

    /**
     * @override
     * @export
     */
    setMuted(muted) {
      // Emulate the "mute" functionality, where current, pre-mute
      // volume is saved and can be restored on unmute.
      if (muted) {
        this.volume_ = this.getVolume();
        this.setVolume(0);
      } else {
        this.setVolume(this.volume_);
      }
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
      // @ts-ignore
      this.ad_ = null;
      // @ts-ignore
      this.manager_ = null;
    }
  }
}
