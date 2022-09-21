/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{log}from './log';
import*as logExports from './log';
import{IReleasable}from './i_releasable';
import{Timer}from './timer';
 
/**
 * The play rate controller controls the playback rate on the media element.
 * This provides some missing functionality (e.g. negative playback rate). If
 * the playback rate on the media element can change outside of the controller,
 * the playback controller will need to be updated to stay in-sync.
 *
 * TODO: Try not to manage buffering above the browser with playbackRate=0.
 *
 * @final
 */ 
export class PlayRateController implements IReleasable {
  private harness_: Harness | null;
  private isBuffering_: boolean = false;
  private rate_: number;
  private pollRate_: number = 0.25;
  private timer_: Timer;
   
  constructor(harness: Harness) {
    this.harness_ = harness;
    this.rate_ = this.harness_.getRate();
    this.timer_ = new Timer( 
    () => {
      this.harness_.movePlayhead(this.rate_ * this.pollRate_);
    });
  }
   
  /** @override */ 
  release() {
    if (this.timer_) {
      this.timer_.stop();
      this.timer_ = null;
    }
    this.harness_ = null;
  }
   
  /**
     * Sets the buffering flag, which controls the effective playback rate.
     *
     * @param isBuffering If true, forces playback rate to 0 internally.
     */ 
  setBuffering(isBuffering: boolean) {
    this.isBuffering_ = isBuffering;
    this.apply_();
  }
   
  /**
     * Set the playback rate. This rate will only be used as provided when the
     * player is not buffering. You should never set the rate to 0.
     *
     */ 
  set(rate: number) {
    asserts.assert(rate != 0, 'Should never set rate of 0 explicitly!');
    this.rate_ = rate;
    this.apply_();
  }
   
  /**
     * Get the real rate of the playback. This means that if we are using trick
     * play, this will report the trick play rate. If playback is occurring as
     * normal, this will report 1.
     *
     */ 
  getRealRate(): number {
    return this.rate_;
  }
   
  /**
     * Get the default play rate of the playback.
     *
     */ 
  getDefaultRate(): number {
    return this.harness_.getDefaultRate();
  }
   
  /**
     * Reapply the effects of |this.rate_| and |this.active_| to the media
     * element. This will only update the rate via the harness if the desired rate
     * has changed.
     *
     */ 
  private apply_() {
     
    // Always stop the timer. We may not start it again. 
    this.timer_.stop();
    const rate: number = this.calculateCurrentRate_();
    log.v1('Changing effective playback rate to', rate);
    if (rate >= 0) {
      try {
        this.applyRate_(rate);
        return;
      } catch (e) {
      }
    }
     
    // Fall through to the next clause.
    // Fast forward is accomplished through setting video.playbackRate.
    // If the play rate value is not supported by the browser (too big),
    // the browsers will throw.
    // Use this as a cue to fall back to fast forward through repeated
    // seeking, which is what we do for rewind as well. 
     
    // When moving backwards or forwards in large steps,
    // set the playback rate to 0 so that we can manually
    // seek backwards with out fighting the playhead. 
    this.timer_.tickEvery(this.pollRate_);
    this.applyRate_(0);
  }
   
  /**
     * Calculate the rate that the controller wants the media element to have
     * based on the current state of the controller.
     *
     */ 
  private calculateCurrentRate_(): number {
    return this.isBuffering_ ? 0 : this.rate_;
  }
   
  /**
     * If the new rate is different than the media element's playback rate, this
     * will change the playback rate. If the rate does not need to change, it will
     * not be set. This will avoid unnecessary ratechange events.
     *
     */ 
  private applyRate_(newRate: number): boolean {
    const oldRate = this.harness_.getRate();
    if (oldRate != newRate) {
      this.harness_.setRate(newRate);
    }
    return oldRate != newRate;
  }
}
type Harness = {getRate:() => number, getDefaultRate:() => number, setRate:(p1: number) => any, movePlayhead:(p1: number) => any};
 
export{Harness};
