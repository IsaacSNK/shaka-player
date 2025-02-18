/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.polyfill {
  /**
   * @summary A polyfill to implement
   * {@link https://bit.ly/EmeMar15 EME draft 12 March 2015} on top of
   * webkit-prefixed {@link https://bit.ly/Eme01b EME v0.1b}.
   * @export
   */
  export class PatchedMediaKeysWebkit {
    /**
     * Installs the polyfill if needed.
     * @export
     */
    static install() {
      // Alias.
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;
      if (
        !window.HTMLVideoElement ||
        (navigator.requestMediaKeySystemAccess &&
          // eslint-disable-next-line no-restricted-syntax
          MediaKeySystemAccess.prototype.getConfiguration)
      ) {
        return;
      }

      // eslint-disable-next-line no-restricted-syntax
      // eslint-disable-next-line no-restricted-syntax
      if (HTMLMediaElement.prototype.webkitGenerateKeyRequest) {
        shaka.log.info("Using webkit-prefixed EME v0.1b");
        PatchedMediaKeysWebkit.prefix_ = "webkit";
      } else {
        if (HTMLMediaElement.prototype.generateKeyRequest) {
          shaka.log.info("Using nonprefixed EME v0.1b");
        } else {
          return;
        }
      }
      goog.asserts.assert(
        // eslint-disable-next-line no-restricted-syntax
        HTMLMediaElement.prototype[
          PatchedMediaKeysWebkit.prefixApi_("generateKeyRequest")
        ],
        "PatchedMediaKeysWebkit APIs not available!"
      );

      // Install patches.
      navigator.requestMediaKeySystemAccess =
        PatchedMediaKeysWebkit.requestMediaKeySystemAccess;

      // Delete mediaKeys to work around strict mode compatibility issues.
      // eslint-disable-next-line no-restricted-syntax
      delete HTMLMediaElement.prototype["mediaKeys"];

      // Work around read-only declaration for mediaKeys by using a string.
      // eslint-disable-next-line no-restricted-syntax
      HTMLMediaElement.prototype["mediaKeys"] = null;

      // eslint-disable-next-line no-restricted-syntax
      HTMLMediaElement.prototype.setMediaKeys =
        PatchedMediaKeysWebkit.setMediaKeys;
      // @ts-ignore
      window.MediaKeys = PatchedMediaKeysWebkit.MediaKeys;
      // @ts-ignore
      window.MediaKeySystemAccess = PatchedMediaKeysWebkit.MediaKeySystemAccess;
      window.shakaMediaKeysPolyfill = true;
    }

    /**
     * Prefix the api with the stored prefix.
     *
     */
    private static prefixApi_(api: string): string {
      const prefix = shaka.polyfill.PatchedMediaKeysWebkit.prefix_;
      if (prefix) {
        return prefix + api.charAt(0).toUpperCase() + api.slice(1);
      }
      return api;
    }

    /**
     * An implementation of navigator.requestMediaKeySystemAccess.
     * Retrieves a MediaKeySystemAccess object.
     *
     * @this {!Navigator}
     */
    static requestMediaKeySystemAccess(
      keySystem: string,
      supportedConfigurations: MediaKeySystemConfiguration[]
    ): Promise<MediaKeySystemAccess> {
      shaka.log.debug("PatchedMediaKeysWebkit.requestMediaKeySystemAccess");
      goog.asserts.assert(
        this == navigator,
        'bad "this" for requestMediaKeySystemAccess'
      );

      // Alias.
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;
      try {
        const access = new PatchedMediaKeysWebkit.MediaKeySystemAccess(
          keySystem,
          supportedConfigurations
        );
        return Promise.resolve(access as MediaKeySystemAccess);
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
    // @ts-ignore
    static setMediaKeys(mediaKeys: MediaKeys): Promise {
      shaka.log.debug("PatchedMediaKeysWebkit.setMediaKeys");
      goog.asserts.assert(
        this instanceof HTMLMediaElement,
        'bad "this" for setMediaKeys'
      );

      // Alias.
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;
      const newMediaKeys = mediaKeys as MediaKeys;
      const oldMediaKeys = this.mediaKeys as MediaKeys;
      if (oldMediaKeys && oldMediaKeys != newMediaKeys) {
        goog.asserts.assert(
          oldMediaKeys instanceof PatchedMediaKeysWebkit.MediaKeys,
          "non-polyfill instance of oldMediaKeys"
        );

        // Have the old MediaKeys stop listening to events on the video tag.
        oldMediaKeys.setMedia(null);
      }
      delete this["mediaKeys"];

      // In case there is an existing getter.
      this["mediaKeys"] = mediaKeys;

      // Work around the read-only declaration.
      if (newMediaKeys) {
        goog.asserts.assert(
          newMediaKeys instanceof PatchedMediaKeysWebkit.MediaKeys,
          "non-polyfill instance of newMediaKeys"
        );
        newMediaKeys.setMedia(this);
      }
      return Promise.resolve();
    }

    /**
     * For some of this polyfill's implementation, we need to query a video
     * element.  But for some embedded systems, it is memory-expensive to create
     * multiple video elements.  Therefore, we check the document to see if we can
     * borrow one to query before we fall back to creating one temporarily.
     *
     */
    private static getVideoElement_(): HTMLVideoElement {
      const videos = document.getElementsByTagName("video");
      const video = videos.length ? videos[0] : document.createElement("video");
      return video as HTMLVideoElement;
    }
  }
}

namespace shaka.polyfill.PatchedMediaKeysWebkit {
  /**
   * An implementation of MediaKeySystemAccess.
   *
   */
  export class MediaKeySystemAccess implements MediaKeySystemAccess {
    private internalKeySystem_: string;
    private configuration_: MediaKeySystemConfiguration;

    constructor(
      public keySystem: string,
      supportedConfigurations: MediaKeySystemConfiguration[]
    ) {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySystemAccess");
      this.internalKeySystem_ = keySystem;

      // This is only a guess, since we don't really know from the prefixed API.
      let allowPersistentState = false;
      if (keySystem == "org.w3.clearkey") {
        // ClearKey's string must be prefixed in v0.1b.
        this.internalKeySystem_ = "webkit-org.w3.clearkey";

        // ClearKey doesn't support persistence.
        allowPersistentState = false;
      }
      let success = false;
      const tmpVideo = shaka.polyfill.PatchedMediaKeysWebkit.getVideoElement_();
      for (const cfg of supportedConfigurations) {
        // Create a new config object and start adding in the pieces which we
        // find support for.  We will return this from getConfiguration() if
        // asked.
        const newCfg: MediaKeySystemConfiguration = {
          audioCapabilities: [],
          videoCapabilities: [],
          // It is technically against spec to return these as optional, but we
          // don't truly know their values from the prefixed API:
          persistentState: "optional",
          distinctiveIdentifier: "optional",
          // Pretend the requested init data types are supported, since we don't
          // really know that either:
          initDataTypes: cfg.initDataTypes,
          sessionTypes: ["temporary"],
          label: cfg.label,
        };

        // v0.1b tests for key system availability with an extra argument on
        // canPlayType.
        let ranAnyTests = false;
        if (cfg.audioCapabilities) {
          for (const cap of cfg.audioCapabilities) {
            if (cap.contentType) {
              ranAnyTests = true;

              // In Chrome <= 40, if you ask about Widevine-encrypted audio
              // support, you get a false-negative when you specify codec
              // information. Work around this by stripping codec info for audio
              // types.
              const contentType = cap.contentType.split(";")[0];
              if (tmpVideo.canPlayType(contentType, this.internalKeySystem_)) {
                // @ts-ignore
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
              if (
                tmpVideo.canPlayType(cap.contentType, this.internalKeySystem_)
              ) {
                // @ts-ignore
                newCfg.videoCapabilities.push(cap);
                success = true;
              }
            }
          }
        }
        if (!ranAnyTests) {
          // If no specific types were requested, we check all common types to
          // find out if the key system is present at all.
          // @ts-ignore
          success =
            tmpVideo.canPlayType("video/mp4", this.internalKeySystem_) ||
            tmpVideo.canPlayType("video/webm", this.internalKeySystem_);
        }
        if (cfg.persistentState == "required") {
          if (allowPersistentState) {
            newCfg.persistentState = "required";
            newCfg.sessionTypes = ["persistent-license"];
          } else {
            success = false;
          }
        }
        if (success) {
          this.configuration_ = newCfg;
          return;
        }
      }

      // for each cfg in supportedConfigurations
      let message = "Unsupported keySystem";
      if (keySystem == "org.w3.clearkey" || keySystem == "com.widevine.alpha") {
        message = "None of the requested configurations were supported.";
      }

      // According to the spec, this should be a DOMException, but there is not a
      // public constructor for that.  So we make this look-alike instead.
      const unsupportedError = new Error(message);
      unsupportedError.name = "NotSupportedError";
      unsupportedError["code"] = DOMException.NOT_SUPPORTED_ERR;
      throw unsupportedError;
    }

    /** @override */
    createMediaKeys() {
      shaka.log.debug(
        "PatchedMediaKeysWebkit.MediaKeySystemAccess.createMediaKeys"
      );

      // Alias.
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;
      const mediaKeys = new PatchedMediaKeysWebkit.MediaKeys(
        this.internalKeySystem_
      );
      return Promise.resolve(mediaKeys as MediaKeys);
    }

    /** @override */
    getConfiguration() {
      shaka.log.debug(
        "PatchedMediaKeysWebkit.MediaKeySystemAccess.getConfiguration"
      );
      return this.configuration_;
    }
  }
}

namespace shaka.polyfill.PatchedMediaKeysWebkit {
  /**
   * An implementation of MediaKeys.
   *
   */
  export class MediaKeys implements MediaKeys {
    private keySystem_: string;
    // @ts-ignore
    private media_: HTMLMediaElement = null;
    private eventManager_: EventManager;
    private newSessions_: MediaKeySession[] = [];

    /**
     * {!Map.<string,
     *                 !shaka.polyfill.PatchedMediaKeysWebkit.MediaKeySession>}
     */
    private sessionMap_: Map<string, MediaKeySession>;

    constructor(keySystem: string) {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeys");
      this.keySystem_ = keySystem;
      this.eventManager_ = new shaka.util.EventManager();
      this.sessionMap_ = new Map();
    }

    protected setMedia(media: HTMLMediaElement) {
      this.media_ = media;

      // Remove any old listeners.
      this.eventManager_.removeAll();
      const prefix = shaka.polyfill.PatchedMediaKeysWebkit.prefix_;
      if (media) {
        // Intercept and translate these prefixed EME events.
        this.eventManager_.listen(
          media,
          prefix + "needkey",
          (event) => this.onWebkitNeedKey_(event) as ListenerType
        );
        this.eventManager_.listen(
          media,
          prefix + "keymessage",
          (event) => this.onWebkitKeyMessage_(event) as ListenerType
        );
        this.eventManager_.listen(
          media,
          prefix + "keyadded",
          (event) => this.onWebkitKeyAdded_(event) as ListenerType
        );
        this.eventManager_.listen(
          media,
          prefix + "keyerror",
          (event) => this.onWebkitKeyError_(event) as ListenerType
        );
      }
    }

    /** @override */
    createSession(sessionType) {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeys.createSession");
      sessionType = sessionType || "temporary";
      if (sessionType != "temporary" && sessionType != "persistent-license") {
        throw new TypeError(
          "Session type " + sessionType + " is unsupported on this platform."
        );
      }

      // Alias.
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;

      // Unprefixed EME allows for session creation without a video tag or src.
      // Prefixed EME requires both a valid HTMLMediaElement and a src.
      const media =
        this.media_ || (document.createElement("video") as HTMLMediaElement);
      if (!media.src) {
        media.src = "about:blank";
      }
      const session = new PatchedMediaKeysWebkit.MediaKeySession(
        media,
        this.keySystem_,
        sessionType
      );
      this.newSessions_.push(session);
      return session;
    }

    /** @override */
    setServerCertificate(serverCertificate) {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeys.setServerCertificate");

      // There is no equivalent in v0.1b, so return failure.
      return Promise.resolve(false);
    }

    /**
     * @suppress {constantProperty} We reassign what would be const on a real
     *   MediaEncryptedEvent, but in our look-alike event.
     */
    private onWebkitNeedKey_(event: MediaKeyEvent) {
      shaka.log.debug("PatchedMediaKeysWebkit.onWebkitNeedKey_", event);
      goog.asserts.assert(this.media_, "media_ not set in onWebkitNeedKey_");
      const event2 = new CustomEvent("encrypted");
      const encryptedEvent = event2 as any as MediaEncryptedEvent;

      // initDataType is not used by v0.1b EME, so any valid value is fine here.
      encryptedEvent.initDataType = "cenc";
      encryptedEvent.initData = shaka.util.BufferUtils.toArrayBuffer(
        event.initData
      );
      this.media_.dispatchEvent(event2);
    }

    private onWebkitKeyMessage_(event: MediaKeyEvent) {
      shaka.log.debug("PatchedMediaKeysWebkit.onWebkitKeyMessage_", event);
      const session = this.findSession_(event.sessionId);
      if (!session) {
        shaka.log.error("Session not found", event.sessionId);
        return;
      }
      const isNew = session.keyStatuses.getStatus() == undefined;
      const data = new Map()
        .set("messageType", isNew ? "licenserequest" : "licenserenewal")
        .set("message", event.message);
      const event2 = new shaka.util.FakeEvent("message", data);
      session.generated();
      session.dispatchEvent(event2);
    }

    private onWebkitKeyAdded_(event: MediaKeyEvent) {
      shaka.log.debug("PatchedMediaKeysWebkit.onWebkitKeyAdded_", event);
      const session = this.findSession_(event.sessionId);
      goog.asserts.assert(
        session,
        "unable to find session in onWebkitKeyAdded_"
      );
      if (session) {
        session.ready();
      }
    }

    private onWebkitKeyError_(event: MediaKeyEvent) {
      shaka.log.debug("PatchedMediaKeysWebkit.onWebkitKeyError_", event);
      const session = this.findSession_(event.sessionId);
      goog.asserts.assert(
        session,
        "unable to find session in onWebkitKeyError_"
      );
      if (session) {
        session.handleError(event);
      }
    }

    private findSession_(sessionId: string): MediaKeySession {
      let session = this.sessionMap_.get(sessionId);
      if (session) {
        shaka.log.debug(
          "PatchedMediaKeysWebkit.MediaKeys.findSession_",
          session
        );
        return session;
      }
      session = this.newSessions_.shift();
      if (session) {
        session.sessionId = sessionId;
        this.sessionMap_.set(sessionId, session);
        shaka.log.debug(
          "PatchedMediaKeysWebkit.MediaKeys.findSession_",
          session
        );
        return session;
      }
      // @ts-ignore
      return null;
    }
  }
}

namespace shaka.polyfill.PatchedMediaKeysWebkit {
  /**
   * An implementation of MediaKeySession.
   *
   */
  export class MediaKeySession
    extends shaka.util.FakeEventTarget
    implements MediaKeySession
  {
    private media_: HTMLMediaElement;
    private initialized_: boolean = false;
    private generatePromise_: PublicPromise = null;
    private updatePromise_: PublicPromise = null;
    private keySystem_: string;
    private type_: string;
    sessionId: string = "";
    expiration: number = NaN;
    closed: PublicPromise;
    keyStatuses: MediaKeyStatusMap;

    constructor(
      media: HTMLMediaElement,
      keySystem: string,
      sessionType: string
    ) {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySession");
      super();
      this.media_ = media;
      this.keySystem_ = keySystem;
      this.type_ = sessionType;
      this.closed = new shaka.util.PublicPromise();
      this.keyStatuses =
        new shaka.polyfill.PatchedMediaKeysWebkit.MediaKeyStatusMap();
    }

    /**
     * Signals that the license request has been generated.  This resolves the
     * 'generateRequest' promise.
     *
     */
    protected generated() {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySession.generated");
      if (this.generatePromise_) {
        this.generatePromise_.resolve();
        this.generatePromise_ = null;
      }
    }

    /**
     * Signals that the session is 'ready', which is the terminology used in older
     * versions of EME.  The new signal is to resolve the 'update' promise.  This
     * translates between the two.
     *
     */
    protected ready() {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySession.ready");
      this.updateKeyStatus_("usable");
      if (this.updatePromise_) {
        this.updatePromise_.resolve();
      }
      this.updatePromise_ = null;
    }

    /**
     * Either rejects a promise, or dispatches an error event, as appropriate.
     *
     */
    handleError(event: MediaKeyEvent) {
      shaka.log.debug(
        "PatchedMediaKeysWebkit.MediaKeySession.handleError",
        event
      );

      // This does not match the DOMException we get in current WD EME, but it
      // will at least provide some information which can be used to look into the
      // problem.
      const error = new Error("EME v0.1b key error");
      const errorCode = event.errorCode;
      errorCode.systemCode = event.systemCode;
      error["errorCode"] = errorCode;

      // The presence or absence of sessionId indicates whether this corresponds
      // to generateRequest() or update().
      if (!event.sessionId && this.generatePromise_) {
        if (event.systemCode == 45) {
          error.message = "Unsupported session type.";
        }
        this.generatePromise_.reject(error);
        this.generatePromise_ = null;
      } else {
        if (event.sessionId && this.updatePromise_) {
          this.updatePromise_.reject(error);
          this.updatePromise_ = null;
        } else {
          // This mapping of key statuses is imperfect at best.
          const code = event.errorCode.code;
          const systemCode = event.systemCode;
          if (code == MediaKeyError["MEDIA_KEYERR_OUTPUT"]) {
            this.updateKeyStatus_("output-restricted");
          } else {
            if (systemCode == 1) {
              this.updateKeyStatus_("expired");
            } else {
              this.updateKeyStatus_("internal-error");
            }
          }
        }
      }
    }

    /**
     * Logic which is shared between generateRequest() and load(), both of which
     * are ultimately implemented with webkitGenerateKeyRequest in prefixed EME.
     *
     */
    private generate_(
      initData: BufferSource | null,
      offlineSessionId: string | null
      // @ts-ignore
    ): Promise {
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;
      if (this.initialized_) {
        const error = new Error("The session is already initialized.");
        return Promise.reject(error);
      }
      this.initialized_ = true;
      let mangledInitData: Uint8Array;
      try {
        if (this.type_ == "persistent-license") {
          const StringUtils = shaka.util.StringUtils;
          if (!offlineSessionId) {
            goog.asserts.assert(initData, "expecting init data");

            // Persisting the initial license.
            // Prefix the init data with a tag to indicate persistence.
            const prefix = StringUtils.toUTF8("PERSISTENT|");
            mangledInitData = shaka.util.Uint8ArrayUtils.concat(
              prefix,
              initData
            );
          } else {
            // Loading a stored license.
            // Prefix the init data (which is really a session ID) with a tag to
            // indicate that we are loading a persisted session.
            mangledInitData = shaka.util.BufferUtils.toUint8(
              StringUtils.toUTF8("LOAD_SESSION|" + offlineSessionId)
            );
          }
        } else {
          // Streaming.
          goog.asserts.assert(
            this.type_ == "temporary",
            "expected temporary session"
          );
          goog.asserts.assert(
            !offlineSessionId,
            "unexpected offline session ID"
          );
          goog.asserts.assert(initData, "expecting init data");
          mangledInitData = shaka.util.BufferUtils.toUint8(initData);
        }
        goog.asserts.assert(mangledInitData, "init data not set!");
      } catch (exception) {
        return Promise.reject(exception);
      }
      goog.asserts.assert(
        this.generatePromise_ == null,
        "generatePromise_ should be null"
      );
      this.generatePromise_ = new shaka.util.PublicPromise();

      // Because we are hacking media.src in createSession to better emulate
      // unprefixed EME's ability to create sessions and license requests without
      // a video tag, we can get ourselves into trouble.  It seems that sometimes,
      // the setting of media.src hasn't been processed by some other thread, and
      // GKR can throw an exception.  If this occurs, wait 10 ms and try again at
      // most once.  This situation should only occur when init data is available
      // ahead of the 'needkey' event.
      const generateKeyRequestName =
        PatchedMediaKeysWebkit.prefixApi_("generateKeyRequest");
      try {
        this.media_[generateKeyRequestName](this.keySystem_, mangledInitData);
      } catch (exception) {
        if (exception.name != "InvalidStateError") {
          this.generatePromise_ = null;
          return Promise.reject(exception);
        }
        const timer = new shaka.util.Timer(() => {
          try {
            this.media_[generateKeyRequestName](
              this.keySystem_,
              mangledInitData
            );
          } catch (exception2) {
            this.generatePromise_.reject(exception2);
            this.generatePromise_ = null;
          }
        });
        timer.tickAfter(
          /* seconds= */
          0.01
        );
      }
      return this.generatePromise_;
    }

    /**
     * An internal version of update which defers new calls while old ones are in
     * progress.
     *
     * @param promise  The promise associated with
     *   this call.
     */
    private update_(promise: PublicPromise, response: BufferSource) {
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;
      if (this.updatePromise_) {
        // We already have an update in-progress, so defer this one until after
        // the old one is resolved.  Execute this whether the original one
        // succeeds or fails.
        this.updatePromise_
          .then(() => this.update_(promise, response))
          .catch(() => this.update_(promise, response));
        return;
      }
      this.updatePromise_ = promise;
      let key;
      let keyId;
      if (this.keySystem_ == "webkit-org.w3.clearkey") {
        // The current EME version of clearkey wants a structured JSON response.
        // The v0.1b version wants just a raw key.  Parse the JSON response and
        // extract the key and key ID.
        const StringUtils = shaka.util.StringUtils;
        const Uint8ArrayUtils = shaka.util.Uint8ArrayUtils;
        const licenseString = StringUtils.fromUTF8(response);
        const jwkSet = JSON.parse(licenseString) as JWKSet;
        const kty = jwkSet.keys[0].kty;
        if (kty != "oct") {
          // Reject the promise.
          this.updatePromise_.reject(
            new Error("Response is not a valid JSON Web Key Set.")
          );
          this.updatePromise_ = null;
        }
        key = Uint8ArrayUtils.fromBase64(jwkSet.keys[0].k);
        keyId = Uint8ArrayUtils.fromBase64(jwkSet.keys[0].kid);
      } else {
        // The key ID is not required.
        key = shaka.util.BufferUtils.toUint8(response);
        keyId = null;
      }
      const addKeyName = PatchedMediaKeysWebkit.prefixApi_("addKey");
      try {
        this.media_[addKeyName](this.keySystem_, key, keyId, this.sessionId);
      } catch (exception) {
        // Reject the promise.
        this.updatePromise_.reject(exception);
        this.updatePromise_ = null;
      }
    }

    /**
     * Update key status and dispatch a 'keystatuseschange' event.
     *
     */
    private updateKeyStatus_(status: string) {
      this.keyStatuses.setStatus(status);
      const event = new shaka.util.FakeEvent("keystatuseschange");
      this.dispatchEvent(event);
    }

    /** @override */
    generateRequest(initDataType, initData) {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySession.generateRequest");
      return this.generate_(initData, null);
    }

    /** @override */
    load(sessionId) {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySession.load");
      if (this.type_ == "persistent-license") {
        return this.generate_(null, sessionId);
      } else {
        return Promise.reject(new Error("Not a persistent session."));
      }
    }

    /** @override */
    update(response) {
      shaka.log.debug(
        "PatchedMediaKeysWebkit.MediaKeySession.update",
        response
      );
      goog.asserts.assert(this.sessionId, "update without session ID");
      const nextUpdatePromise = new shaka.util.PublicPromise();
      this.update_(nextUpdatePromise, response);
      return nextUpdatePromise;
    }

    /** @override */
    close() {
      const PatchedMediaKeysWebkit = shaka.polyfill.PatchedMediaKeysWebkit;
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySession.close");

      // This will remove a persistent session, but it's also the only way to free
      // CDM resources on v0.1b.
      if (this.type_ != "persistent-license") {
        // sessionId may reasonably be null if no key request has been generated
        // yet.  Unprefixed EME will return a rejected promise in this case.  We
        // will use the same error message that Chrome 41 uses in its EME
        // implementation.
        if (!this.sessionId) {
          this.closed.reject(new Error("The session is not callable."));
          return this.closed;
        }

        // This may throw an exception, but we ignore it because we are only using
        // it to clean up resources in v0.1b.  We still consider the session
        // closed. We can't let the exception propagate because
        // MediaKeySession.close() should not throw.
        const cancelKeyRequestName =
          PatchedMediaKeysWebkit.prefixApi_("cancelKeyRequest");
        try {
          this.media_[cancelKeyRequestName](this.keySystem_, this.sessionId);
        } catch (exception) {}
      }

      // Resolve the 'closed' promise and return it.
      this.closed.resolve();
      return this.closed;
    }

    /** @override */
    remove() {
      shaka.log.debug("PatchedMediaKeysWebkit.MediaKeySession.remove");
      if (this.type_ != "persistent-license") {
        return Promise.reject(new Error("Not a persistent session."));
      }
      return this.close();
    }
  }
}

namespace shaka.polyfill.PatchedMediaKeysWebkit {
  /**
   * An implementation of MediaKeyStatusMap.
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
        fn(this.status_, shaka.media.DrmEngine.DUMMY_KEY_ID.value());
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
      const fakeKeyId = shaka.media.DrmEngine.DUMMY_KEY_ID.value();
      if (this.status_ && shaka.util.BufferUtils.equal(keyId, fakeKeyId)) {
        return true;
      }
      return false;
    }

    /**
     * @suppress {missingReturn}
     * @override
     */
    entries() {
      goog.asserts.assert(false, "Not used!  Provided only for compiler.");
    }

    /**
     * @suppress {missingReturn}
     * @override
     */
    keys() {
      goog.asserts.assert(false, "Not used!  Provided only for compiler.");
    }

    /**
     * @suppress {missingReturn}
     * @override
     */
    values() {
      goog.asserts.assert(false, "Not used!  Provided only for compiler.");
    }
  }
}

namespace shaka.polyfill.PatchedMediaKeysWebkit {
  /**
   * Store api prefix.
   *
   */
  export const prefix_: string = "";
}
shaka.polyfill.register(shaka.polyfill.PatchedMediaKeysWebkit.install);
