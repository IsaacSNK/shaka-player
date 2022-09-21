/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as NetworkingEngineExports from './net___networking_engine';
import {NetworkingEngine} from './net___networking_engine';
import {DownloadProgressEstimator} from './offline___download_progress_estimator';
import {ArrayUtils} from './util___array_utils';
import {BufferUtils} from './util___buffer_utils';
import {Destroyer} from './util___destroyer';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import {IDestroyable} from './util___i_destroyable';
import {Pssh} from './util___pssh';

/**
 * This manages downloading segments.
 *
 * @final
 */
export class DownloadManager implements IDestroyable {
  private networkingEngine_: NetworkingEngine;

  /**
   * We group downloads. Within each group, the requests are executed in
   * series. Between groups, the requests are executed in parallel. We store
   * the promise chain that is doing the work.
   *
   */
  private groups_: Map<number, Promise>;
  private destroyer_: Destroyer;

  /**
   * A list of callback functions to cancel any in-progress downloads.
   *
   */
  private abortCallbacks_: (() => Promise)[] = [];

  /**
   * A callback for when a segment has been downloaded. The first parameter
   * is the progress of all segments, a number between 0.0 (0% complete) and
   * 1.0 (100% complete). The second parameter is the total number of bytes
   * that have been downloaded.
   *
   */
  private onProgress_: (p1: number, p2: number) => any;

  /**
   * A callback for when a segment has new PSSH data and we pass
   * on the initData to storage
   *
   */
  private onInitData_: (p1: Uint8Array, p2: string) => any;
  private estimator_: DownloadProgressEstimator;

  /**
   * Create a new download manager. It will use (but not own) |networkingEngine|
   * and call |onProgress| after each download.
   *
   */
  constructor(networkingEngine: NetworkingEngine) {
    this.networkingEngine_ = networkingEngine;
    this.groups_ = new Map();
    this.destroyer_ = new Destroyer(() => {
      // Add a "catch" block to stop errors from being returned.
      return this.abortAll().catch(() => {});
    });
    this.onProgress_ = (progress, size) => {};
    this.onInitData_ = (initData, systemId) => {};
    this.estimator_ = new DownloadProgressEstimator();
  }

  /** @override */
  destroy() {
    return this.destroyer_.destroy();
  }

  setCallbacks(
      onProgress: (p1: number, p2: number) => any,
      onInitData: (p1: Uint8Array, p2: string) => any) {
    this.onProgress_ = onProgress;
    this.onInitData_ = onInitData;
  }

  /**
   * Aborts all in-progress downloads.
   * @return A promise that will resolve once the downloads are fully
   *   aborted.
   */
  abortAll(): Promise {
    const promises = this.abortCallbacks_.map((callback) => callback());
    this.abortCallbacks_ = [];
    return Promise.all(promises);
  }

  /**
   * Adds a byte length to the download estimate.
   *
   * @return estimateId
   */
  addDownloadEstimate(estimatedByteLength: number): number {
    return this.estimator_.open(estimatedByteLength);
  }

  /**
   * Add a request to be downloaded as part of a group.
   *
   *    The group to add this segment to. If the group does not exist, a new
   *    group will be created.
   *   The callback for when this request has been downloaded. Downloading for
   *   |group| will pause until the promise returned by |onDownloaded| resolves.
   * @return Resolved when this request is complete.
   */
  queue(
      groupId: number, request: shaka.extern.Request, estimateId: number,
      isInitSegment: boolean,
      onDownloaded: (p1: BufferSource) => Promise): Promise {
    this.destroyer_.ensureNotDestroyed();
    const group = this.groups_.get(groupId) || Promise.resolve();

    // Add another download to the group.
    const newPromise = group.then(async () => {
      const response = await this.fetchSegment_(request);

      // Make sure we stop downloading if we have been destroyed.
      if (this.destroyer_.destroyed()) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
            ErrorExports.Code.OPERATION_ABORTED);
      }

      // Update initData
      if (isInitSegment) {
        const segmentBytes = BufferUtils.toUint8(response);
        const pssh = new Pssh(segmentBytes);
        for (const key in pssh.data) {
          const index = Number(key);
          const data = pssh.data[index];
          const systemId = pssh.systemIds[index];
          this.onInitData_(data, systemId);
        }
      }

      // Update all our internal stats.
      this.estimator_.close(estimateId, response.byteLength);
      this.onProgress_(
          this.estimator_.getEstimatedProgress(),
          this.estimator_.getTotalDownloaded());
      return onDownloaded(response);
    });
    this.groups_.set(groupId, newPromise);
    return newPromise;
  }

  /**
   * Add additional async work to the group work queue.
   *
   *    The group to add this group to. If the group does not exist, a new
   *    group will be created.
   *   The callback for the async work.  Downloading for this group will be
   *   blocked until the Promise returned by |callback| resolves.
   * @return Resolved when this work is complete.
   */
  queueWork(groupId: number, callback: () => Promise): Promise {
    this.destroyer_.ensureNotDestroyed();
    const group = this.groups_.get(groupId) || Promise.resolve();
    const newPromise = group.then(async () => {
      await callback();
    });
    this.groups_.set(groupId, newPromise);
    return newPromise;
  }

  /**
   * Get a promise that will resolve when all currently queued downloads have
   * finished.
   *
   */
  async waitToFinish(): Promise<number> {
    await Promise.all(this.groups_.values());
    return this.estimator_.getTotalDownloaded();
  }

  /**
   * Download a segment and return the data in the response.
   *
   */
  private async fetchSegment_(request: shaka.extern.Request):
      Promise<BufferSource> {
    const type = NetworkingEngineExports.RequestType.SEGMENT;
    const action: NetworkingEngineExports.PendingRequest =
        this.networkingEngine_.request(type, request);
    const abortCallback = () => {
      return action.abort();
    };
    this.abortCallbacks_.push(abortCallback);
    const response = await action.promise;
    ArrayUtils.remove(this.abortCallbacks_, abortCallback);
    return response.data;
  }
}
