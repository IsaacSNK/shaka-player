/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
 
/**
 * The buffering observer watches how much content has been buffered and raises
 * events when the state changes (enough => not enough or vice versa).
 *
 * @final
 */ 
export class BufferingObserver {
  private previousState_: State;
  private thresholds_: Map<State, number>;
   
  constructor(thresholdWhenStarving: number, thresholdWhenSatisfied: number) {
    const State = State;
    this.previousState_ = State.SATISFIED;
    this.thresholds_ = (new Map()).set(State.SATISFIED, thresholdWhenSatisfied).set(State.STARVING, thresholdWhenStarving);
  }
   
  setThresholds(thresholdWhenStarving: number, thresholdWhenSatisfied: number) {
    const State = State;
    this.thresholds_.set(State.SATISFIED, thresholdWhenSatisfied).set(State.STARVING, thresholdWhenStarving);
  }
   
  /**
     * Update the observer by telling it how much content has been buffered (in
     * seconds) and if we are buffered to the end of the presentation. If the
     * controller believes the state has changed, it will return |true|.
     *
     */ 
  update(bufferLead: number, bufferedToEnd: boolean): boolean {
    const State = State;
     
    /**
         * Our threshold for how much we need before we declare ourselves as
         * starving is based on whether or not we were just starving. If we
         * were just starving, we are more likely to starve again, so we require
         * more content to be buffered than if we were not just starving.
         *
         */ 
    const threshold: number = this.thresholds_.get(this.previousState_);
    const oldState = this.previousState_;
    const newState = bufferedToEnd || bufferLead >= threshold ? State.SATISFIED : State.STARVING;
     
    // Save the new state now so that calls to |getState| from any callbacks
    // will be accurate. 
    this.previousState_ = newState;
     
    // Return |true| only when the state has changed. 
    return oldState != newState;
  }
   
  /**
     * Set which state that the observer should think playback was in.
     *
     */ 
  setState(state: State) {
    this.previousState_ = state;
  }
   
  /**
     * Get the state that the observer last thought playback was in.
     *
     */ 
  getState(): State {
    return this.previousState_;
  }
}
 
/**
 * Rather than using booleans to communicate what state we are in, we have this
 * enum.
 *
 */ 
export enum State {
  STARVING,
  SATISFIED
}
