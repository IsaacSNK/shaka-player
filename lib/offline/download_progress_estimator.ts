/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.offline {
  /**
   * The download progress estimator class encapsulates all the logic for tracking
   * how much content has been downloaded and estimating its progress.
   *
   * @final
   */
  export class DownloadProgressEstimator {
    /**
     * This is the sum of all estimates passed to |open|. This is used as the
     * denominator when measuring progress.
     *
     */
    private estimatedTotal_: number = 0;

    /**
     * This is the sum of all estimates pass to |open| but only after |close|
     * has been called. This is used as the numerator when measuring progress so
     * that |estimatedTotal_ == estimatedDownloaded_| after everything is
     * downloaded.
     *
     */
    private estimatedDownloaded_: number = 0;

    /**
     * This is the total number of bytes actually downloaded. This will most
     * likely differ from |estimatedTotal_| after everything is downloaded since
     * our estimates will be off.
     *
     */
    private actualDownloaded_: number = 0;

    /**
     * This is a map of all pending downloads. This maps their download id (an
     * internal id) to the estimate. This will allow us to update
     * |estimatedDownloaded_| when |close| is called.
     *
     */
    private pending_: Map<number, number>;

    /**
     * This number is used to provide unique (to estimator) ids for each
     * download. This allows us to track each download in |pending_|.
     *
     */
    private nextId_: number = 0;

    constructor() {
      this.pending_ = new Map();
    }

    /**
     * Open a new download in the progress estimator. This will create an entry so
     * that we can track the download progress.
     *
     * This will return an id for the download. This id must be passed to |close|
     * in order for the |close| to be paired with this call to |open|.
     *
     */
    open(estimate: number): number {
      this.estimatedTotal_ += estimate;
      const id = this.nextId_;
      this.nextId_++;
      this.pending_.set(id, estimate);
      return id;
    }

    /**
     * Close a download in the estimator. This will signal that we have finished
     * downloading a segment and we can update the progress estimate.
     *
     */
    close(id: number, actual: number) {
      if (!this.pending_.has(id)) {
        return;
      }
      const estimate = this.pending_.get(id);
      this.pending_.delete(id);
      this.estimatedDownloaded_ += estimate;
      this.actualDownloaded_ += actual;
    }

    /**
     * Get the current estimate for how much progress we've made downloading the
     * content. Progress will be between 0 and 1.
     *
     * Depending on the order of calls to |open| and |close|,
     * |getEstimatedProgress| will fluctuate and is not guaranteed to always be
     * increasing.
     *
     */
    getEstimatedProgress(): number {
      return this.estimatedTotal_ == 0
        ? 0
        : this.estimatedDownloaded_ / this.estimatedTotal_;
    }

    /**
     * Get the total number of bytes that were actually downloaded.
     *
     */
    getTotalDownloaded(): number {
      return this.actualDownloaded_;
    }
  }
}
