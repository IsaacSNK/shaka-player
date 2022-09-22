/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './../debug/asserts';
import {asserts} from './../debug/asserts';
import * as logExports from './../debug/log';
import {log} from './../debug/log';

/**
 * This class is used to track the time spent in arbitrary states. When told of
 * a state, it will assume that state was active until a new state is provided.
 * When provided with identical states back-to-back, the existing entry will be
 * updated.
 *
 * @final
 */
export class StateHistory {
  /**
   * The state that we think is still the current change. It is "open" for
   * updating.
   *
   */
  private open_: shaka.extern.StateChange|null = null;

  /**
   * The stats that are "closed" for updating. The "open" state becomes closed
   * once we move to a new state.
   *
   */
  private closed_: shaka.extern.StateChange[] = [];

  update(state: string) {
    // |open_| will only be |null| when we first call |update|.
    if (this.open_ == null) {
      this.start_(state);
    } else {
      this.update_(state);
    }
  }

  /**
   * Go through all entries in the history and count how much time was spend in
   * the given state.
   *
   */
  getTimeSpentIn(state: string): number {
    let sum = 0;
    if (this.open_ && this.open_.state == state) {
      sum += this.open_.duration;
    }
    for (const entry of this.closed_) {
      sum += entry.state == state ? entry.duration : 0;
    }
    return sum;
  }

  /**
   * Get a copy of each state change entry in the history. A copy of each entry
   * is created to break the reference to the internal data.
   *
   */
  getCopy(): shaka.extern.StateChange[] {
    const clone = (entry) => {
      return {
        timestamp: entry.timestamp,
        state: entry.state,
        duration: entry.duration
      };
    };
    const copy = [];
    for (const entry of this.closed_) {
      copy.push(clone(entry));
    }
    if (this.open_) {
      copy.push(clone(this.open_));
    }
    return copy;
  }

  private start_(state: string) {
    asserts.assert(
        this.open_ == null,
        'There must be no open entry in order when we start');
    log.v1('Changing Player state to', state);
    this.open_ = {
      timestamp: this.getNowInSeconds_(),
      state: state,
      duration: 0
    };
  }

  private update_(state: string) {
    asserts.assert(
        this.open_, 'There must be an open entry in order to update it');
    const currentTimeSeconds = this.getNowInSeconds_();

    // Always update the duration so that it can always be as accurate as
    // possible.
    this.open_.duration = currentTimeSeconds - this.open_.timestamp;

    // If the state has not changed, there is no need to add a new entry.
    if (this.open_.state == state) {
      return;
    }

    // We have changed states, so "close" the open state.
    log.v1('Changing Player state to', state);
    this.closed_.push(this.open_);
    this.open_ = {timestamp: currentTimeSeconds, state: state, duration: 0};
  }

  /**
   * Get the system time in seconds.
   *
   */
  private getNowInSeconds_(): number {
    return Date.now() / 1000;
  }
}
