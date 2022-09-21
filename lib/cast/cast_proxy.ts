/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
goog.require('shaka.Player');
import{CastSender}from './cast_sender';
import*as CastSenderExports from './cast_sender';
import{CastUtils}from './cast_utils';
import*as CastUtilsExports from './cast_utils';
import{log}from './log';
import*as logExports from './log';
import{Error}from './error';
import*as ErrorExports from './error';
import{EventManager}from './event_manager';
import*as EventManagerExports from './event_manager';
import{FakeEvent}from './fake_event';
import*as FakeEventExports from './fake_event';
import{FakeEventTarget}from './fake_event_target';
import*as FakeEventTargetExports from './fake_event_target';
import{IDestroyable}from './i_destroyable';
 
/**
 * @event shaka.cast.CastProxy.CastStatusChangedEvent
 * @description Fired when cast status changes.  The status change will be
 *   reflected in canCast() and isCasting().
 * @property {string} type
 *   'caststatuschanged'
 * @exportDoc
 */ 
 
/**
 * @summary A proxy to switch between local and remote playback for Chromecast
 * in a way that is transparent to the app's controls.
 *
 * @export
 */ 
export class CastProxy extends FakeEventTarget implements IDestroyable {
  private localVideo_: HTMLMediaElement;
  private localPlayer_: shaka.Player;
  private videoProxy_: Object = null;
  private playerProxy_: Object = null;
  private videoEventTarget_: FakeEventTarget = null;
  private playerEventTarget_: FakeEventTarget = null;
  private eventManager_: EventManager = null;
  private receiverAppId_: string;
  private androidReceiverCompatible_: boolean;
  private compiledToExternNames_: Map;
  private sender_: CastSender;
   
  /**
     * @param video The local video element associated with
     *   the local Player instance.
     * @param player A local Player instance.
     * @param receiverAppId The ID of the cast receiver application.
     *   If blank, casting will not be available, but the proxy will still
     *   function otherwise.
     * @param androidReceiverCompatible Indicates if the app is
     *   compatible with an Android Receiver.
     */ 
  constructor(video: HTMLMediaElement, player: shaka.Player, receiverAppId: string, androidReceiverCompatible: boolean = false) {
    super();
    this.localVideo_ = video;
    this.localPlayer_ = player;
    this.receiverAppId_ = receiverAppId;
    this.androidReceiverCompatible_ = androidReceiverCompatible;
    this.compiledToExternNames_ = new Map();
    this.sender_ = new CastSender(receiverAppId,  
    () => this.onCastStatusChanged_(),  
    () => this.onFirstCastStateUpdate_(),  
    (targetName, event) => this.onRemoteEvent_(targetName, event),  
    () => this.onResumeLocal_(),  
    () => this.getInitState_(), androidReceiverCompatible);
    this.init_();
  }
   
  /**
     * Destroys the proxy and the underlying local Player.
     *
     * @param forceDisconnect If true, force the receiver app to shut
     *   down by disconnecting.  Does nothing if not connected.
     * @override
     * @export
     */ 
  destroy(forceDisconnect?: boolean) {
    if (forceDisconnect) {
      this.sender_.forceDisconnect();
    }
    if (this.eventManager_) {
      this.eventManager_.release();
      this.eventManager_ = null;
    }
    const waitFor = [];
    if (this.localPlayer_) {
      waitFor.push(this.localPlayer_.destroy());
      this.localPlayer_ = null;
    }
    if (this.sender_) {
      waitFor.push(this.sender_.destroy());
      this.sender_ = null;
    }
    this.localVideo_ = null;
    this.videoProxy_ = null;
    this.playerProxy_ = null;
     
    // FakeEventTarget implements IReleasable 
    super.release();
    return Promise.all(waitFor);
  }
   
  /**
     * Get a proxy for the video element that delegates to local and remote video
     * elements as appropriate.
     *
     * @suppress {invalidCasts} to cast proxy Objects to unrelated types
     * @export
     */ 
  getVideo(): HTMLMediaElement {
    return (this.videoProxy_ as HTMLMediaElement);
  }
   
  /**
     * Get a proxy for the Player that delegates to local and remote Player
     * objects as appropriate.
     *
     * @suppress {invalidCasts} to cast proxy Objects to unrelated types
     * @export
     */ 
  getPlayer(): shaka.Player {
    return (this.playerProxy_ as shaka.Player);
  }
   
  /**
     * @return True if the cast API is available and there are
     *   receivers.
     * @export
     */ 
  canCast(): boolean {
    return this.sender_.apiReady() && this.sender_.hasReceivers();
  }
   
  /**
     * @return True if we are currently casting.
     * @export
     */ 
  isCasting(): boolean {
    return this.sender_.isCasting();
  }
   
  /**
     * @return The name of the Cast receiver device, if isCasting().
     * @export
     */ 
  receiverName(): string {
    return this.sender_.receiverName();
  }
   
  /**
     * @return Resolved when connected to a receiver.  Rejected if the
     *   connection fails or is canceled by the user.
     * @export
     */ 
  async cast(): Promise {
    const initState = this.getInitState_();
     
    // TODO: transfer manually-selected tracks?
    // TODO: transfer side-loaded text tracks? 
    await this.sender_.cast(initState);
    if (!this.localPlayer_) {
       
      // We've already been destroyed. 
      return;
    }
     
    // Unload the local manifest when casting succeeds. 
    await this.localPlayer_.unload();
  }
   
  /**
     * Set application-specific data.
     *
     * @param appData Application-specific data to relay to the receiver.
     * @export
     */ 
  setAppData(appData: Object) {
    this.sender_.setAppData(appData);
  }
   
  /**
     * Show a dialog where user can choose to disconnect from the cast connection.
     * @export
     */ 
  suggestDisconnect() {
    this.sender_.showDisconnectDialog();
  }
   
  /**
     * Force the receiver app to shut down by disconnecting.
     * @export
     */ 
  forceDisconnect() {
    this.sender_.forceDisconnect();
  }
   
  /**
     * @export
     */ 
  async changeReceiverId(newAppId: string, newCastAndroidReceiver: boolean = false) {
    if (newAppId == this.receiverAppId_ && newCastAndroidReceiver == this.androidReceiverCompatible_) {
       
      // Nothing to change 
      return;
    }
    this.receiverAppId_ = newAppId;
    this.androidReceiverCompatible_ = newCastAndroidReceiver;
     
    // Destroy the old sender 
    this.sender_.forceDisconnect();
    await this.sender_.destroy();
    this.sender_ = null;
     
    // Create the new one 
    this.sender_ = new CastSender(newAppId,  
    () => this.onCastStatusChanged_(),  
    () => this.onFirstCastStateUpdate_(),  
    (targetName, event) => this.onRemoteEvent_(targetName, event),  
    () => this.onResumeLocal_(),  
    () => this.getInitState_(), newCastAndroidReceiver);
    this.sender_.init();
  }
   
  /**
     * Initialize the Proxies and the Cast sender.
     */ 
  private init_() {
    this.sender_.init();
    this.eventManager_ = new EventManager();
    for (const name of CastUtilsExports.VideoEvents) {
      this.eventManager_.listen(this.localVideo_, name,  
      (event) => this.videoProxyLocalEvent_(event));
    }
    for (const key in FakeEventExports.EventName) {
      const name = FakeEventExports.EventName[key];
      this.eventManager_.listen(this.localPlayer_, name,  
      (event) => this.playerProxyLocalEvent_(event));
    }
     
    // We would like to use Proxy here, but it is not supported on Safari. 
    this.videoProxy_ = {};
    for (const k in this.localVideo_) {
      Object.defineProperty(this.videoProxy_, k, {configurable:false, enumerable:true, get: 
      () => this.videoProxyGet_(k), set: 
      (value) => {
        this.videoProxySet_(k, value);
      }});
    }
    this.playerProxy_ = {};
    this.iterateOverPlayerMethods_( 
    (name, method) => {
      asserts.assert(this.playerProxy_, 'Must have player proxy!');
      Object.defineProperty(this.playerProxy_, name, {configurable:false, enumerable:true, get: 
      () => this.playerProxyGet_(name)});
    });
    if (COMPILED) {
      this.mapCompiledToUncompiledPlayerMethodNames_();
    }
    this.videoEventTarget_ = new FakeEventTarget();
    this.videoEventTarget_.dispatchTarget = (this.videoProxy_ as EventTarget);
    this.playerEventTarget_ = new FakeEventTarget();
    this.playerEventTarget_.dispatchTarget = (this.playerProxy_ as EventTarget);
  }
   
  /**
     * Maps compiled to uncompiled player names so we can figure out
     * which method to call in compiled build, while casting.
     */ 
  private mapCompiledToUncompiledPlayerMethodNames_() {
     
    // In compiled mode, UI tries to access player methods by their internal
    // renamed names, but the proxy object doesn't know about those.  See
    // https://github.com/shaka-project/shaka-player/issues/2130 for details. 
    const methodsToNames = new Map();
    this.iterateOverPlayerMethods_( 
    (name, method) => {
      if (methodsToNames.has(method)) {
         
        // If two method names, point to the same method, add them to the
        // map as aliases of each other. 
        const name2 = methodsToNames.get(method);
         
        // Assumes that the compiled name is shorter 
        if (name.length < name2.length) {
          this.compiledToExternNames_.set(name, name2);
        } else {
          this.compiledToExternNames_.set(name2, name);
        }
      } else {
        methodsToNames.set(method, name);
      }
    });
  }
   
  /**
     * Iterates over all of the methods of the player, including inherited methods
     * from FakeEventTarget.
     */ 
  private iterateOverPlayerMethods_(operation: (p1: string, p2: () => any) => any) {
    asserts.assert(this.localPlayer_, 'Must have player!');
    const player = (this.localPlayer_ as Object);
     
    // Avoid accessing any over-written methods in the prototype chain. 
    const seenNames = new Set();
     
    function shouldAddToTheMap(name: string): boolean {
      if (name == 'constructor') {
         
        // Don't proxy the constructor. 
        return false;
      }
      const method = (player as Object)[name];
      if (typeof method != 'function') {
         
        // Don't proxy non-methods. 
        return false;
      }
       
      // Add if the map does not already have it 
      return !seenNames.has(name);
    }
     
    // First, look at the methods on the object itself, so this can properly
    // proxy any methods not on the prototype (for example, in the mock player). 
    for (const key in player) {
      if (shouldAddToTheMap(key)) {
        seenNames.add(key);
        operation(key, player[key]);
      }
    }
     
    // The exact length of the prototype chain might vary; for resiliency, this
    // will just look at the entire chain, rather than assuming a set length. 
    let proto = (Object.getPrototypeOf(player) as Object);
    const objProto = (Object.getPrototypeOf({}) as Object);
    while (proto && proto != objProto) {
       
      // Don't proxy Object methods. 
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (shouldAddToTheMap(name)) {
          seenNames.add(name);
          operation(name, player[name]);
        }
      }
      proto = (Object.getPrototypeOf(proto) as Object);
    }
  }
   
  /**
     * @return initState Video and player
     *   state to be sent to the receiver.
     */ 
  private getInitState_(): CastUtilsExports.InitStateType {
    const initState = {'video':{}, 'player':{}, 'playerAfterLoad':{}, 'manifest':this.localPlayer_.getAssetUri(), 'startTime':null};
     
    // Pause local playback before capturing state. 
    this.localVideo_.pause();
    for (const name of CastUtilsExports.VideoInitStateAttributes) {
      initState['video'][name] = this.localVideo_[name];
    }
     
    // If the video is still playing, set the startTime.
    // Has no effect if nothing is loaded. 
    if (!this.localVideo_.ended) {
      initState['startTime'] = this.localVideo_.currentTime;
    }
    for (const pair of CastUtilsExports.PlayerInitState) {
      const getter = pair[0];
      const setter = pair[1];
      const value = (this.localPlayer_ as Object)[getter]();
      initState['player'][setter] = value;
    }
    for (const pair of CastUtilsExports.PlayerInitAfterLoadState) {
      const getter = pair[0];
      const setter = pair[1];
      const value = (this.localPlayer_ as Object)[getter]();
      initState['playerAfterLoad'][setter] = value;
    }
    return initState;
  }
   
  /**
     * Dispatch an event to notify the app that the status has changed.
     */ 
  private onCastStatusChanged_() {
    const event = new FakeEvent('caststatuschanged');
    this.dispatchEvent(event);
  }
   
  /**
     * Dispatch a synthetic play or pause event to ensure that the app correctly
     * knows that the player is playing, if joining an existing receiver.
     */ 
  private onFirstCastStateUpdate_() {
    const type = this.videoProxy_['paused'] ? 'pause' : 'play';
    const fakeEvent = new FakeEvent(type);
    this.videoEventTarget_.dispatchEvent(fakeEvent);
  }
   
  /**
     * Transfer remote state back and resume local playback.
     */ 
  private onResumeLocal_() {
     
    // Transfer back the player state. 
    for (const pair of CastUtilsExports.PlayerInitState) {
      const getter = pair[0];
      const setter = pair[1];
      const value = this.sender_.get('player', getter)();
      (this.localPlayer_ as Object)[setter](value);
    }
     
    // Get the most recent manifest URI and ended state. 
    const assetUri = this.sender_.get('player', 'getAssetUri')();
    const ended = this.sender_.get('video', 'ended');
    let manifestReady = Promise.resolve();
    const autoplay = this.localVideo_.autoplay;
    let startTime = null;
     
    // If the video is still playing, set the startTime.
    // Has no effect if nothing is loaded. 
    if (!ended) {
      startTime = this.sender_.get('video', 'currentTime');
    }
     
    // Now load the manifest, if present. 
    if (assetUri) {
       
      // Don't autoplay the content until we finish setting up initial state. 
      this.localVideo_.autoplay = false;
      manifestReady = this.localPlayer_.load(assetUri, startTime);
    }
     
    // Get the video state into a temp variable since we will apply it async. 
    const videoState = {};
    for (const name of CastUtilsExports.VideoInitStateAttributes) {
      videoState[name] = this.sender_.get('video', name);
    }
     
    // Finally, take on video state and player's "after load" state. 
    manifestReady.then( 
    () => {
      if (!this.localVideo_) {
         
        // We've already been destroyed. 
        return;
      }
      for (const name of CastUtilsExports.VideoInitStateAttributes) {
        this.localVideo_[name] = videoState[name];
      }
      for (const pair of CastUtilsExports.PlayerInitAfterLoadState) {
        const getter = pair[0];
        const setter = pair[1];
        const value = this.sender_.get('player', getter)();
        (this.localPlayer_ as Object)[setter](value);
      }
       
      // Restore the original autoplay setting. 
      this.localVideo_.autoplay = autoplay;
      if (assetUri) {
         
        // Resume playback with transferred state. 
        this.localVideo_.play();
      }
    },  
    (error) => {
       
      // Pass any errors through to the app. 
      asserts.assert(error instanceof Error, 'Wrong error type!');
      const eventType = FakeEventExports.EventName.Error;
      const data = (new Map()).set('detail', error);
      const event = new FakeEvent(eventType, data);
      this.localPlayer_.dispatchEvent(event);
    });
  }
   
  private videoProxyGet_(name: string): any {
    if (name == 'addEventListener') {
      return  
      (type, listener, options) => {
        return this.videoEventTarget_.addEventListener(type, listener, options);
      };
    }
    if (name == 'removeEventListener') {
      return  
      (type, listener, options) => {
        return this.videoEventTarget_.removeEventListener(type, listener, options);
      };
    }
     
    // If we are casting, but the first update has not come in yet, use local
    // values, but not local methods. 
    if (this.sender_.isCasting() && !this.sender_.hasRemoteProperties()) {
      const value = this.localVideo_[name];
      if (typeof value != 'function') {
        return value;
      }
    }
     
    // Use local values and methods if we are not casting. 
    if (!this.sender_.isCasting()) {
      let value = this.localVideo_[name];
      if (typeof value == 'function') {
         
        // eslint-disable-next-line no-restricted-syntax 
        value = value.bind(this.localVideo_);
      }
      return value;
    }
    return this.sender_.get('video', name);
  }
   
  private videoProxySet_(name: string, value: any) {
    if (!this.sender_.isCasting()) {
      this.localVideo_[name] = value;
      return;
    }
    this.sender_.set('video', name, value);
  }
   
  private videoProxyLocalEvent_(event: Event) {
    if (this.sender_.isCasting()) {
       
      // Ignore any unexpected local events while casting.  Events can still be
      // fired by the local video and Player when we unload() after the Cast
      // connection is complete. 
      return;
    }
     
    // Convert this real Event into a FakeEvent for dispatch from our
    // FakeEventListener. 
    const fakeEvent = FakeEvent.fromRealEvent(event);
    this.videoEventTarget_.dispatchEvent(fakeEvent);
  }
   
  private playerProxyGet_(name: string): any {
     
    // If name is a shortened compiled name, get the original version
    // from our map. 
    if (this.compiledToExternNames_.has(name)) {
      name = this.compiledToExternNames_.get(name);
    }
    if (name == 'addEventListener') {
      return  
      (type, listener, options) => {
        return this.playerEventTarget_.addEventListener(type, listener, options);
      };
    }
    if (name == 'removeEventListener') {
      return  
      (type, listener, options) => {
        return this.playerEventTarget_.removeEventListener(type, listener, options);
      };
    }
    if (name == 'getMediaElement') {
      return  
      () => this.videoProxy_;
    }
    if (name == 'getSharedConfiguration') {
      log.warning("Can't share configuration across a network. Returning copy.");
      return this.sender_.get('player', 'getConfiguration');
    }
    if (name == 'getNetworkingEngine') {
       
      // Always returns a local instance, in case you need to make a request.
      // Issues a warning, in case you think you are making a remote request
      // or affecting remote filters. 
      if (this.sender_.isCasting()) {
        log.warning('NOTE: getNetworkingEngine() is always local!');
      }
      return  
      () => this.localPlayer_.getNetworkingEngine();
    }
    if (name == 'getDrmEngine') {
       
      // Always returns a local instance. 
      if (this.sender_.isCasting()) {
        log.warning('NOTE: getDrmEngine() is always local!');
      }
      return  
      () => this.localPlayer_.getDrmEngine();
    }
    if (name == 'getAdManager') {
       
      // Always returns a local instance. 
      if (this.sender_.isCasting()) {
        log.warning('NOTE: getAdManager() is always local!');
      }
      return  
      () => this.localPlayer_.getAdManager();
    }
    if (name == 'setVideoContainer') {
       
      // Always returns a local instance. 
      if (this.sender_.isCasting()) {
        log.warning('NOTE: setVideoContainer() is always local!');
      }
      return  
      (container) => this.localPlayer_.setVideoContainer(container);
    }
    if (this.sender_.isCasting()) {
       
      // These methods are unavailable or otherwise stubbed during casting. 
      if (name == 'getManifest' || name == 'drmInfo') {
        return  
        () => {
          log.alwaysWarn(name + '() does not work while casting!');
          return null;
        };
      }
      if (name == 'attach' || name == 'detach') {
        return  
        () => {
          log.alwaysWarn(name + '() does not work while casting!');
          return Promise.resolve();
        };
      }
    }
     
    // if (this.sender_.isCasting()) 
     
    // If we are casting, but the first update has not come in yet, use local
    // getters, but not local methods. 
    if (this.sender_.isCasting() && !this.sender_.hasRemoteProperties()) {
      if (CastUtilsExports.PlayerGetterMethods[name]) {
        const value = (this.localPlayer_ as Object)[name];
        asserts.assert(typeof value == 'function', 'only methods on Player');
         
        // eslint-disable-next-line no-restricted-syntax 
        return value.bind(this.localPlayer_);
      }
    }
     
    // Use local getters and methods if we are not casting. 
    if (!this.sender_.isCasting()) {
      const value = (this.localPlayer_ as Object)[name];
      asserts.assert(typeof value == 'function', 'only methods on Player');
       
      // eslint-disable-next-line no-restricted-syntax 
      return value.bind(this.localPlayer_);
    }
    return this.sender_.get('player', name);
  }
   
  private playerProxyLocalEvent_(event: Event) {
    if (this.sender_.isCasting()) {
       
      // Ignore any unexpected local events while casting. 
      return;
    }
    this.playerEventTarget_.dispatchEvent(event);
  }
   
  private onRemoteEvent_(targetName: string, event: FakeEvent) {
    asserts.assert(this.sender_.isCasting(), 'Should only receive remote events while casting');
    if (!this.sender_.isCasting()) {
       
      // Ignore any unexpected remote events. 
      return;
    }
    if (targetName == 'video') {
      this.videoEventTarget_.dispatchEvent(event);
    } else {
      if (targetName == 'player') {
        this.playerEventTarget_.dispatchEvent(event);
      }
    }
  }
}
