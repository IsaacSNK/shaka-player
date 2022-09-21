/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{log}from './log';
import*as logExports from './log';
import{DrmEngine}from './drm_engine';
import*as DrmEngineExports from './drm_engine';
goog.require('shaka.polyfill');
import{BufferUtils}from './buffer_utils';
import{EventManager}from './event_manager';
import*as EventManagerExports from './event_manager';
import{FakeEvent}from './fake_event';
import*as FakeEventExports from './fake_event';
import{FakeEventTarget}from './fake_event_target';
import*as FakeEventTargetExports from './fake_event_target';
import{MediaReadyState}from './media_ready_state_utils';
import*as MediaReadyStateExports from './media_ready_state_utils';
import{PublicPromise}from './public_promise';
import{StringUtils}from './string_utils';
import*as StringUtilsExports from './string_utils';
 
/**
 * @summary A polyfill to implement modern, standardized EME on top of Apple's
 * prefixed EME in Safari.
 * @export
 */ 
export class PatchedMediaKeysApple {
   
  /**
     * Installs the polyfill if needed.
     * @export
     */ 
  static install() {
    if (!window.HTMLVideoElement || !window.WebKitMediaKeys) {
       
      // No HTML5 video or no prefixed EME. 
      return;
    }
    log.info('Using Apple-prefixed EME');
     
    // Alias 
    const PatchedMediaKeysApple = PatchedMediaKeysApple;
     
    // Delete mediaKeys to work around strict mode compatibility issues.
    // eslint-disable-next-line no-restricted-syntax 
    delete HTMLMediaElement.prototype['mediaKeys'];
     
    // Work around read-only declaration for mediaKeys by using a string.
    // eslint-disable-next-line no-restricted-syntax 
    HTMLMediaElement.prototype['mediaKeys'] = null;
     
    // eslint-disable-next-line no-restricted-syntax 
    HTMLMediaElement.prototype.setMediaKeys = PatchedMediaKeysApple.setMediaKeys;
     
    // Install patches 
    window.MediaKeys = PatchedMediaKeysApple.MediaKeys;
    window.MediaKeySystemAccess = PatchedMediaKeysApple.MediaKeySystemAccess;
    navigator.requestMediaKeySystemAccess = PatchedMediaKeysApple.requestMediaKeySystemAccess;
    window.shakaMediaKeysPolyfill = true;
  }
   
  /**
     * An implementation of navigator.requestMediaKeySystemAccess.
     * Retrieves a MediaKeySystemAccess object.
     *
     * @this {!Navigator}
     */ 
  static requestMediaKeySystemAccess(keySystem: string, supportedConfigurations: MediaKeySystemConfiguration[]): Promise<MediaKeySystemAccess> {
    log.debug('PatchedMediaKeysApple.requestMediaKeySystemAccess');
    asserts.assert(this == navigator, 'bad "this" for requestMediaKeySystemAccess');
     
    // Alias. 
    const PatchedMediaKeysApple = PatchedMediaKeysApple;
    try {
      const access = new PatchedMediaKeysApple.MediaKeySystemAccess(keySystem, supportedConfigurations);
      return Promise.resolve((access as MediaKeySystemAccess));
    } catch (exception) {
      return Promise.reject(exception);
    }
  }
   
  /**
     * An implementation of HTMLMediaElement.prototype.setMediaKeys.
     * Attaches a MediaKeys object to the media element.
     *
     * @this {!HTMLMediaElement}
     */ 
  static setMediaKeys(mediaKeys: MediaKeys): Promise {
    log.debug('PatchedMediaKeysApple.setMediaKeys');
    asserts.assert(this instanceof HTMLMediaElement, 'bad "this" for setMediaKeys');
     
    // Alias 
    const PatchedMediaKeysApple = PatchedMediaKeysApple;
    const newMediaKeys = (mediaKeys as MediaKeys);
    const oldMediaKeys = (this.mediaKeys as MediaKeys);
    if (oldMediaKeys && oldMediaKeys != newMediaKeys) {
      asserts.assert(oldMediaKeys instanceof PatchedMediaKeysApple.MediaKeys, 'non-polyfill instance of oldMediaKeys');
       
      // Have the old MediaKeys stop listening to events on the video tag. 
      oldMediaKeys.setMedia(null);
    }
    delete this['mediaKeys'];
     
    // in case there is an existing getter 
    this['mediaKeys'] = mediaKeys;
     
    // work around read-only declaration 
    if (newMediaKeys) {
      asserts.assert(newMediaKeys instanceof PatchedMediaKeysApple.MediaKeys, 'non-polyfill instance of newMediaKeys');
      return newMediaKeys.setMedia(this);
    }
    return Promise.resolve();
  }
   
  /**
     * Handler for the native media elements webkitneedkey event.
     *
     * @this {!HTMLMediaElement}
     * @suppress {constantProperty} We reassign what would be const on a real
     *   MediaEncryptedEvent, but in our look-alike event.
     */ 
  private static onWebkitNeedKey_(event: MediaKeyEvent) {
    log.debug('PatchedMediaKeysApple.onWebkitNeedKey_', event);
    const PatchedMediaKeysApple = PatchedMediaKeysApple;
    const mediaKeys = (this.mediaKeys as MediaKeys);
    asserts.assert(mediaKeys instanceof PatchedMediaKeysApple.MediaKeys, 'non-polyfill instance of newMediaKeys');
    asserts.assert(event.initData != null, 'missing init data!');
     
    // Convert the prefixed init data to match the native 'encrypted' event. 
    const uint8 = BufferUtils.toUint8(event.initData);
    const dataview = BufferUtils.toDataView(uint8);
     
    // The first part is a 4 byte little-endian int, which is the length of
    // the second part. 
    const length = dataview.getUint32( 
    /* position= */ 
    0,  
    /* littleEndian= */ 
    true);
    if (length + 4 != uint8.byteLength) {
      throw new RangeError('Malformed FairPlay init data');
    }
     
    // The remainder is a UTF-16 skd URL.  Convert this to UTF-8 and pass on. 
    const str = StringUtils.fromUTF16(uint8.subarray(4),  
    /* littleEndian= */ 
    true);
    const initData = StringUtils.toUTF8(str);
     
    // NOTE: Because "this" is a real EventTarget, the event we dispatch here
    // must also be a real Event. 
    const event2 = new Event('encrypted');
    const encryptedEvent = ((event2 as any) as MediaEncryptedEvent);
    encryptedEvent.initDataType = 'skd';
    encryptedEvent.initData = BufferUtils.toArrayBuffer(initData);
    this.dispatchEvent(event2);
  }
}
 
/**
 * An implementation of MediaKeySystemAccess.
 *
 */ 
export class MediaKeySystemAccess implements MediaKeySystemAccess {
  private configuration_: MediaKeySystemConfiguration;
   
  constructor(public keySystem: string, supportedConfigurations: MediaKeySystemConfiguration[]) {
    log.debug('PatchedMediaKeysApple.MediaKeySystemAccess');
     
    // Optimization: WebKitMediaKeys.isTypeSupported delays responses by a
    // significant amount of time, possibly to discourage fingerprinting.
    // Since we know only FairPlay is supported here, let's skip queries for
    // anything else to speed up the process. 
    if (keySystem.startsWith('com.apple.fps')) {
      for (const cfg of supportedConfigurations) {
        const newCfg = this.checkConfig_(cfg);
        if (newCfg) {
          this.configuration_ = newCfg;
          return;
        }
      }
    }
     
    // According to the spec, this should be a DOMException, but there is not a
    // public constructor for that.  So we make this look-alike instead. 
    const unsupportedKeySystemError = new Error('Unsupported keySystem');
    unsupportedKeySystemError.name = 'NotSupportedError';
    unsupportedKeySystemError['code'] = DOMException.NOT_SUPPORTED_ERR;
    throw unsupportedKeySystemError;
  }
   
  /**
     * Check a single config for MediaKeySystemAccess.
     *
     * @param cfg The requested config.
     * @return A matching config we can support, or
     *   null if the input is not supportable.
     */ 
  private checkConfig_(cfg: MediaKeySystemConfiguration): MediaKeySystemConfiguration | null {
    if (cfg.persistentState == 'required') {
       
      // Not supported by the prefixed API. 
      return null;
    }
     
    // Create a new config object and start adding in the pieces which we find
    // support for.  We will return this from getConfiguration() later if
    // asked. 
    const newCfg: MediaKeySystemConfiguration = {'audioCapabilities':[], 'videoCapabilities':[],  
    // It is technically against spec to return these as optional, but we
    // don't truly know their values from the prefixed API: 
    'persistentState':'optional', 'distinctiveIdentifier':'optional',  
    // Pretend the requested init data types are supported, since we don't
    // really know that either: 
    'initDataTypes':cfg.initDataTypes, 'sessionTypes':['temporary'], 'label':cfg.label};
     
    // PatchedMediaKeysApple tests for key system availability through
    // WebKitMediaKeys.isTypeSupported. 
    let ranAnyTests = false;
    let success = false;
    if (cfg.audioCapabilities) {
      for (const cap of cfg.audioCapabilities) {
        if (cap.contentType) {
          ranAnyTests = true;
          const contentType = cap.contentType.split(';')[0];
          if (WebKitMediaKeys.isTypeSupported(this.keySystem, contentType)) {
            newCfg.audioCapabilities.push(cap);
            success = true;
          }
        }
      }
    }
    if (cfg.videoCapabilities) {
      for (const cap of cfg.videoCapabilities) {
        if (cap.contentType) {
          ranAnyTests = true;
          const contentType = cap.contentType.split(';')[0];
          if (WebKitMediaKeys.isTypeSupported(this.keySystem, contentType)) {
            newCfg.videoCapabilities.push(cap);
            success = true;
          }
        }
      }
    }
    if (!ranAnyTests) {
       
      // If no specific types were requested, we check all common types to
      // find out if the key system is present at all. 
      success = WebKitMediaKeys.isTypeSupported(this.keySystem, 'video/mp4');
    }
    if (success) {
      return newCfg;
    }
    return null;
  }
   
  /** @override */ 
  createMediaKeys() {
    log.debug('PatchedMediaKeysApple.MediaKeySystemAccess.createMediaKeys');
     
    // Alias 
    const PatchedMediaKeysApple = PatchedMediaKeysApple;
    const mediaKeys = new PatchedMediaKeysApple.MediaKeys(this.keySystem);
    return Promise.resolve((mediaKeys as MediaKeys));
  }
   
  /** @override */ 
  getConfiguration() {
    log.debug('PatchedMediaKeysApple.MediaKeySystemAccess.getConfiguration');
    return this.configuration_;
  }
}
 
/**
 * An implementation of MediaKeys.
 *
 */ 
export class MediaKeys implements MediaKeys {
  private nativeMediaKeys_: WebKitMediaKeys;
  private eventManager_: EventManager;
   
  constructor(keySystem: string) {
    log.debug('PatchedMediaKeysApple.MediaKeys');
    this.nativeMediaKeys_ = new WebKitMediaKeys(keySystem);
    this.eventManager_ = new EventManager();
  }
   
  /** @override */ 
  createSession(sessionType) {
    log.debug('PatchedMediaKeysApple.MediaKeys.createSession');
    sessionType = sessionType || 'temporary';
     
    // For now, only the 'temporary' type is supported. 
    if (sessionType != 'temporary') {
      throw new TypeError('Session type ' + sessionType + ' is unsupported on this platform.');
    }
     
    // Alias 
    const PatchedMediaKeysApple = PatchedMediaKeysApple;
    return new PatchedMediaKeysApple.MediaKeySession(this.nativeMediaKeys_, sessionType);
  }
   
  /** @override */ 
  setServerCertificate(serverCertificate) {
    log.debug('PatchedMediaKeysApple.MediaKeys.setServerCertificate');
    return Promise.resolve(false);
  }
   
  protected setMedia(media: HTMLMediaElement): Promise {
     
    // Alias 
    const PatchedMediaKeysApple = PatchedMediaKeysApple;
     
    // Remove any old listeners. 
    this.eventManager_.removeAll();
     
    // It is valid for media to be null; null is used to flag that event
    // handlers need to be cleaned up. 
    if (!media) {
      return Promise.resolve();
    }
     
    // Intercept and translate these prefixed EME events. 
    this.eventManager_.listen(media, 'webkitneedkey', (PatchedMediaKeysApple.onWebkitNeedKey_ as EventManagerExports.ListenerType));
     
    // Wrap native HTMLMediaElement.webkitSetMediaKeys with a Promise. 
    try {
       
      // Some browsers require that readyState >=1 before mediaKeys can be
      // set, so check this and wait for loadedmetadata if we are not in the
      // correct state 
      MediaReadyState.waitForReadyState(media, HTMLMediaElement.HAVE_METADATA, this.eventManager_,  
      () => {
        media.webkitSetMediaKeys(this.nativeMediaKeys_);
      });
      return Promise.resolve();
    } catch (exception) {
      return Promise.reject(exception);
    }
  }
}
 
/**
 * An implementation of MediaKeySession.
 *
 */ 
export class MediaKeySession extends FakeEventTarget implements MediaKeySession {
   
  /**
       * The native MediaKeySession, which will be created in generateRequest.
       */ 
  private nativeMediaKeySession_: WebKitMediaKeySession = null;
  private nativeMediaKeys_: WebKitMediaKeys;
   
  // Promises that are resolved later 
  private generateRequestPromise_: PublicPromise = null;
  private updatePromise_: PublicPromise = null;
  private eventManager_: EventManager;
  sessionId: string = '';
  expiration: number = NaN;
  closed: PublicPromise;
  keyStatuses: MediaKeyStatusMap;
   
  constructor(nativeMediaKeys: WebKitMediaKeys, sessionType: string) {
    log.debug('PatchedMediaKeysApple.MediaKeySession');
    super();
    this.nativeMediaKeys_ = nativeMediaKeys;
    this.eventManager_ = new EventManager();
    this.closed = new PublicPromise();
    this.keyStatuses = new MediaKeyStatusMap();
  }
   
  /** @override */ 
  generateRequest(initDataType, initData) {
    log.debug('PatchedMediaKeysApple.MediaKeySession.generateRequest');
    this.generateRequestPromise_ = new PublicPromise();
    try {
       
      // This EME spec version requires a MIME content type as the 1st param to
      // createSession, but doesn't seem to matter what the value is.
      // It also only accepts Uint8Array, not ArrayBuffer, so explicitly make
      // initData into a Uint8Array. 
      const session = this.nativeMediaKeys_.createSession('video/mp4', BufferUtils.toUint8(initData));
      this.nativeMediaKeySession_ = session;
      this.sessionId = session.sessionId || '';
       
      // Attach session event handlers here. 
      this.eventManager_.listen(this.nativeMediaKeySession_, 'webkitkeymessage', ( 
      (event) => this.onWebkitKeyMessage_(event) as EventManagerExports.ListenerType));
      this.eventManager_.listen(session, 'webkitkeyadded', ( 
      (event) => this.onWebkitKeyAdded_(event) as EventManagerExports.ListenerType));
      this.eventManager_.listen(session, 'webkitkeyerror', ( 
      (event) => this.onWebkitKeyError_(event) as EventManagerExports.ListenerType));
      this.updateKeyStatus_('status-pending');
    } catch (exception) {
      this.generateRequestPromise_.reject(exception);
    }
    return this.generateRequestPromise_;
  }
   
  /** @override */ 
  load() {
    log.debug('PatchedMediaKeysApple.MediaKeySession.load');
    return Promise.reject(new Error('MediaKeySession.load not yet supported'));
  }
   
  /** @override */ 
  update(response) {
    log.debug('PatchedMediaKeysApple.MediaKeySession.update');
    this.updatePromise_ = new PublicPromise();
    try {
       
      // Pass through to the native session. 
      this.nativeMediaKeySession_.update(BufferUtils.toUint8(response));
    } catch (exception) {
      this.updatePromise_.reject(exception);
    }
    return this.updatePromise_;
  }
   
  /** @override */ 
  close() {
    log.debug('PatchedMediaKeysApple.MediaKeySession.close');
    try {
       
      // Pass through to the native session. 
      this.nativeMediaKeySession_.close();
      this.closed.resolve();
      this.eventManager_.removeAll();
    } catch (exception) {
      this.closed.reject(exception);
    }
    return this.closed;
  }
   
  /** @override */ 
  remove() {
    log.debug('PatchedMediaKeysApple.MediaKeySession.remove');
    return Promise.reject(new Error('MediaKeySession.remove is only applicable for persistent licenses, ' + 'which are not supported on this platform'));
  }
   
  /**
     * Handler for the native keymessage event on WebKitMediaKeySession.
     *
     */ 
  private onWebkitKeyMessage_(event: MediaKeyEvent) {
    log.debug('PatchedMediaKeysApple.onWebkitKeyMessage_', event);
     
    // We can now resolve this.generateRequestPromise, which should be non-null. 
    asserts.assert(this.generateRequestPromise_, 'generateRequestPromise_ should be set before now!');
    if (this.generateRequestPromise_) {
      this.generateRequestPromise_.resolve();
      this.generateRequestPromise_ = null;
    }
    const isNew = this.keyStatuses.getStatus() == undefined;
    const data = (new Map()).set('messageType', isNew ? 'license-request' : 'license-renewal').set('message', BufferUtils.toArrayBuffer(event.message));
    const event2 = new FakeEvent('message', data);
    this.dispatchEvent(event2);
  }
   
  /**
     * Handler for the native keyadded event on WebKitMediaKeySession.
     *
     */ 
  private onWebkitKeyAdded_(event: MediaKeyEvent) {
    log.debug('PatchedMediaKeysApple.onWebkitKeyAdded_', event);
     
    // This shouldn't fire while we're in the middle of generateRequest,
    // but if it does, we will need to change the logic to account for it. 
    asserts.assert(!this.generateRequestPromise_, 'Key added during generate!');
     
    // We can now resolve this.updatePromise, which should be non-null. 
    asserts.assert(this.updatePromise_, 'updatePromise_ should be set before now!');
    if (this.updatePromise_) {
      this.updateKeyStatus_('usable');
      this.updatePromise_.resolve();
      this.updatePromise_ = null;
    }
  }
   
  /**
     * Handler for the native keyerror event on WebKitMediaKeySession.
     *
     */ 
  private onWebkitKeyError_(event: MediaKeyEvent) {
    log.debug('PatchedMediaKeysApple.onWebkitKeyError_', event);
    const error = new Error('EME PatchedMediaKeysApple key error');
    error['errorCode'] = this.nativeMediaKeySession_.error;
    if (this.generateRequestPromise_ != null) {
      this.generateRequestPromise_.reject(error);
      this.generateRequestPromise_ = null;
    } else {
      if (this.updatePromise_ != null) {
        this.updatePromise_.reject(error);
        this.updatePromise_ = null;
      } else {
        switch(this.nativeMediaKeySession_.error.code) {
          case WebKitMediaKeyError.MEDIA_KEYERR_OUTPUT:
          case WebKitMediaKeyError.MEDIA_KEYERR_HARDWARECHANGE:
            this.updateKeyStatus_('output-not-allowed');
            break;
          default:
            this.updateKeyStatus_('internal-error');
            break;
        }
      }
    }
  }
   
  /**
     * Updates key status and dispatch a 'keystatuseschange' event.
     *
     */ 
  private updateKeyStatus_(status: string) {
    this.keyStatuses.setStatus(status);
    const event = new FakeEvent('keystatuseschange');
    this.dispatchEvent(event);
  }
}
 
/**
 * @summary An implementation of MediaKeyStatusMap.
 * This fakes a map with a single key ID.
 *
 * @todo Consolidate the MediaKeyStatusMap types in these polyfills.
 */ 
export class MediaKeyStatusMap implements MediaKeyStatusMap {
  size: number = 0;
  private status_: string | undefined = undefined;
   
  /**
     * An internal method used by the session to set key status.
     */ 
  setStatus(status: string | undefined) {
    this.size = status == undefined ? 0 : 1;
    this.status_ = status;
  }
   
  /**
     * An internal method used by the session to get key status.
     */ 
  getStatus(): string | undefined {
    return this.status_;
  }
   
  /** @override */ 
  forEach(fn) {
    if (this.status_) {
      fn(this.status_, DrmEngineExports.DUMMY_KEY_ID.value());
    }
  }
   
  /** @override */ 
  get(keyId) {
    if (this.has(keyId)) {
      return this.status_;
    }
    return undefined;
  }
   
  /** @override */ 
  has(keyId) {
    const fakeKeyId = DrmEngineExports.DUMMY_KEY_ID.value();
    if (this.status_ && BufferUtils.equal(keyId, fakeKeyId)) {
      return true;
    }
    return false;
  }
   
  /**
     * @suppress {missingReturn}
     * @override
     */ 
  entries() {
    asserts.assert(false, 'Not used!  Provided only for the compiler.');
  }
   
  /**
     * @suppress {missingReturn}
     * @override
     */ 
  keys() {
    asserts.assert(false, 'Not used!  Provided only for the compiler.');
  }
   
  /**
     * @suppress {missingReturn}
     * @override
     */ 
  values() {
    asserts.assert(false, 'Not used!  Provided only for the compiler.');
  }
}
