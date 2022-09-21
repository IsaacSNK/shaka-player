/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{CastUtils}from './cast_utils';
import*as CastUtilsExports from './cast_utils';
import{log}from './log';
import*as logExports from './log';
import{Error}from './error';
import*as ErrorExports from './error';
import{FakeEvent}from './fake_event';
import*as FakeEventExports from './fake_event';
import{IDestroyable}from './i_destroyable';
import{PublicPromise}from './public_promise';
import{Timer}from './timer';
 
export 
class CastSender implements IDestroyable {
  private receiverAppId_: string;
  private androidReceiverCompatible_: boolean;
  private statusChangeTimer_: Timer;
  private onFirstCastStateUpdate_: (() => any) | null;
  private hasJoinedExistingSession_: boolean = false;
  private onRemoteEvent_: ((p1: string, p2: FakeEvent) => any) | null;
  private onResumeLocal_: (() => any) | null;
  private onInitStateRequired_: (() => any) | null;
  private apiReady_: boolean = false;
  private isCasting_: boolean = false;
  private receiverName_: string = '';
  private appData_: Object = null;
  private onConnectionStatusChangedBound_: (() => any) | null;
  private onMessageReceivedBound_: ((p1: string, p2: string) => any) | null;
  private cachedProperties_: Object = {'video':{}, 'player':{}};
  private nextAsyncCallId_: number = 0;
  private asyncCallPromises_: {[key:string]:PublicPromise} = {};
  private castPromise_: PublicPromise = null;
   
  /**
     * @param receiverAppId The ID of the cast receiver application.
     * @param onStatusChanged A callback invoked when the cast status
     *   changes.
     * @param onFirstCastStateUpdate A callback invoked when an
     *   "update" event has been received for the first time.
     * @param onRemoteEvent A callback
     *   invoked with target name and event when a remote event is received.
     * @param onResumeLocal A callback invoked when the local player
     *   should resume playback.  Called before the cached remote state is wiped.
     * @param onInitStateRequired A callback to get local player's.
     *   state.  Invoked when casting is initiated from Chrome's cast button.
     * @param androidReceiverCompatible Indicates if the app is
     *   compatible with an Android Receiver.
     */ 
  constructor(receiverAppId: string, onStatusChanged: () => any, onFirstCastStateUpdate: () => any, onRemoteEvent: (p1: string, p2: FakeEvent) => any, onResumeLocal: () => any, onInitStateRequired: () => any, androidReceiverCompatible: boolean) {
    this.receiverAppId_ = receiverAppId;
    this.androidReceiverCompatible_ = androidReceiverCompatible;
    this.statusChangeTimer_ = new Timer(onStatusChanged);
    this.onFirstCastStateUpdate_ = onFirstCastStateUpdate;
    this.onRemoteEvent_ = onRemoteEvent;
    this.onResumeLocal_ = onResumeLocal;
    this.onInitStateRequired_ = onInitStateRequired;
    this.onConnectionStatusChangedBound_ =  
    () => this.onConnectionStatusChanged_();
    this.onMessageReceivedBound_ =  
    (namespace, serialized) => this.onMessageReceived_(namespace, serialized);
    instances_.add(this);
  }
   
  /** @override */ 
  destroy() {
    instances_.delete(this);
    this.rejectAllPromises_();
    if (session_) {
      this.removeListeners_();
    }
     
    // Don't leave the session, so that this session can be re-used later if
    // necessary. 
    if (this.statusChangeTimer_) {
      this.statusChangeTimer_.stop();
      this.statusChangeTimer_ = null;
    }
    this.onRemoteEvent_ = null;
    this.onResumeLocal_ = null;
    this.apiReady_ = false;
    this.isCasting_ = false;
    this.appData_ = null;
    this.cachedProperties_ = null;
    this.asyncCallPromises_ = null;
    this.castPromise_ = null;
    this.onConnectionStatusChangedBound_ = null;
    this.onMessageReceivedBound_ = null;
    return Promise.resolve();
  }
   
  /**
     * @return True if the cast API is available.
     */ 
  apiReady(): boolean {
    return this.apiReady_;
  }
   
  /**
     * @return True if there are receivers.
     */ 
  hasReceivers(): boolean {
    return hasReceivers_;
  }
   
  /**
     * @return True if we are currently casting.
     */ 
  isCasting(): boolean {
    return this.isCasting_;
  }
   
  /**
     * @return The name of the Cast receiver device, if isCasting().
     */ 
  receiverName(): string {
    return this.receiverName_;
  }
   
  /**
     * @return True if we have a cache of remote properties from the
     *   receiver.
     */ 
  hasRemoteProperties(): boolean {
    return Object.keys(this.cachedProperties_['video']).length != 0;
  }
   
  /** Initialize the Cast API. */ 
  init() {
    const CastSender = CastSender;
    if (!this.receiverAppId_.length) {
       
      // Return if no cast receiver id has been provided.
      // Nothing will be initialized, no global hooks will be installed.
      // If the receiver ID changes before this instance dies, init will be
      // called again. 
      return;
    }
     
    // Check for the cast API. 
    if (!window.chrome || !chrome.cast || !chrome.cast.isAvailable) {
       
      // If the API is not available on this platform or is not ready yet,
      // install a hook to be notified when it becomes available.
      // If the API becomes available before this instance dies, init will be
      // called again. 
       
      // A note about this value: In our testing environment, we load both
      // uncompiled and compiled code.  This global callback in uncompiled mode
      // can be overwritten by the same in compiled mode.  The two versions will
      // each have their own instances_ map.  Therefore the callback must have a
      // name, as opposed to being anonymous.  This way, the CastSender tests
      // can invoke the named static method instead of using a global that could
      // be overwritten. 
      if (!window.__onGCastApiAvailable) {
        window.__onGCastApiAvailable = onSdkLoaded_;
      }
      if (window.__onGCastApiAvailable != onSdkLoaded_) {
        log.alwaysWarn('A global Cast SDK hook is already installed! ' + 'Shaka Player will be unable to receive a notification when the ' + 'Cast SDK is ready.');
      }
      return;
    }
     
    // The API is now available. 
    this.apiReady_ = true;
    this.statusChangeTimer_.tickNow();
     
    // Use static versions of the API callbacks, since the ChromeCast API is
    // static. If we used local versions, we might end up retaining references
    // to destroyed players here. 
    const sessionRequest = new chrome.cast.SessionRequest(this.receiverAppId_,  
    /* capabilities= */ 
    [],  
    /* timeout= */ 
    null, this.androidReceiverCompatible_, null);
     
    /* credentialsData= */ 
    const apiConfig = new chrome.cast.ApiConfig(sessionRequest,  
    (session) => CastSender.onExistingSessionJoined_(session),  
    (availability) => CastSender.onReceiverStatusChanged_(availability), 'origin_scoped');
     
    // TODO: Have never seen this fail.  When would it and how should we react? 
    chrome.cast.initialize(apiConfig,  
    () => {
      log.debug('CastSender: init');
    },  
    (error) => {
      log.error('CastSender: init error', error);
    });
    if (hasReceivers_) {
       
      // Fire a fake cast status change, to simulate the update that
      // would be fired normally.
      // This is after a brief delay, to give users a chance to add event
      // listeners. 
      this.statusChangeTimer_.tickAfter(STATUS_DELAY);
    }
    const oldSession = session_;
    if (oldSession && oldSession.status != chrome.cast.SessionStatus.STOPPED) {
       
      // The old session still exists, so re-use it. 
      log.debug('CastSender: re-using existing connection');
      this.onExistingSessionJoined_(oldSession);
    } else {
       
      // The session has been canceled in the meantime, so ignore it. 
      session_ = null;
    }
  }
   
  /**
     * Set application-specific data.
     *
     * @param appData Application-specific data to relay to the receiver.
     */ 
  setAppData(appData: Object) {
    this.appData_ = appData;
    if (this.isCasting_) {
      this.sendMessage_({'type':'appData', 'appData':this.appData_});
    }
  }
   
  /**
     * @param initState Video and player
     *   state to be sent to the receiver.
     * @return Resolved when connected to a receiver.  Rejected if the
     *   connection fails or is canceled by the user.
     */ 
  async cast(initState: CastUtilsExports.InitStateType): Promise {
    if (!this.apiReady_) {
      throw new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.CAST, ErrorExports.Code.CAST_API_UNAVAILABLE);
    }
    if (!hasReceivers_) {
      throw new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.CAST, ErrorExports.Code.NO_CAST_RECEIVERS);
    }
    if (this.isCasting_) {
      throw new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.CAST, ErrorExports.Code.ALREADY_CASTING);
    }
    this.castPromise_ = new PublicPromise();
    chrome.cast.requestSession( 
    (session) => this.onSessionInitiated_(initState, session),  
    (error) => this.onConnectionError_(error));
    await this.castPromise_;
  }
   
  /**
     * Shows user a cast dialog where they can choose to stop
     * casting.  Relies on Chrome to perform disconnect if they do.
     * Doesn't do anything if not connected.
     */ 
  showDisconnectDialog() {
    if (!this.isCasting_) {
      return;
    }
    const initState = this.onInitStateRequired_();
    chrome.cast.requestSession( 
    (session) => this.onSessionInitiated_(initState, session),  
    (error) => this.onConnectionError_(error));
  }
   
  /**
     * Forces the receiver app to shut down by disconnecting.  Does nothing if not
     * connected.
     */ 
  forceDisconnect() {
    if (!this.isCasting_) {
      return;
    }
    this.rejectAllPromises_();
    if (session_) {
      this.removeListeners_();
       
      // This can throw if we've already been disconnected somehow. 
      try {
        session_.stop( 
        () => {
        },  
        () => {
        });
      } catch (error) {
      }
      session_ = null;
    }
     
    // Update casting status. 
    this.onConnectionStatusChanged_();
  }
   
  /**
     * Getter for properties of remote objects.
     */ 
  get(targetName: string, property: string): any {
    asserts.assert(targetName == 'video' || targetName == 'player', 'Unexpected target name');
    const CastUtils = CastUtils;
    if (targetName == 'video') {
      if (CastUtils.VideoVoidMethods.includes(property)) {
        return  
        (...args) => this.remoteCall_(targetName, property, ...args);
      }
    } else {
      if (targetName == 'player') {
        if (CastUtils.PlayerGetterMethodsThatRequireLive[property]) {
          const isLive = this.get('player', 'isLive')();
          asserts.assert(isLive, property + ' should be called on a live stream!');
           
          // If the property shouldn't exist, return a fake function so that the
          // user doesn't call an undefined function and get a second error. 
          if (!isLive) {
            return  
            () => undefined;
          }
        }
        if (CastUtils.PlayerVoidMethods.includes(property)) {
          return  
          (...args) => this.remoteCall_(targetName, property, ...args);
        }
        if (CastUtils.PlayerPromiseMethods.includes(property)) {
          return  
          (...args) => this.remoteAsyncCall_(targetName, property, ...args);
        }
        if (CastUtils.PlayerGetterMethods[property]) {
          return  
          () => this.propertyGetter_(targetName, property);
        }
      }
    }
    return this.propertyGetter_(targetName, property);
  }
   
  /**
     * Setter for properties of remote objects.
     */ 
  set(targetName: string, property: string, value: any) {
    asserts.assert(targetName == 'video' || targetName == 'player', 'Unexpected target name');
    this.cachedProperties_[targetName][property] = value;
    this.sendMessage_({'type':'set', 'targetName':targetName, 'property':property, 'value':value});
  }
   
  private onSessionInitiated_(initState: CastUtilsExports.InitStateType, session: chrome.cast.Session) {
    log.debug('CastSender: onSessionInitiated');
    this.onSessionCreated_(session);
    this.sendMessage_({'type':'init', 'initState':initState, 'appData':this.appData_});
    this.castPromise_.resolve();
  }
   
  private onConnectionError_(error: chrome.cast.Error) {
     
    // Default error code: 
    let code = ErrorExports.Code.UNEXPECTED_CAST_ERROR;
    switch(error.code) {
      case 'cancel':
        code = ErrorExports.Code.CAST_CANCELED_BY_USER;
        break;
      case 'timeout':
        code = ErrorExports.Code.CAST_CONNECTION_TIMED_OUT;
        break;
      case 'receiver_unavailable':
        code = ErrorExports.Code.CAST_RECEIVER_APP_UNAVAILABLE;
        break;
    }
    this.castPromise_.reject(new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.CAST, code, error));
  }
   
  private propertyGetter_(targetName: string, property: string): any {
    asserts.assert(targetName == 'video' || targetName == 'player', 'Unexpected target name');
    return this.cachedProperties_[targetName][property];
  }
   
  private remoteCall_(targetName: string, methodName: string, ...varArgs) {
    asserts.assert(targetName == 'video' || targetName == 'player', 'Unexpected target name');
    this.sendMessage_({'type':'call', 'targetName':targetName, 'methodName':methodName, 'args':varArgs});
  }
   
  private remoteAsyncCall_(targetName: string, methodName: string, ...varArgs): Promise {
    asserts.assert(targetName == 'video' || targetName == 'player', 'Unexpected target name');
    const p = new PublicPromise();
    const id = this.nextAsyncCallId_.toString();
    this.nextAsyncCallId_++;
    this.asyncCallPromises_[id] = p;
    try {
      this.sendMessage_({'type':'asyncCall', 'targetName':targetName, 'methodName':methodName, 'args':varArgs, 'id':id});
    } catch (error) {
      p.reject(error);
    }
    return p;
  }
   
  /**
     * A static version of onExistingSessionJoined_, that calls that method for
     * each known instance.
     */ 
  private static onExistingSessionJoined_(session: chrome.cast.Session) {
    for (const instance of instances_) {
      instance.onExistingSessionJoined_(session);
    }
  }
   
  private onExistingSessionJoined_(session: chrome.cast.Session) {
    log.debug('CastSender: onExistingSessionJoined');
    const initState = this.onInitStateRequired_();
    this.castPromise_ = new PublicPromise();
    this.hasJoinedExistingSession_ = true;
    this.onSessionInitiated_(initState, session);
  }
   
  /**
     * A static version of onReceiverStatusChanged_, that calls that method for
     * each known instance.
     */ 
  private static onReceiverStatusChanged_(availability: string) {
    for (const instance of instances_) {
      instance.onReceiverStatusChanged_(availability);
    }
  }
   
  private onReceiverStatusChanged_(availability: string) {
     
    // The cast API is telling us whether there are any cast receiver devices
    // available. 
    log.debug('CastSender: receiver status', availability);
    hasReceivers_ = availability == 'available';
    this.statusChangeTimer_.tickNow();
  }
   
  private onSessionCreated_(session: chrome.cast.Session) {
    session_ = session;
    session.addUpdateListener(this.onConnectionStatusChangedBound_);
    session.addMessageListener(CastUtilsExports.SHAKA_MESSAGE_NAMESPACE, this.onMessageReceivedBound_);
    this.onConnectionStatusChanged_();
  }
   
  private removeListeners_() {
    const session = session_;
    session.removeUpdateListener(this.onConnectionStatusChangedBound_);
    session.removeMessageListener(CastUtilsExports.SHAKA_MESSAGE_NAMESPACE, this.onMessageReceivedBound_);
  }
   
  private onConnectionStatusChanged_() {
    const connected = session_ ? session_.status == 'connected' : false;
    log.debug('CastSender: connection status', connected);
    if (this.isCasting_ && !connected) {
       
      // Tell CastProxy to transfer state back to local player. 
      this.onResumeLocal_();
       
      // Clear whatever we have cached. 
      for (const targetName in this.cachedProperties_) {
        this.cachedProperties_[targetName] = {};
      }
      this.rejectAllPromises_();
    }
    this.isCasting_ = connected;
    this.receiverName_ = connected ? session_.receiver.friendlyName : '';
    this.statusChangeTimer_.tickNow();
  }
   
  /**
     * Reject any async call promises that are still pending.
     */ 
  private rejectAllPromises_() {
    for (const id in this.asyncCallPromises_) {
      const p = this.asyncCallPromises_[id];
      delete this.asyncCallPromises_[id];
       
      // Reject pending async operations as if they were interrupted.
      // At the moment, load() is the only async operation we are worried about. 
      p.reject(new Error(ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.PLAYER, ErrorExports.Code.LOAD_INTERRUPTED));
    }
  }
   
  private onMessageReceived_(namespace: string, serialized: string) {
     
    // Since this method is in the compiled library, make sure all messages
    // passed in here were created with quoted property names. 
    const message = CastUtils.deserialize(serialized);
    log.v2('CastSender: message', message);
    switch(message['type']) {
      case 'event':
        {
          const targetName = message['targetName'];
          const event = message['event'];
          const fakeEvent = FakeEvent.fromRealEvent(event);
          this.onRemoteEvent_(targetName, fakeEvent);
          break;
        }
      case 'update':
        {
          const update = message['update'];
          for (const targetName in update) {
            const target = this.cachedProperties_[targetName] || {};
            for (const property in update[targetName]) {
              target[property] = update[targetName][property];
            }
          }
          if (this.hasJoinedExistingSession_) {
            this.onFirstCastStateUpdate_();
            this.hasJoinedExistingSession_ = false;
          }
          break;
        }
      case 'asyncComplete':
        {
          const id = message['id'];
          const error = message['error'];
          const p = this.asyncCallPromises_[id];
          delete this.asyncCallPromises_[id];
          asserts.assert(p, 'Unexpected async id');
          if (!p) {
            break;
          }
          if (error) {
             
            // This is a hacky way to reconstruct the serialized error. 
            const reconstructedError = new Error(error.severity, error.category, error.code);
            for (const k in error) {
              (reconstructedError as Object)[k] = error[k];
            }
            p.reject(reconstructedError);
          } else {
            p.resolve();
          }
          break;
        }
    }
  }
   
  private sendMessage_(message: Object) {
     
    // Since this method is in the compiled library, make sure all messages
    // passed in here were created with quoted property names. 
    const serialized = CastUtils.serialize(message);
    const session = session_;
     
    // NOTE: This takes an error callback that we have not seen fire.  We don't
    // know if it would fire synchronously or asynchronously.  Until we know how
    // it works, we just log from that callback.  But we _have_ seen
    // sendMessage() throw synchronously, so we handle that.
    // error callback 
    try {
      session.sendMessage(CastUtilsExports.SHAKA_MESSAGE_NAMESPACE, serialized,  
      () => {
      },  
      // success callback 
      log.error);
    } catch (error) {
      log.error('Cast session sendMessage threw', error);
       
      // Translate the error 
      const shakaError = new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.CAST, ErrorExports.Code.CAST_CONNECTION_TIMED_OUT, error);
       
      // Dispatch it through the Player proxy 
      const fakeEvent = new FakeEvent('error', (new Map()).set('detail', shakaError));
      this.onRemoteEvent_('player', fakeEvent);
       
      // Force this session to disconnect and transfer playback to the local
      // device 
      this.forceDisconnect();
       
      // Throw the translated error from this getter/setter/method to the UI/app 
      throw shakaError;
    }
  }
}
 
export const STATUS_DELAY: number = 0.02;
 
export const hasReceivers_: boolean = false;
 
export const session_: chrome.cast.Session = null;
 
/**
 * A set of all living CastSender instances.  The constructor and destroy
 * methods will add and remove instances from this set.
 *
 * This is used to deal with delayed initialization of the Cast SDK.  When the
 * SDK becomes available, instances will be reinitialized.
 *
 */ 
export const instances_: Set<CastSender> = new Set();
 
/**
 * If the cast SDK is not available yet, it will invoke this callback once it
 * becomes available.
 *
 */ 
export const onSdkLoaded_ =  
(loaded: boolean) => {
  if (loaded) {
     
    // Any living instances of CastSender should have their init methods called
    // again now that the API is available. 
    for (const sender of instances_) {
      sender.init();
    }
  }
};
