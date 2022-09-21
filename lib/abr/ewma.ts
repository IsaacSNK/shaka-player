/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';

/**
 * @summary
 * This class computes an exponentionally-weighted moving average.
 */
export class Ewma {
  /**
   * Larger values of alpha expire historical data more slowly.
   */
  private alpha_: number;
  private estimate_: number = 0;
  private totalWeight_: number = 0;

  /**
   * @param halfLife The quantity of prior samples (by weight) used
   *   when creating a new estimate.  Those prior samples make up half of the
   *   new estimate.
   */
  constructor(halfLife: number) {
    asserts.assert(halfLife > 0, 'expected halfLife to be positive');
    this.alpha_ = Math.exp(Math.log(0.5) / halfLife);
  }

  /**
   * Update the alpha with a new halfLife value.
   *
   * @param halfLife The quantity of prior samples (by weight) used
   *   when creating a new estimate.  Those prior samples make up half of the
   *   new estimate.
   */
  updateAlpha(halfLife: number) {
    asserts.assert(halfLife > 0, 'expected halfLife to be positive');
    this.alpha_ = Math.exp(Math.log(0.5) / halfLife);
  }

  /**
   * Takes a sample.
   *
   */
  sample(weight: number, value: number) {
    const adjAlpha = Math.pow(this.alpha_, weight);
    const newEstimate = value * (1 - adjAlpha) + adjAlpha * this.estimate_;
    if (!isNaN(newEstimate)) {
      this.estimate_ = newEstimate;
      this.totalWeight_ += weight;
    }
  }

  getEstimate(): number {
    const zeroFactor = 1 - Math.pow(this.alpha_, this.totalWeight_);
    return this.estimate_ / zeroFactor;
  }
}
