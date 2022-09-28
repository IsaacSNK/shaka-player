/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  /**
   * Creates a new VideoWrapper that manages setting current time and playback
   * rate.  This handles seeks before content is loaded and ensuring the video
   * time is set properly.  This doesn't handle repositioning within the
   * presentation window.
   *
   */
  export class VideoWrapper implements IReleasable {
    private video_: HTMLMediaElement;
    private onSeek_: () => any;
    private startTime_: number;
    private started_: boolean = false;
    private eventManager_: EventManager;
    private mover_: PlayheadMover;

    /**
     * @param onSeek Called when the video seeks.
     * @param startTime The time to start at.
     */
    constructor(video: HTMLMediaElement, onSeek: () => any, startTime: number) {
      this.video_ = video;
      this.onSeek_ = onSeek;
      this.startTime_ = startTime;
      this.eventManager_ = new shaka.util.EventManager();
      this.mover_ = new shaka.media.VideoWrapper.PlayheadMover(
        /* mediaElement= */
        video,
        /* maxAttempts= */
        10
      );

      // Before we can set the start time, we must check if the video element is
      // ready. If the video element is not ready, we cannot set the time. To work
      // around this, we will wait for the "loadedmetadata" event which tells us
      // that the media element is now ready.
      shaka.util.MediaReadyState.waitForReadyState(
        this.video_,
        HTMLMediaElement.HAVE_METADATA,
        this.eventManager_,
        () => {
          this.setStartTime_(this.startTime_);
        }
      );
    }

    /** @override */
    release() {
      if (this.eventManager_) {
        this.eventManager_.release();
        this.eventManager_ = null;
      }
      if (this.mover_ != null) {
        this.mover_.release();
        this.mover_ = null;
      }
      this.onSeek_ = () => {};
      this.video_ = null;
    }

    /**
     * Gets the video's current (logical) position.
     *
     */
    getTime(): number {
      return this.started_ ? this.video_.currentTime : this.startTime_;
    }

    /**
     * Sets the current time of the video.
     *
     */
    setTime(time: number) {
      if (this.video_.readyState > 0) {
        this.mover_.moveTo(time);
      } else {
        shaka.util.MediaReadyState.waitForReadyState(
          this.video_,
          HTMLMediaElement.HAVE_METADATA,
          this.eventManager_,
          () => {
            this.setStartTime_(this.startTime_);
          }
        );
      }
    }

    /**
     * Set the start time for the content. The given start time will be ignored if
     * the content does not start at 0.
     *
     */
    private setStartTime_(startTime: number) {
      // If we start close enough to our intended start time, then we won't do
      // anything special.
      if (Math.abs(this.video_.currentTime - startTime) < 0.001) {
        this.startListeningToSeeks_();
        return;
      }

      // We will need to delay adding our normal seeking listener until we have
      // seen the first seek event. We will force the first seek event later in
      // this method.
      this.eventManager_.listenOnce(this.video_, "seeking", () => {
        this.startListeningToSeeks_();
      });

      // If the currentTime != 0, it indicates that the user has seeked after
      // calling |Player.load|, meaning that |currentTime| is more meaningful than
      // |startTime|.
      // Seeking to the current time is a work around for Issue 1298. If we don't
      // do this, the video may get stuck and not play.
      // TODO: Need further investigation why it happens. Before and after
      // setting the current time, video.readyState is 1, video.paused is true,
      // and video.buffered's TimeRanges length is 0.
      // See: https://github.com/shaka-project/shaka-player/issues/1298
      this.mover_.moveTo(
        this.video_.currentTime == 0 ? startTime : this.video_.currentTime
      );
    }

    /**
     * Add the listener for seek-events. This will call the externally-provided
     * |onSeek| callback whenever the media element seeks.
     *
     */
    private startListeningToSeeks_() {
      goog.asserts.assert(
        this.video_.readyState > 0,
        "The media element should be ready before we listen for seeking."
      );

      // Now that any startup seeking is complete, we can trust the video element
      // for currentTime.
      this.started_ = true;
      this.eventManager_.listen(this.video_, "seeking", () => this.onSeek_());
    }
  }
}

namespace shaka.media.VideoWrapper {
  /**
   * A class used to move the playhead away from its current time.  Sometimes,
   * Edge ignores re-seeks. After changing the current time, check every 100ms,
   * retrying if the change was not accepted.
   *
   * Delay stats over 100 runs of a re-seeking integration test:
   *   Edge   -   0ms -   2%
   *   Edge   - 100ms -  40%
   *   Edge   - 200ms -  32%
   *   Edge   - 300ms -  24%
   *   Edge   - 400ms -   2%
   *   Chrome -   0ms - 100%
   *
   * TODO: File a bug on Edge about this.
   *
   * @final
   */
  export class PlayheadMover implements IReleasable {
    private mediaElement_: HTMLMediaElement;
    private maxAttempts_: number;
    private remainingAttempts_: number = 0;
    private originTime_: number = 0;
    private targetTime_: number = 0;
    private timer_: Timer;

    /**
     *    The media element that the mover can manipulate.
     *
     *    To prevent us from infinitely trying to change the current time, the
     *    mover accepts a max attempts value. At most, the mover will check if the
     *    video moved |maxAttempts| times. If this is zero of negative, no
     *    attempts will be made.
     */
    constructor(mediaElement: HTMLMediaElement, maxAttempts: number) {
      this.mediaElement_ = mediaElement;
      this.maxAttempts_ = maxAttempts;
      this.timer_ = new shaka.util.Timer(() => this.onTick_());
    }

    /** @override */
    release() {
      if (this.timer_) {
        this.timer_.stop();
        this.timer_ = null;
      }
      this.mediaElement_ = null;
    }

    /**
     * Try forcing the media element to move to |timeInSeconds|. If a previous
     * call to |moveTo| is still in progress, this will override it.
     *
     */
    moveTo(timeInSeconds: number) {
      this.originTime_ = this.mediaElement_.currentTime;
      this.targetTime_ = timeInSeconds;
      this.remainingAttempts_ = this.maxAttempts_;

      // Set the time and then start the timer. The timer will check if the set
      // was successful, and retry if not.
      this.mediaElement_.currentTime = timeInSeconds;
      this.timer_.tickEvery(
        /* seconds= */
        0.1
      );
    }

    private onTick_() {
      // Sigh... We ran out of retries...
      if (this.remainingAttempts_ <= 0) {
        shaka.log.warning(
          [
            "Failed to move playhead from",
            this.originTime_,
            "to",
            this.targetTime_,
          ].join(" ")
        );
        this.timer_.stop();
        return;
      }

      // Yay! We were successful.
      if (this.mediaElement_.currentTime != this.originTime_) {
        this.timer_.stop();
        return;
      }

      // Sigh... Try again...
      this.mediaElement_.currentTime = this.targetTime_;
      this.remainingAttempts_--;
    }
  }
}
