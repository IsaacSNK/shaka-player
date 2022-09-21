/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
 
/**
 * This class tracks all the various components (some optional) that are used to
 * populate |shaka.extern.AdsStats| which is passed to the app.
 *
 * @final
 */ 
export class AdsStats {
  private loadTimes_: number[] = [];
  private started_: number = 0;
  private playedCompletely_: number = 0;
  private skipped_: number = 0;
   
  /**
     * Record the time it took to get the final manifest.
     *
     */ 
  addLoadTime(seconds: number) {
    this.loadTimes_.push(seconds);
  }
   
  /**
     * Increase the number of ads started by one.
     */ 
  incrementStarted() {
    this.started_++;
  }
   
  /**
     * Increase the number of ads played completely by one.
     */ 
  incrementPlayedCompletely() {
    this.playedCompletely_++;
  }
   
  /**
     * Increase the number of ads skipped by one.
     */ 
  incrementSkipped() {
    this.skipped_++;
  }
   
  /**
     * Create a stats blob that we can pass up to the app. This blob will not
     * reference any internal data.
     *
     */ 
  getBlob(): shaka.extern.AdsStats {
    return {loadTimes:this.loadTimes_, started:this.started_, playedCompletely:this.playedCompletely_, skipped:this.skipped_};
  }
}
