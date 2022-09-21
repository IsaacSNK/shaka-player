/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{Node}from './node';
import{Payload}from './payload';
import{Destroyer}from './destroyer';
import{Error}from './error';
import*as ErrorExports from './error';
import{IDestroyable}from './i_destroyable';
import{PublicPromise}from './public_promise';
import{AbortableOperation}from './abortable_operation';
 
/**
 * The walker moves through a graph node-by-node executing asynchronous work
 * as it enters each node.
 *
 * The walker accepts requests for where it should go next. Requests are queued
 * and executed in FIFO order. If the current request can be interrupted, it
 * will be cancelled and the next request started.
 *
 * A request says "I want to change where we are going". When the walker is
 * ready to change destinations, it will resolve the request, allowing the
 * destination to differ based on the current state and not the state when
 * the request was appended.
 *
 * Example (from shaka.Player):
 *  When we unload, we need to either go to the attached or detached state based
 *  on whether or not we have a video element.
 *
 *  When we are asked to unload, we don't know what other pending requests may
 *  be ahead of us (there could be attach requests or detach requests). We need
 *  to wait until its our turn to know if:
 *    - we should go to the attach state because we have a media element
 *    - we should go to the detach state because we don't have a media element
 *
 * The walker allows the caller to specify if a route can or cannot be
 * interrupted. This is to allow potentially dependent routes to wait until
 * other routes have finished.
 *
 * Example (from shaka.Player):
 *  A request to load content depends on an attach request finishing. We don't
 *  want load request to interrupt an attach request. By marking the attach
 *  request as non-interruptible we ensure that calling load before attach
 *  finishes will work.
 *
 * @final
 */ 
export class Walker implements IDestroyable {
  private implementation_: Implementation | null;
  private currentlyAt_: Node;
  private currentlyWith_: Payload;
   
  /**
       * When we run out of work to do, we will set this promise so that when
       * new work is added (and this is not null) it can be resolved. The only
       * time when this should be non-null is when we are waiting for more work.
       *
       */ 
  private waitForWork_: PublicPromise | null = null;
  private requests_: Request_[] = [];
  private currentRoute_: ActiveRoute_ | null = null;
  private currentStep_: AbortableOperation | null = null;
   
  /**
       * Hold a reference to the main loop's promise so that we know when it has
       * exited. This will determine when |destroy| can resolve. Purposely make
       * the main loop start next interpreter cycle so that the constructor will
       * finish before it starts.
       *
       */ 
  private mainLoopPromise_: Promise;
  private destroyer_: Destroyer;
   
  /**
     * Create a new walker that starts at |startingAt| and with |startingWith|.
     * The instance of |startingWith| will be the one that the walker holds and
     * uses for its life. No one else should reference it.
     *
     * The per-instance behaviour for the walker is provided via |implementation|
     * which is used to connect this walker with the "outside world".
     *
     */ 
  constructor(startingAt: Node, startingWith: Payload, implementation: Implementation) {
    this.implementation_ = implementation;
    this.currentlyAt_ = startingAt;
    this.currentlyWith_ = startingWith;
    this.mainLoopPromise_ = Promise.resolve().then( 
    () => this.mainLoop_());
    this.destroyer_ = new Destroyer( 
    () => this.doDestroy_());
  }
   
  /**
     * Get the current routing payload.
     *
     */ 
  getCurrentPayload(): Payload {
    return this.currentlyWith_;
  }
   
  /** @override */ 
  destroy() {
    return this.destroyer_.destroy();
  }
   
  private async doDestroy_() {
     
    // If we are executing a current step, we want to interrupt it so that we
    // can force the main loop to terminate. 
    if (this.currentStep_) {
      this.currentStep_.abort();
    }
     
    // If we are waiting for more work, we want to wake-up the main loop so that
    // it can exit on its own. 
    this.unblockMainLoop_();
     
    // Wait for the main loop to terminate so that an async operation won't
    // try and use state that we released. 
    await this.mainLoopPromise_;
     
    // Any routes that we are not going to finish, we need to cancel. If we
    // don't do this, those listening will be left hanging. 
    if (this.currentRoute_) {
      this.currentRoute_.listeners.onCancel();
    }
    for (const request of this.requests_) {
      request.listeners.onCancel();
    }
     
    // Release anything that could hold references to anything outside of this
    // class. 
    this.currentRoute_ = null;
    this.requests_ = [];
    this.implementation_ = null;
  }
   
  /**
     * Ask the walker to start a new route. When the walker is ready to start a
     * new route, it will call |create| and |create| will provide the walker with
     * a new route to execute.
     *
     * If any previous calls to |startNewRoute| created non-interruptible routes,
     * |create| won't be called until all previous non-interruptible routes have
     * finished.
     *
     * This method will return a collection of listeners that the caller can hook
     * into. Any listener that the caller is interested should be assigned
     * immediately after calling |startNewRoute| or else they could miss the event
     * they want to listen for.
     *
     */ 
  startNewRoute(create: (p1: Payload) => Route | null): Listeners {
    const listeners = {onStart: 
    () => {
    }, onEnd: 
    () => {
    }, onCancel: 
    () => {
    }, onError: 
    (error) => {
    }, onSkip: 
    () => {
    }, onEnter: 
    () => {
    }};
    this.requests_.push({create:create, listeners:listeners});
     
    // If we are in the middle of a step, try to abort it. If this is successful
    // the main loop will error and the walker will enter recovery mode. 
    if (this.currentStep_) {
      this.currentStep_.abort();
    }
     
    // Tell the main loop that new work is available. If the main loop was not
    // blocked, this will be a no-op. 
    this.unblockMainLoop_();
    return listeners;
  }
   
  private async mainLoop_(): Promise {
    while (!this.destroyer_.destroyed()) {
       
      // eslint-disable-next-line no-await-in-loop 
      await this.doOneThing_();
    }
  }
   
  /**
     * Do one thing to move the walker closer to its destination. This can be:
     *   1. Starting a new route.
     *   2. Taking one more step/finishing a route.
     *   3. Wait for a new route.
     *
     */ 
  private doOneThing_(): Promise {
    if (this.tryNewRoute_()) {
      return Promise.resolve();
    }
    if (this.currentRoute_) {
      return this.takeNextStep_();
    }
    asserts.assert(this.waitForWork_ == null, 'We should not have a promise yet.');
     
    // We have no more work to do. We will wait until new work has been provided
    // via request route or until we are destroyed. 
    this.implementation_.onIdle(this.currentlyAt_);
     
    // Wait on a new promise so that we can be resolved by |waitForWork|. This
    // avoids us acting like a busy-wait. 
    this.waitForWork_ = new PublicPromise();
    return this.waitForWork_;
  }
   
  /**
     * Check if the walker can start a new route. There are a couple ways this can
     * happen:
     *  1. We have a new request but no current route
     *  2. We have a new request and our current route can be interrupted
     *
     *    |true| when a new route was started (regardless of reason) and |false|
     *    when no new route was started.
     *
     */ 
  private tryNewRoute_(): boolean {
    asserts.assert(this.currentStep_ == null, 'We should never have a current step between taking steps.');
    if (this.requests_.length == 0) {
      return false;
    }
     
    // If the current route cannot be interrupted, we can't start a new route. 
    if (this.currentRoute_ && !this.currentRoute_.interruptible) {
      return false;
    }
     
    // Stop any previously active routes. Even if we don't pick-up a new route,
    // this route should stop. 
    if (this.currentRoute_) {
      this.currentRoute_.listeners.onCancel();
      this.currentRoute_ = null;
    }
     
    // Create and start the next route. We may not take any steps because it may
    // be interrupted by the next request. 
    const request = this.requests_.shift();
    const newRoute = request.create(this.currentlyWith_);
     
    // Based on the current state of |payload|, a new route may not be
    // possible. In these cases |create| will return |null| to signal that
    // we should just stop the current route and move onto the next request
    // (in the next main loop iteration). 
    if (newRoute) {
      request.listeners.onStart();
       
      // Convert the route created from the request's create method to an
      // active route. 
      this.currentRoute_ = {node:newRoute.node, payload:newRoute.payload, interruptible:newRoute.interruptible, listeners:request.listeners};
    } else {
      request.listeners.onSkip();
    }
    return true;
  }
   
  /**
     * Move forward one step on our current route. This assumes that we have a
     * current route. A couple things can happen when moving forward:
     *  1. An error - if an error occurs, it will signal an error occurred,
     *     attempt to recover, and drop the route.
     *  2. Move - if no error occurs, we will move forward. When we arrive at
     *     our destination, it will signal the end and drop the route.
     *
     * In the event of an error or arriving at the destination, we drop the
     * current route. This allows us to pick-up a new route next time the main
     * loop iterates.
     *
     */ 
  private async takeNextStep_(): Promise {
    asserts.assert(this.currentRoute_, 'We need a current route to take the next step.');
     
    // Figure out where we are supposed to go next. 
    this.currentlyAt_ = this.implementation_.getNext(this.currentlyAt_, this.currentlyWith_, this.currentRoute_.node, this.currentRoute_.payload);
    this.currentRoute_.listeners.onEnter(this.currentlyAt_);
     
    // Enter the new node, this is where things can go wrong since it is
    // possible for "supported errors" to occur - errors that the code using
    // the walker can't predict but can recover from. 
    try {
       
      // TODO: This is probably a false-positive.  See eslint/eslint#11687.
      // eslint-disable-next-line require-atomic-updates 
      this.currentStep_ = this.implementation_.enterNode( 
      /* node= */ 
      this.currentlyAt_, this.currentlyWith_,  
      /* has= */
      /* wants= */ 
      this.currentRoute_.payload);
      await this.currentStep_.promise;
      this.currentStep_ = null;
       
      // If we are at the end of the route, we need to signal it and clear the
      // route so that we will pick-up a new route next iteration. 
      if (this.currentlyAt_ == this.currentRoute_.node) {
        this.currentRoute_.listeners.onEnd();
        this.currentRoute_ = null;
      }
    } catch (error) {
      if (error.code == ErrorExports.Code.OPERATION_ABORTED) {
        asserts.assert(this.currentRoute_.interruptible, 'Do not put abortable steps in non-interruptible routes!');
        this.currentRoute_.listeners.onCancel();
      } else {
         
        // There was an error with this route, so we going to abandon it and
        // resolve the error. We don't reset the payload because the payload may
        // still contain useful information. 
        this.currentRoute_.listeners.onError(error);
      }
       
      // The route and step are done. Clear them before we handle the error or
      // else we may attempt to abort |currentStep_| when handling the error. 
      this.currentRoute_ = null;
      this.currentStep_ = null;
       
      // Still need to handle error because aborting an operation could leave us
      // in an unexpected state. 
      this.currentlyAt_ = await this.implementation_.handleError(this.currentlyWith_, error);
    }
  }
   
  /**
     * If the main loop is blocked waiting for new work, then resolve the promise
     * so that the next iteration of the main loop can execute.
     *
     */ 
  private unblockMainLoop_() {
    if (this.waitForWork_) {
      this.waitForWork_.resolve();
      this.waitForWork_ = null;
    }
  }
}
type Implementation = {getNext:(p1: Node, p2: Payload, p3: Node, p4: Payload) => Node, enterNode:(p1: Node, p2: Payload, p3: Payload) => AbortableOperation, handleError:(p1: Payload, p2: Error) => Promise<Node>, onIdle:(p1: Node) => any};
 
export{Implementation};
type Listeners = {onStart:() => any, onEnd:() => any, onCancel:() => any, onError:(p1: Error) => any, onSkip:() => any, onEnter:(p1: Node) => any};
 
export{Listeners};
type Route = {node:Node, payload:Payload, interruptible:boolean};
 
export{Route};
type ActiveRoute_ = {node:Node, payload:Payload, interruptible:boolean, listeners:Listeners};
 
export{ActiveRoute_};
type Request_ = {create:(p1: Payload) => Route | null, listeners:Listeners};
 
export{Request_};
