/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  /**
   * GapJumpingController handles jumping gaps that appear within the content.
   * This will only jump gaps between two buffered ranges, so we should not have
   * to worry about the availability window.
   *
   */
  export class GapJumpingController implements IReleasable {
    private onEvent_: ((p1: Event) => any) | null;
    private video_: HTMLMediaElement;
    private timeline_: PresentationTimeline | null;
    private config_: shaka.extern.StreamingConfiguration | null;
    private eventManager_: EventManager;
    private seekingEventReceived_: boolean = false;
    private prevReadyState_: number;
    private gapsJumped_: number = 0;

    /**
     * The stall detector tries to keep the playhead moving forward. It is
     * managed by the gap-jumping controller to avoid conflicts. On some
     * platforms, the stall detector is not wanted, so it may be null.
     *
     */
    private stallDetector_: StallDetector;
    private hadSegmentAppended_: boolean = false;

    /**
     * We can't trust |readyState| or 'waiting' events on all platforms. To make
     * up for this, we poll the current time. If we think we are in a gap, jump
     * out of it.
     *
     * See: https://bit.ly/2McuXxm and https://bit.ly/2K5xmJO
     *
     */
    private gapJumpTimer_: Timer | null;

    /**
     *   The stall detector is used to keep the playhead moving while in a
     *   playable region. The gap jumping controller takes ownership over the
     *   stall detector.
     *   If no stall detection logic is desired, |null| may be provided.
     *     Called when an event is raised to be sent to the application.
     */
    constructor(
      video: HTMLMediaElement,
      timeline: PresentationTimeline,
      config: shaka.extern.StreamingConfiguration,
      stallDetector: StallDetector,
      onEvent: (p1: Event) => any
    ) {
      this.onEvent_ = onEvent;
      this.video_ = video;
      this.timeline_ = timeline;
      this.config_ = config;
      this.eventManager_ = new shaka.util.EventManager();
      this.prevReadyState_ = video.readyState;
      this.stallDetector_ = stallDetector;
      this.eventManager_.listen(video, "waiting", () => this.onPollGapJump_());
      this.gapJumpTimer_ = new shaka.util.Timer(() => {
        this.onPollGapJump_();
      }).tickEvery(
        /* seconds= */
        0.25
      );
    }

    /** @override */
    release() {
      if (this.eventManager_) {
        this.eventManager_.release();
        this.eventManager_ = null;
      }
      if (this.gapJumpTimer_ != null) {
        this.gapJumpTimer_.stop();
        this.gapJumpTimer_ = null;
      }
      if (this.stallDetector_) {
        this.stallDetector_.release();
        // @ts-ignore
        this.stallDetector_ = null;
      }
      this.onEvent_ = null;
      this.timeline_ = null;
      // @ts-ignore
      this.video_ = null;
    }

    /**
     * Called when a segment is appended by StreamingEngine, but not when a clear
     * is pending. This means StreamingEngine will continue buffering forward from
     * what is buffered.  So we know about any gaps before the start.
     */
    onSegmentAppended() {
      this.hadSegmentAppended_ = true;
      this.onPollGapJump_();
    }

    /** Called when a seek has started. */
    onSeeking() {
      this.seekingEventReceived_ = true;
      this.hadSegmentAppended_ = false;
    }

    /**
     * Returns the total number of playback gaps jumped.
     */
    getGapsJumped(): number {
      return this.gapsJumped_;
    }

    /**
     * Called on a recurring timer to check for gaps in the media.  This is also
     * called in a 'waiting' event.
     *
     */
    private onPollGapJump_() {
      // Don't gap jump before the video is ready to play.
      if (this.video_.readyState == 0) {
        return;
      }

      // Do not gap jump if seeking has begun, but the seeking event has not
      // yet fired for this particular seek.
      if (this.video_.seeking) {
        if (!this.seekingEventReceived_) {
          return;
        }
      } else {
        this.seekingEventReceived_ = false;
      }

      // Don't gap jump while paused, so that you don't constantly jump ahead
      // while paused on a livestream.  We make an exception for time 0, since we
      // may be _required_ to seek on startup before play can begin, but only if
      // autoplay is enabled.
      if (
        this.video_.paused &&
        (this.video_.currentTime != 0 ||
          (!this.video_.autoplay && this.video_.currentTime == 0))
      ) {
        return;
      }

      // When the ready state changes, we have moved on, so we should fire the
      // large gap event if we see one.
      if (this.video_.readyState != this.prevReadyState_) {
        this.prevReadyState_ = this.video_.readyState;
      }
      if (this.stallDetector_ && this.stallDetector_.poll()) {
        // Some action was taken by StallDetector, so don't do anything yet.
        return;
      }
      const currentTime = this.video_.currentTime;
      const buffered = this.video_.buffered;
      const gapDetectionThreshold = this.config_.gapDetectionThreshold;
      const gapIndex = shaka.media.TimeRangesUtils.getGapIndex(
        buffered,
        currentTime,
        gapDetectionThreshold
      );

      // The current time is unbuffered or is too far from a gap.
      if (gapIndex == null) {
        return;
      }

      // If we are before the first buffered range, this could be an unbuffered
      // seek.  So wait until a segment is appended so we are sure it is a gap.
      if (gapIndex == 0 && !this.hadSegmentAppended_) {
        return;
      }

      // StreamingEngine can buffer past the seek end, but still don't allow
      // seeking past it.
      const jumpTo = buffered.start(gapIndex);
      const seekEnd = this.timeline_.getSeekRangeEnd();
      if (jumpTo >= seekEnd) {
        return;
      }
      const jumpSize = jumpTo - currentTime;

      // If we jump to exactly the gap start, we may detect a small gap due to
      // rounding errors or browser bugs.  We can ignore these extremely small
      // gaps since the browser should play through them for us.
      if (jumpSize < shaka.media.GapJumpingController.BROWSER_GAP_TOLERANCE) {
        return;
      }
      if (gapIndex == 0) {
        shaka.log.info(
          "Jumping forward",
          jumpSize,
          "seconds because of gap before start time of",
          jumpTo
        );
      } else {
        shaka.log.info(
          "Jumping forward",
          jumpSize,
          "seconds because of gap starting at",
          buffered.end(gapIndex - 1),
          "and ending at",
          jumpTo
        );
      }
      this.video_.currentTime = jumpTo;
      this.gapsJumped_++;
      this.onEvent_(
        new shaka.util.FakeEvent(shaka.util.FakeEvent.EventName.GapJumped)
      );
    }
  }
}

namespace shaka.media.GapJumpingController {
  /**
   * The limit, in seconds, for the gap size that we will assume the browser will
   * handle for us.
   */
  export const BROWSER_GAP_TOLERANCE = 0.001;
}
