/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Ewma} from './abr___ewma';

/**
 * @summary
 * This class tracks bandwidth samples and estimates available bandwidth.
 * Based on the minimum of two exponentially-weighted moving averages with
 * different half-lives.
 *
 */
export class EwmaBandwidthEstimator {
  /**
   * A fast-moving average.
   * Half of the estimate is based on the last 2 seconds of sample history.
   */
  private fast_: Ewma;

  /**
   * A slow-moving average.
   * Half of the estimate is based on the last 5 seconds of sample history.
   */
  private slow_: Ewma;

  /**
   * Number of bytes sampled.
   */
  private bytesSampled_: number = 0;

  /**
   * Minimum number of bytes sampled before we trust the estimate.  If we have
   * not sampled much data, our estimate may not be accurate enough to trust.
   * If bytesSampled_ is less than minTotalBytes_, we use defaultEstimate_.
   * This specific value is based on experimentation.
   *
   */
  private minTotalBytes_: number = 128e3;

  /**
   * Minimum number of bytes, under which samples are discarded.  Our models
   * do not include latency information, so connection startup time (time to
   * first byte) is considered part of the download time.  Because of this, we
   * should ignore very small downloads which would cause our estimate to be
   * too low.
   * This specific value is based on experimentation.
   *
   */
  private minBytes_: number = 16e3;

  constructor() {
    this.fast_ = new Ewma(2);
    this.slow_ = new Ewma(5);

    // 128kB
  }

  // 16kB
  /**
   * Called by the Player to provide an updated configuration any time it
   * changes.
   * Must be called at least once before init().
   *
   */
  configure(config: shaka.extern.AdvancedAbrConfiguration) {
    this.minTotalBytes_ = config.minTotalBytes;
    this.minBytes_ = config.minBytes;
    this.fast_.updateAlpha(config.fastHalfLife);
    this.slow_.updateAlpha(config.slowHalfLife);
  }

  /**
   * Takes a bandwidth sample.
   *
   * @param durationMs The amount of time, in milliseconds, for a
   *   particular request.
   * @param numBytes The total number of bytes transferred in that
   *   request.
   */
  sample(durationMs: number, numBytes: number) {
    if (numBytes < this.minBytes_) {
      return;
    }
    const bandwidth = 8000 * numBytes / durationMs;
    const weight = durationMs / 1000;
    this.bytesSampled_ += numBytes;
    this.fast_.sample(weight, bandwidth);
    this.slow_.sample(weight, bandwidth);
  }

  /**
   * Gets the current bandwidth estimate.
   *
   * @return The bandwidth estimate in bits per second.
   */
  getBandwidthEstimate(defaultEstimate: number): number {
    if (this.bytesSampled_ < this.minTotalBytes_) {
      return defaultEstimate;
    }

    // Take the minimum of these two estimates.  This should have the effect
    // of adapting down quickly, but up more slowly.
    return Math.min(this.fast_.getEstimate(), this.slow_.getEstimate());
  }

  /**
   * @return True if there is enough data to produce a meaningful
   *   estimate.
   */
  hasGoodEstimate(): boolean {
    return this.bytesSampled_ >= this.minTotalBytes_;
  }
}
