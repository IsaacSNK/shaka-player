/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {StateHistory} from './dev-workspace.shaka-player-fork.lib.util.state_history';
import {SwitchHistory} from './dev-workspace.shaka-player-fork.lib.util.switch_history';

/**
 * This class tracks all the various components (some optional) that are used to
 * populate |shaka.extern.Stats| which is passed to the app.
 *
 * @final
 */
export class Stats {
  private width_: number = NaN;
  private height_: number = NaN;
  private totalDroppedFrames_: number = NaN;
  private totalDecodedFrames_: number = NaN;
  private totalCorruptedFrames_: number = NaN;
  private totalStallsDetected_: number = NaN;
  private totalGapsJumped_: number = NaN;
  private completionPercent_: number = NaN;
  private loadLatencySeconds_: number = NaN;
  private manifestTimeSeconds_: number = NaN;
  private drmTimeSeconds_: number = NaN;
  private licenseTimeSeconds_: number = NaN;
  private liveLatencySeconds_: number = NaN;
  private maxSegmentDurationSeconds_: number = NaN;
  private currentStreamBandwidth_: number = NaN;
  private bandwidthEstimate_: number = NaN;
  private stateHistory_: StateHistory;
  private switchHistory_: SwitchHistory;

  constructor() {
    this.stateHistory_ = new StateHistory();
    this.switchHistory_ = new SwitchHistory();
  }

  /**
   * Update the ratio of dropped frames to total frames. This will replace the
   * previous values.
   *
   */
  setDroppedFrames(dropped: number, decoded: number) {
    this.totalDroppedFrames_ = dropped;
    this.totalDecodedFrames_ = decoded;
  }

  /**
   * Update corrupted frames. This will replace the previous values.
   *
   */
  setCorruptedFrames(corrupted: number) {
    this.totalCorruptedFrames_ = corrupted;
  }

  /**
   * Update number of stalls detected. This will replace the previous value.
   *
   */
  setStallsDetected(stallsDetected: number) {
    this.totalStallsDetected_ = stallsDetected;
  }

  /**
   * Update number of playback gaps jumped over. This will replace the previous
   * value.
   *
   */
  setGapsJumped(gapsJumped: number) {
    this.totalGapsJumped_ = gapsJumped;
  }

  /**
   * Set the width and height of the video we are currently playing.
   *
   */
  setResolution(width: number, height: number) {
    this.width_ = width;
    this.height_ = height;
  }

  /**
   * Record the time it took between the user signalling "I want to play this"
   * to "I am now seeing this".
   *
   */
  setLoadLatency(seconds: number) {
    this.loadLatencySeconds_ = seconds;
  }

  /**
   * Record the time it took to download and parse the manifest.
   *
   */
  setManifestTime(seconds: number) {
    this.manifestTimeSeconds_ = seconds;
  }

  /**
   * Record the current completion percent. This is the "high water mark", so it
   * will store the highest provided completion percent.
   *
   */
  setCompletionPercent(percent: number) {
    if (isNaN(this.completionPercent_)) {
      this.completionPercent_ = percent;
    } else {
      this.completionPercent_ = Math.max(this.completionPercent_, percent);
    }
  }

  /**
   * Record the time it took to download the first drm key.
   *
   */
  setDrmTime(seconds: number) {
    this.drmTimeSeconds_ = seconds;
  }

  /**
   * Record the cumulative time spent on license requests during this session.
   *
   */
  setLicenseTime(seconds: number) {
    this.licenseTimeSeconds_ = seconds;
  }

  /**
   * Record the latency in live streams.
   *
   */
  setLiveLatency(seconds: number) {
    this.liveLatencySeconds_ = seconds;
  }

  /**
   * Record the presentation's max segment duration.
   *
   */
  setMaxSegmentDuration(seconds: number) {
    this.maxSegmentDurationSeconds_ = seconds;
  }

  setCurrentStreamBandwidth(bandwidth: number) {
    this.currentStreamBandwidth_ = bandwidth;
  }

  setBandwidthEstimate(bandwidth: number) {
    this.bandwidthEstimate_ = bandwidth;
  }

  getStateHistory(): StateHistory {
    return this.stateHistory_;
  }

  getSwitchHistory(): SwitchHistory {
    return this.switchHistory_;
  }

  /**
   * Create a stats blob that we can pass up to the app. This blob will not
   * reference any internal data.
   *
   */
  getBlob(): shaka.extern.Stats {
    return {
      width: this.width_,
      height: this.height_,
      streamBandwidth: this.currentStreamBandwidth_,
      decodedFrames: this.totalDecodedFrames_,
      droppedFrames: this.totalDroppedFrames_,
      corruptedFrames: this.totalCorruptedFrames_,
      stallsDetected: this.totalStallsDetected_,
      gapsJumped: this.totalGapsJumped_,
      estimatedBandwidth: this.bandwidthEstimate_,
      completionPercent: this.completionPercent_,
      loadLatency: this.loadLatencySeconds_,
      manifestTimeSeconds: this.manifestTimeSeconds_,
      drmTimeSeconds: this.drmTimeSeconds_,
      playTime: this.stateHistory_.getTimeSpentIn('playing'),
      pauseTime: this.stateHistory_.getTimeSpentIn('paused'),
      bufferingTime: this.stateHistory_.getTimeSpentIn('buffering'),
      licenseTime: this.licenseTimeSeconds_,
      liveLatency: this.liveLatencySeconds_,
      maxSegmentDuration: this.maxSegmentDurationSeconds_,
      stateHistory: this.stateHistory_.getCopy(),
      switchHistory: this.switchHistory_.getCopy()
    };
  }

  /**
   * Create an empty stats blob. This resembles the stats when we are not
   * playing any content.
   *
   */
  static getEmptyBlob(): shaka.extern.Stats {
    return {
      width: NaN,
      height: NaN,
      streamBandwidth: NaN,
      decodedFrames: NaN,
      droppedFrames: NaN,
      corruptedFrames: NaN,
      stallsDetected: NaN,
      gapsJumped: NaN,
      estimatedBandwidth: NaN,
      completionPercent: NaN,
      loadLatency: NaN,
      manifestTimeSeconds: NaN,
      drmTimeSeconds: NaN,
      playTime: NaN,
      pauseTime: NaN,
      bufferingTime: NaN,
      licenseTime: NaN,
      liveLatency: NaN,
      maxSegmentDuration: NaN,
      switchHistory: [],
      stateHistory: []
    };
  }
}
