/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * A timer allows a single function to be executed at a later time or at
   * regular intervals.
   *
   * @final
   * @export
   */
  export class Timer {
    /**
     * Each time our timer "does work", we call that a "tick". The name comes
     * from old analog clocks.
     *
     */
    private onTick_: () => any;
    // @ts-ignore
    private ticker_: DelayedTick = null;

    /**
     * Create a new timer. A timer is committed to a single callback function.
     * While there is no technical reason to do this, it is far easier to
     * understand and use timers when they are connected to one functional idea.
     *
     */
    constructor(onTick: () => any) {
      this.onTick_ = onTick;
    }

    /**
     * Have the timer call |onTick| now.
     *
     * @export
     */
    tickNow(): Timer {
      this.stop();
      this.onTick_();
      return this;
    }

    /**
     * Have the timer call |onTick| after |seconds| has elapsed unless |stop| is
     * called first.
     *
     * @export
     */
    tickAfter(seconds: number): Timer {
      this.stop();
      this.ticker_ = new shaka.util.DelayedTick(() => {
        this.onTick_();
      }).tickAfter(seconds);
      return this;
    }

    /**
     * Have the timer call |onTick| every |seconds| until |stop| is called.
     *
     * @export
     */
    tickEvery(seconds: number): Timer {
      this.stop();
      this.ticker_ = new shaka.util.DelayedTick(() => {
        // Schedule the timer again first. |onTick_| could cancel the timer and
        // rescheduling first simplifies the implementation.
        this.ticker_.tickAfter(seconds);
        this.onTick_();
      }).tickAfter(seconds);
      return this;
    }

    /**
     * Stop the timer and clear the previous behaviour. The timer is still usable
     * after calling |stop|.
     *
     * @export
     */
    stop() {
      if (this.ticker_) {
        this.ticker_.stop();
        // @ts-ignore
        this.ticker_ = null;
      }
    }
  }
}
