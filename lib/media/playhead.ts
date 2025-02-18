/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.media.PresentationTimeline");

namespace shaka.media {
  /**
   * Creates a Playhead, which manages the video's current time.
   *
   * The Playhead provides mechanisms for setting the presentation's start time,
   * restricting seeking to valid time ranges, and stopping playback for startup
   * and re-buffering.
   *
   */
  export class Playhead {
    /**
     * Set the start time. If the content has already started playback, this will
     * be ignored.
     *
     */
    setStartTime(startTime: number) {}

    /**
     * Get the number of playback stalls detected by the StallDetector.
     *
     */
    getStallsDetected(): number {}

    /**
     * Get the number of playback gaps jumped by the GapJumpingController.
     *
     */
    getGapsJumped(): number {}

    /**
     * Get the current playhead position. The position will be restricted to valid
     * time ranges.
     *
     */
    getTime(): number {}

    /**
     * Notify the playhead that the buffered ranges have changed.
     */
    notifyOfBufferingChange() {}
  }
}

namespace shaka.media {
  /**
   * A playhead implementation that only relies on the media element.
   *
   * @final
   */
  export class SrcEqualsPlayhead implements Playhead {
    private mediaElement_: HTMLMediaElement;
    private started_: boolean = false;
    private startTime_: number | null = null;
    private eventManager_: EventManager;

    constructor(mediaElement: HTMLMediaElement) {
      this.mediaElement_ = mediaElement;
      this.eventManager_ = new shaka.util.EventManager();

      // We listen for the loaded-data-event so that we know when we can
      // interact with |currentTime|.
      const onLoaded = () => {
        if (this.startTime_ == null || this.startTime_ == 0) {
          this.started_ = true;
        } else {
          // Startup is complete only when the video element acknowledges the
          // seek.
          this.eventManager_.listenOnce(this.mediaElement_, "seeking", () => {
            this.started_ = true;
          });
          const currentTime = this.mediaElement_.currentTime;

          // Using the currentTime allows using a negative number in Live HLS
          const newTime = Math.max(0, currentTime + this.startTime_);
          this.mediaElement_.currentTime = newTime;
        }
      };
      shaka.util.MediaReadyState.waitForReadyState(
        this.mediaElement_,
        HTMLMediaElement.HAVE_CURRENT_DATA,
        this.eventManager_,
        () => {
          onLoaded();
        }
      );
    }

    /** @override */
    release() {
      if (this.eventManager_) {
        this.eventManager_.release();
        this.eventManager_ = null;
      }
      // @ts-ignore
      this.mediaElement_ = null;
    }

    /** @override */
    setStartTime(startTime) {
      // If we have already started playback, ignore updates to the start time.
      // This is just to make things consistent.
      this.startTime_ = this.started_ ? this.startTime_ : startTime;
    }

    /** @override */
    getTime() {
      // If we have not started playback yet, return the start time. However once
      // we start playback we assume that we can always return the current time.
      const time = this.started_
        ? this.mediaElement_.currentTime
        : this.startTime_;

      // In the case that we have not started playback, but the start time was
      // never set, we don't know what the start time should be. To ensure we
      // always return a number, we will default back to 0.
      return time || 0;
    }

    /** @override */
    getStallsDetected() {
      return 0;
    }

    /** @override */
    getGapsJumped() {
      return 0;
    }

    /** @override */
    notifyOfBufferingChange() {}
  }
}

namespace shaka.media {
  /**
   * A playhead implementation that relies on the media element and a manifest.
   * When provided with a manifest, we can provide more accurate control than
   * the SrcEqualsPlayhead.
   *
   * TODO: Clean up and simplify Playhead.  There are too many layers of, methods
   *       for, and conditions on timestamp adjustment.
   *
   * @final
   */
  export class MediaSourcePlayhead implements Playhead {
    /**
     * The seek range must be at least this number of seconds long. If it is
     * smaller than this, change it to be this big so we don't repeatedly seek
     * to keep within a zero-width window.
     *
     * This is 3s long, to account for the weaker hardware on platforms like
     * Chromecast.
     *
     */
    private minSeekRange_: number = 3.0;
    private mediaElement_: HTMLMediaElement;
    private timeline_: PresentationTimeline;
    private minBufferTime_: number;
    private config_: shaka.extern.StreamingConfiguration | null;
    private onSeek_: () => any;
    private lastCorrectiveSeek_: number | null = null;
    private stallDetector_: StallDetector;
    private gapController_: GapJumpingController;
    private videoWrapper_: VideoWrapper;
    checkWindowTimer_: Timer;

    /**
     *     The playhead's initial position in seconds. If null, defaults to the
     *     start of the presentation for VOD and the live-edge for live.
     *     Called when the user agent seeks to a time within the presentation
     *     timeline.
     *     Called when an event is raised to be sent to the application.
     */
    constructor(
      mediaElement: HTMLMediaElement,
      manifest: shaka.extern.Manifest,
      config: shaka.extern.StreamingConfiguration,
      startTime: number | null,
      onSeek: () => any,
      onEvent: (p1: Event) => any
    ) {
      this.mediaElement_ = mediaElement;
      this.timeline_ = manifest.presentationTimeline;
      this.minBufferTime_ = manifest.minBufferTime || 0;
      this.config_ = config;
      this.onSeek_ = onSeek;
      this.stallDetector_ = this.createStallDetector_(
        mediaElement,
        config,
        onEvent
      );
      this.gapController_ = new shaka.media.GapJumpingController(
        mediaElement,
        manifest.presentationTimeline,
        config,
        this.stallDetector_,
        onEvent
      );
      this.videoWrapper_ = new shaka.media.VideoWrapper(
        mediaElement,
        () => this.onSeeking_(),
        this.getStartTime_(startTime)
      );
      this.checkWindowTimer_ = new shaka.util.Timer(() => {
        this.onPollWindow_();
      }).tickEvery(
        /* seconds= */
        0.25
      );
    }

    /** @override */
    release() {
      if (this.videoWrapper_) {
        this.videoWrapper_.release();
        // @ts-ignore
        this.videoWrapper_ = null;
      }
      if (this.gapController_) {
        this.gapController_.release();
        // @ts-ignore
        this.gapController_ = null;
      }
      if (this.checkWindowTimer_) {
        this.checkWindowTimer_.stop();
        this.checkWindowTimer_ = null;
      }
      this.config_ = null;
      // @ts-ignore
      this.timeline_ = null;
      // @ts-ignore
      this.videoWrapper_ = null;
      // @ts-ignore
      this.mediaElement_ = null;
      this.onSeek_ = () => {};
    }

    /** @override */
    setStartTime(startTime) {
      this.videoWrapper_.setTime(startTime);
    }

    /** @override */
    getTime() {
      const time = this.videoWrapper_.getTime();

      // Although we restrict the video's currentTime elsewhere, clamp it here to
      // ensure timing issues don't cause us to return a time outside the segment
      // availability window.  E.g., the user agent seeks and calls this function
      // before we receive the 'seeking' event.
      // We don't buffer when the livestream video is paused and the playhead time
      // is out of the seek range; thus, we do not clamp the current time when the
      // video is paused.
      // https://github.com/shaka-project/shaka-player/issues/1121
      if (this.mediaElement_.readyState > 0 && !this.mediaElement_.paused) {
        return this.clampTime_(time);
      }
      return time;
    }

    /** @override */
    getStallsDetected() {
      return this.stallDetector_.getStallsDetected();
    }

    /** @override */
    getGapsJumped() {
      return this.gapController_.getGapsJumped();
    }

    /**
     * Gets the playhead's initial position in seconds.
     *
     */
    private getStartTime_(startTime: number | null): number {
      if (startTime == null) {
        if (this.timeline_.getDuration() < Infinity) {
          // If the presentation is VOD, or if the presentation is live but has
          // finished broadcasting, then start from the beginning.
          startTime = this.timeline_.getSeekRangeStart();
        } else {
          // Otherwise, start near the live-edge.
          startTime = this.timeline_.getSeekRangeEnd();
        }
      } else {
        if (startTime < 0) {
          // For live streams, if the startTime is negative, start from a certain
          // offset time from the live edge.  If the offset from the live edge is
          // not available, start from the current available segment start point
          // instead, handled by clampTime_().
          startTime = this.timeline_.getSeekRangeEnd() + startTime;
        }
      }
      return this.clampSeekToDuration_(this.clampTime_(startTime));
    }

    /** @override */
    notifyOfBufferingChange() {
      this.gapController_.onSegmentAppended();
    }

    /**
     * Called on a recurring timer to keep the playhead from falling outside the
     * availability window.
     *
     */
    private onPollWindow_() {
      // Don't catch up to the seek range when we are paused or empty.
      // The definition of "seeking" says that we are seeking until the buffered
      // data intersects with the playhead.  If we fall outside of the seek range,
      // it doesn't matter if we are in a "seeking" state.  We can and should go
      // ahead and catch up while seeking.
      if (this.mediaElement_.readyState == 0 || this.mediaElement_.paused) {
        return;
      }
      const currentTime = this.videoWrapper_.getTime();
      let seekStart = this.timeline_.getSeekRangeStart();
      const seekEnd = this.timeline_.getSeekRangeEnd();
      if (seekEnd - seekStart < this.minSeekRange_) {
        seekStart = seekEnd - this.minSeekRange_;
      }
      if (currentTime < seekStart) {
        // The seek range has moved past the playhead.  Move ahead to catch up.
        const targetTime = this.reposition_(currentTime);
        shaka.log.info(
          "Jumping forward " +
            (targetTime - currentTime) +
            " seconds to catch up with the seek range."
        );
        this.mediaElement_.currentTime = targetTime;
      }
    }

    /**
     * Handles when a seek happens on the video.
     *
     */
    private onSeeking_() {
      this.gapController_.onSeeking();
      const currentTime = this.videoWrapper_.getTime();
      const targetTime = this.reposition_(currentTime);
      const gapLimit = shaka.media.GapJumpingController.BROWSER_GAP_TOLERANCE;
      if (Math.abs(targetTime - currentTime) > gapLimit) {
        // You can only seek like this every so often. This is to prevent an
        // infinite loop on systems where changing currentTime takes a significant
        // amount of time (e.g. Chromecast).
        const time = Date.now() / 1000;
        if (!this.lastCorrectiveSeek_ || this.lastCorrectiveSeek_ < time - 1) {
          this.lastCorrectiveSeek_ = time;
          this.videoWrapper_.setTime(targetTime);
          return;
        }
      }
      shaka.log.v1("Seek to " + currentTime);
      this.onSeek_();
    }

    /**
     * Clamp seek times and playback start times so that we never seek to the
     * presentation duration.  Seeking to or starting at duration does not work
     * consistently across browsers.
     *
     * @see https://github.com/shaka-project/shaka-player/issues/979
     * @return The adjusted seek time.
     */
    private clampSeekToDuration_(time: number): number {
      const duration = this.timeline_.getDuration();
      if (time >= duration) {
        goog.asserts.assert(
          this.config_.durationBackoff >= 0,
          "Duration backoff must be non-negative!"
        );
        return duration - this.config_.durationBackoff;
      }
      return time;
    }

    /**
     * Computes a new playhead position that's within the presentation timeline.
     *
     * @return The time to reposition the playhead to.
     */
    private reposition_(currentTime: number): number {
      goog.asserts.assert(
        this.config_,
        "Cannot reposition playhead when it has beeen destroyed"
      );
      const isBuffered: (p1: number) => any = (playheadTime) =>
        shaka.media.TimeRangesUtils.isBuffered(
          this.mediaElement_.buffered,
          playheadTime
        );
      const rebufferingGoal = Math.max(
        this.minBufferTime_,
        this.config_.rebufferingGoal
      );
      const safeSeekOffset = this.config_.safeSeekOffset;
      let start = this.timeline_.getSeekRangeStart();
      const end = this.timeline_.getSeekRangeEnd();
      const duration = this.timeline_.getDuration();
      if (end - start < this.minSeekRange_) {
        start = end - this.minSeekRange_;
      }

      // With live content, the beginning of the availability window is moving
      // forward.  This means we cannot seek to it since we will "fall" outside
      // the window while we buffer.  So we define a "safe" region that is far
      // enough away.  For VOD, |safe == start|.
      const safe = this.timeline_.getSafeSeekRangeStart(rebufferingGoal);

      // These are the times to seek to rather than the exact destinations.  When
      // we seek, we will get another event (after a slight delay) and these steps
      // will run again.  So if we seeked directly to |start|, |start| would move
      // on the next call and we would loop forever.
      const seekStart = this.timeline_.getSafeSeekRangeStart(safeSeekOffset);
      const seekSafe = this.timeline_.getSafeSeekRangeStart(
        rebufferingGoal + safeSeekOffset
      );
      if (currentTime >= duration) {
        shaka.log.v1("Playhead past duration.");
        return this.clampSeekToDuration_(currentTime);
      }
      if (currentTime > end) {
        shaka.log.v1("Playhead past end.");
        return end;
      }
      if (currentTime < start) {
        if (isBuffered(seekStart)) {
          shaka.log.v1("Playhead before start & start is buffered");
          return seekStart;
        } else {
          shaka.log.v1("Playhead before start & start is unbuffered");
          return seekSafe;
        }
      }
      if (currentTime >= safe || isBuffered(currentTime)) {
        shaka.log.v1("Playhead in safe region or in buffered region.");
        return currentTime;
      } else {
        shaka.log.v1("Playhead outside safe region & in unbuffered region.");
        return seekSafe;
      }
    }

    /**
     * Clamps the given time to the seek range.
     *
     * @param time The time in seconds.
     * @return The clamped time in seconds.
     */
    private clampTime_(time: number): number {
      const start = this.timeline_.getSeekRangeStart();
      if (time < start) {
        return start;
      }
      const end = this.timeline_.getSeekRangeEnd();
      if (time > end) {
        return end;
      }
      return time;
    }

    /**
     * Create and configure a stall detector using the player's streaming
     * configuration settings. If the player is configured to have no stall
     * detector, this will return |null|.
     *
     *     Called when an event is raised to be sent to the application.
     */
    private createStallDetector_(
      mediaElement: HTMLMediaElement,
      config: shaka.extern.StreamingConfiguration,
      onEvent: (p1: Event) => any
    ): StallDetector {
      if (!config.stallEnabled) {
        // @ts-ignore
        return null;
      }

      // Cache the values from the config so that changes to the config won't
      // change the initialized behaviour.
      const threshold = config.stallThreshold;
      const skip = config.stallSkip;

      // When we see a stall, we will try to "jump-start" playback by moving the
      // playhead forward.
      const detector = new shaka.media.StallDetector(
        new shaka.media.StallDetector.MediaElementImplementation(mediaElement),
        threshold,
        onEvent
      );
      detector.onStall((at, duration) => {
        shaka.log.debug(`Stall detected at ${at} for ${duration} seconds.`);
        if (skip) {
          shaka.log.debug(`Seeking forward ${skip} seconds to break stall.`);
          mediaElement.currentTime += skip;
        } else {
          shaka.log.debug("Pausing and unpausing to break stall.");
          mediaElement.pause();
          mediaElement.play();
        }
      });
      return detector;
    }
  }
}
