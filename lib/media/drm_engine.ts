/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import {Transmuxer} from './dev-workspace.shaka-player-fork.lib.media.transmuxer';
import * as NetworkingEngineExports from './dev-workspace.shaka-player-fork.lib.net.networking_engine';
import {NetworkingEngine} from './dev-workspace.shaka-player-fork.lib.net.networking_engine';
import {BufferUtils} from './dev-workspace.shaka-player-fork.lib.util.buffer_utils';
import {Destroyer} from './dev-workspace.shaka-player-fork.lib.util.destroyer';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import * as EventManagerExports from './dev-workspace.shaka-player-fork.lib.util.event_manager';
import {EventManager} from './dev-workspace.shaka-player-fork.lib.util.event_manager';
import * as FakeEventExports from './dev-workspace.shaka-player-fork.lib.util.fake_event';
import {FakeEvent} from './dev-workspace.shaka-player-fork.lib.util.fake_event';
import {IDestroyable} from './dev-workspace.shaka-player-fork.lib.util.i_destroyable';
import {Iterables} from './dev-workspace.shaka-player-fork.lib.util.iterables';
import {Lazy} from './dev-workspace.shaka-player-fork.lib.util.lazy';
import {MapUtils} from './dev-workspace.shaka-player-fork.lib.util.map_utils';
import * as MimeUtilsExports from './dev-workspace.shaka-player-fork.lib.util.mime_utils';
import {MimeUtils} from './dev-workspace.shaka-player-fork.lib.util.mime_utils';
import * as PlatformExports from './dev-workspace.shaka-player-fork.lib.util.platform';
import {Platform} from './dev-workspace.shaka-player-fork.lib.util.platform';
import {PublicPromise} from './dev-workspace.shaka-player-fork.lib.util.public_promise';
import * as StreamUtilsExports from './dev-workspace.shaka-player-fork.lib.util.stream_utils';
import {StreamUtils} from './dev-workspace.shaka-player-fork.lib.util.stream_utils';
import * as StringUtilsExports from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {StringUtils} from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {Timer} from './dev-workspace.shaka-player-fork.lib.util.timer';
import {Uint8ArrayUtils} from './dev-workspace.shaka-player-fork.lib.util.uint8array_utils';

export class DrmEngine implements IDestroyable {
  private playerInterface_: PlayerInterface|null;
  private supportedTypes_: Set<string>;
  private mediaKeys_: MediaKeys = null;
  private video_: HTMLMediaElement = null;
  private initialized_: boolean = false;
  private initializedForStorage_: boolean = false;
  private licenseTimeSeconds_: number = 0;
  private currentDrmInfo_: shaka.extern.DrmInfo|null = null;
  private eventManager_: EventManager;

  /**
   * {!Map.<MediaKeySession,
   *           shaka.media.DrmEngine.SessionMetaData>}
   */
  private activeSessions_: Map<MediaKeySession, SessionMetaData>;
  private offlineSessionIds_: string[] = [];
  private allSessionsLoaded_: PublicPromise;
  private config_: shaka.extern.DrmConfiguration|null = null;
  private onError_: (p1: Error) => any;

  /**
   * The most recent key status information we have.
   * We may not have announced this information to the outside world yet,
   * which we delay to batch up changes and avoid spurious "missing key"
   * errors.
   */
  private keyStatusByKeyId_: Map<string, string>;

  /**
   * The key statuses most recently announced to other classes.
   * We may have more up-to-date information being collected in
   * this.keyStatusByKeyId_, which has not been batched up and released yet.
   */
  private announcedKeyStatusByKeyId_: Map<string, string>;
  private keyStatusTimer_: Timer;
  private usePersistentLicenses_: boolean = false;
  private mediaKeyMessageEvents_: MediaKeyMessageEvent[] = [];
  private initialRequestsSent_: boolean = false;
  private expirationTimer_: Timer|null;
  destroyer_: Destroyer;
  private srcEquals_: boolean = false;
  private mediaKeysAttached_: Promise = null;

  constructor(
      playerInterface: PlayerInterface, updateExpirationTime: number = 1) {
    this.playerInterface_ = playerInterface;
    this.supportedTypes_ = new Set();
    this.eventManager_ = new EventManager();
    this.activeSessions_ = new Map();
    this.allSessionsLoaded_ = new PublicPromise();
    this.onError_ = (err) => {
      this.allSessionsLoaded_.reject(err);
      playerInterface.onError(err);
    };
    this.keyStatusByKeyId_ = new Map();
    this.announcedKeyStatusByKeyId_ = new Map();
    this.keyStatusTimer_ = new Timer(() => this.processKeyStatusChanges_());
    this.expirationTimer_ = (new Timer(() => {
                              this.pollExpiration_();
                            }))
                                .tickEvery(
                                    /* seconds= */
                                    updateExpirationTime);

    // Add a catch to the Promise to avoid console logs about uncaught errors.
    const noop = () => {};
    this.allSessionsLoaded_.catch(noop);
    this.destroyer_ = new Destroyer(() => this.destroyNow_());
  }

  /** @override */
  destroy() {
    return this.destroyer_.destroy();
  }

  /**
   * Destroy this instance of DrmEngine. This assumes that all other checks
   * about "if it should" have passed.
   *
   */
  private async destroyNow_() {
    // |eventManager_| should only be |null| after we call |destroy|. Destroy it
    // first so that we will stop responding to events.
    this.eventManager_.release();
    this.eventManager_ = null;

    // Since we are destroying ourselves, we don't want to react to the "all
    // sessions loaded" event.
    this.allSessionsLoaded_.reject();

    // Stop all timers. This will ensure that they do not start any new work
    // while we are destroying ourselves.
    this.expirationTimer_.stop();
    this.expirationTimer_ = null;
    this.keyStatusTimer_.stop();
    this.keyStatusTimer_ = null;

    // Close all open sessions.
    await this.closeOpenSessions_();

    // |video_| will be |null| if we never attached to a video element.
    if (this.video_) {
      asserts.assert(!this.video_.src, 'video src must be removed first!');
      try {
        await this.video_.setMediaKeys(null);
      } catch (error) {
      }

      // Ignore any failures while removing media keys from the video element.
      this.video_ = null;
    }

    // Break references to everything else we hold internally.
    this.currentDrmInfo_ = null;
    this.supportedTypes_.clear();
    this.mediaKeys_ = null;
    this.offlineSessionIds_ = [];
    this.config_ = null;
    this.onError_ = () => {};
    this.playerInterface_ = null;
    this.srcEquals_ = false;
    this.mediaKeysAttached_ = null;
  }

  /**
   * Called by the Player to provide an updated configuration any time it
   * changes.
   * Must be called at least once before init().
   *
   */
  configure(config: shaka.extern.DrmConfiguration) {
    this.config_ = config;
  }

  setSrcEquals(value: boolean) {
    this.srcEquals_ = value;
  }

  /**
   * Initialize the drm engine for storing and deleting stored content.
   *
   *    The variants that are going to be stored.
   *    Whether or not persistent licenses should be requested and stored for
   *    |manifest|.
   */
  initForStorage(
      variants: shaka.extern.Variant[],
      usePersistentLicenses: boolean): Promise {
    this.initializedForStorage_ = true;

    // There are two cases for this call:
    //  1. We are about to store a manifest - in that case, there are no offline
    //     sessions and therefore no offline session ids.
    //  2. We are about to remove the offline sessions for this manifest - in
    //     that case, we don't need to know about them right now either as
    //     we will be told which ones to remove later.
    this.offlineSessionIds_ = [];

    // What we really need to know is whether or not they are expecting to use
    // persistent licenses.
    this.usePersistentLicenses_ = usePersistentLicenses;
    return this.init_(variants);
  }

  /**
   * Initialize the drm engine for playback operations.
   *
   *    The variants that we want to support playing.
   */
  initForPlayback(
      variants: shaka.extern.Variant[], offlineSessionIds: string[]): Promise {
    this.offlineSessionIds_ = offlineSessionIds;
    this.usePersistentLicenses_ = offlineSessionIds.length > 0;
    return this.init_(variants);
  }

  /**
   * Initializes the drm engine for removing persistent sessions.  Only the
   * removeSession(s) methods will work correctly, creating new sessions may not
   * work as desired.
   *
   */
  initForRemoval(
      keySystem: string, licenseServerUri: string,
      serverCertificate: Uint8Array,
      audioCapabilities: MediaKeySystemMediaCapability[],
      videoCapabilities: MediaKeySystemMediaCapability[]): Promise {
    const configsByKeySystem: Map<string, MediaKeySystemConfiguration> =
        new Map();
    const config: MediaKeySystemConfiguration = {
      audioCapabilities: audioCapabilities,
      videoCapabilities: videoCapabilities,
      distinctiveIdentifier: 'optional',
      persistentState: 'required',
      sessionTypes: ['persistent-license'],
      label: keySystem
    };

    // Tracked by us, ignored by EME.

    // TODO: refactor, don't stick drmInfos onto MediaKeySystemConfiguration
    config['drmInfos'] = [{
      // Non-standard attribute, ignored by EME.
      keySystem: keySystem,
      licenseServerUri: licenseServerUri,
      distinctiveIdentifierRequired: false,
      persistentStateRequired: true,
      audioRobustness: '',
      // Not required by queryMediaKeys_
      videoRobustness: '',
      // Same
      serverCertificate: serverCertificate,
      serverCertificateUri: '',
      initData: null,
      keyIds: null
    }];
    configsByKeySystem.set(keySystem, config);
    return this.queryMediaKeys_(
        configsByKeySystem,
        /* variants= */
        []);
  }

  /**
   * Negotiate for a key system and set up MediaKeys.
   * This will assume that both |usePersistentLicences_| and
   * |offlineSessionIds_| have been properly set.
   *
   *    The variants that we expect to operate with during the drm engine's
   *    lifespan of the drm engine.
   * @return Resolved if/when a key system has been chosen.
   */
  private async init_(variants: shaka.extern.Variant[]): Promise {
    asserts.assert(
        this.config_, 'DrmEngine configure() must be called before init()!');

    // ClearKey config overrides the manifest DrmInfo if present. The variants
    // are modified so that filtering in Player still works.
    // This comes before hadDrmInfo because it influences the value of that.
    const clearKeyDrmInfo: shaka.extern.DrmInfo|null =
        this.configureClearKey_();
    if (clearKeyDrmInfo) {
      for (const variant of variants) {
        if (variant.video) {
          variant.video.drmInfos = [clearKeyDrmInfo];
        }
        if (variant.audio) {
          variant.audio.drmInfos = [clearKeyDrmInfo];
        }
      }
    }
    const hadDrmInfo = variants.some((variant) => {
      if (variant.video && variant.video.drmInfos.length) {
        return true;
      }
      if (variant.audio && variant.audio.drmInfos.length) {
        return true;
      }
      return false;
    });

    // When preparing to play live streams, it is possible that we won't know
    // about some upcoming encrypted content. If we initialize the drm engine
    // with no key systems, we won't be able to play when the encrypted content
    // comes.
    // To avoid this, we will set the drm engine up to work with as many key
    // systems as possible so that we will be ready.
    if (!hadDrmInfo) {
      const servers = MapUtils.asMap(this.config_.servers);
      DrmEngine.replaceDrmInfo_(variants, servers);
    }

    // Make sure all the drm infos are valid and filled in correctly.
    for (const variant of variants) {
      const drmInfos = this.getVariantDrmInfos_(variant);
      for (const info of drmInfos) {
        DrmEngine.fillInDrmInfoDefaults_(
            info, MapUtils.asMap(this.config_.servers),
            MapUtils.asMap(this.config_.advanced || {}),
            this.config_.keySystemsMapping);
      }
    }
    let configsByKeySystem: Map<string, MediaKeySystemConfiguration>;

    // We should get the decodingInfo results for the variants after we filling
    // in the drm infos, and before queryMediaKeys_().
    await StreamUtils.getDecodingInfosForVariants(
        variants, this.usePersistentLicenses_, this.srcEquals_);
    const hasDrmInfo = hadDrmInfo || Object.keys(this.config_.servers).length;

    // An unencrypted content is initialized.
    if (!hasDrmInfo) {
      this.initialized_ = true;
      return Promise.resolve();
    }
    const p = this.queryMediaKeys_(configsByKeySystem, variants);

    // TODO(vaage): Look into the assertion below. If we do not have any drm
    // info, we create drm info so that content can play if it has drm info
    // later.
    // However it is okay if we fail to initialize? If we fail to initialize,
    // it means we won't be able to play the later-encrypted content, which is
    // not okay.

    // If the content did not originally have any drm info, then it doesn't
    // matter if we fail to initialize the drm engine, because we won't need it
    // anyway.
    return hadDrmInfo ? p : p.catch(() => {});
  }

  /**
   * Attach MediaKeys to the video element
   */
  private async attachMediaKeys_(): Promise {
    if (this.video_.mediaKeys) {
      return;
    }

    // An attach process has already started, let's wait it out
    if (this.mediaKeysAttached_) {
      await this.mediaKeysAttached_;
      return;
    }
    try {
      this.mediaKeysAttached_ = this.video_.setMediaKeys(this.mediaKeys_);
      await this.mediaKeysAttached_;
    } catch (exception) {
      asserts.assert(exception instanceof Error, 'Wrong error type!');
      this.onError_(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.FAILED_TO_ATTACH_TO_VIDEO, exception.message));
    }
    this.destroyer_.ensureNotDestroyed();
  }

  /**
   * Processes encrypted event and start licence challenging
   */
  private async onEncryptedEvent_(event): Promise {
    /**
     * MediaKeys should be added when receiving an encrypted event. Setting
     * mediaKeys before could result into encrypted event not being fired on
     * some browsers
     */
    await this.attachMediaKeys_();
    this.newInitData(event.initDataType, BufferUtils.toUint8(event.initData));
  }

  /**
   * Start processing events.
   */
  async attach(video: HTMLMediaElement): Promise {
    if (!this.mediaKeys_) {
      // Unencrypted, or so we think.  We listen for encrypted events in order
      // to warn when the stream is encrypted, even though the manifest does
      // not know it.
      // Don't complain about this twice, so just listenOnce().
      // FIXME: This is ineffective when a prefixed event is translated by our
      // polyfills, since those events are only caught and translated by a
      // MediaKeys instance.  With clear content and no polyfilled MediaKeys
      // instance attached, you'll never see the 'encrypted' event on those
      // platforms (Safari).
      this.eventManager_.listenOnce(video, 'encrypted', (event) => {
        this.onError_(new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
            ErrorExports.Code.ENCRYPTED_CONTENT_WITHOUT_DRM_INFO));
      });
      return;
    }
    this.video_ = video;
    this.eventManager_.listenOnce(this.video_, 'play', () => this.onPlay_());
    if ('webkitCurrentPlaybackTargetIsWireless' in this.video_) {
      this.eventManager_.listen(
          this.video_, 'webkitcurrentplaybacktargetiswirelesschanged',
          () => this.closeOpenSessions_());
    }
    const manifestInitData = this.currentDrmInfo_.initData.find(
        (initDataOverride) => initDataOverride.initData.length > 0);

    /**
     * We can attach media keys before the playback actually begins when:
     *  - Using legacy implementations requires MediaKeys to be set before
     *    having webkitneedkey / msneedkey event, which will be translated as
     *    an encrypted event by the polyfills
     *  - Some initData already has been generated (through the manifest)
     *  - In case of an offline session
     */
    if (manifestInitData || Platform.isMediaKeysPolyfilled() ||
        this.offlineSessionIds_.length) {
      await this.attachMediaKeys_();
    }
    this.createOrLoad();

    // Explicit init data for any one stream or an offline session is
    // sufficient to suppress 'encrypted' events for all streams.
    if (!manifestInitData && !this.offlineSessionIds_.length) {
      this.eventManager_.listen(
          this.video_, 'encrypted', (e) => this.onEncryptedEvent_(e));
    }
  }

  /**
   * Sets the server certificate based on the current DrmInfo.
   *
   */
  async setServerCertificate(): Promise {
    asserts.assert(
        this.initialized_, 'Must call init() before setServerCertificate');
    if (!this.mediaKeys_ || !this.currentDrmInfo_) {
      return;
    }
    if (this.currentDrmInfo_.serverCertificateUri &&
        (!this.currentDrmInfo_.serverCertificate ||
         !this.currentDrmInfo_.serverCertificate.length)) {
      const request = NetworkingEngine.makeRequest(
          [this.currentDrmInfo_.serverCertificateUri],
          this.config_.retryParameters);
      try {
        const operation = this.playerInterface_.netEngine.request(
            NetworkingEngineExports.RequestType.SERVER_CERTIFICATE, request);
        const response = await operation.promise;
        this.currentDrmInfo_.serverCertificate =
            BufferUtils.toUint8(response.data);
      } catch (error) {
        // Request failed!
        asserts.assert(
            error instanceof Error, 'Wrong NetworkingEngine error type!');
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
            ErrorExports.Code.SERVER_CERTIFICATE_REQUEST_FAILED, error);
      }
      if (this.destroyer_.destroyed()) {
        return;
      }
    }
    if (!this.currentDrmInfo_.serverCertificate ||
        !this.currentDrmInfo_.serverCertificate.length) {
      return;
    }
    try {
      const supported = await this.mediaKeys_.setServerCertificate(
          this.currentDrmInfo_.serverCertificate);
      if (!supported) {
        log.warning(
            'Server certificates are not supported by the ' +
            'key system.  The server certificate has been ' +
            'ignored.');
      }
    } catch (exception) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.INVALID_SERVER_CERTIFICATE, exception.message);
    }
  }

  /**
   * Remove an offline session and delete it's data. This can only be called
   * after a successful call to |init|. This will wait until the
   * 'license-release' message is handled. The returned Promise will be rejected
   * if there is an error releasing the license.
   *
   */
  async removeSession(sessionId: string): Promise {
    asserts.assert(this.mediaKeys_, 'Must call init() before removeSession');
    const session = await this.loadOfflineSession_(sessionId);

    // This will be null on error, such as session not found.
    if (!session) {
      log.v2('Ignoring attempt to remove missing session', sessionId);
      return;
    }

    // TODO: Consider adding a timeout to get the 'message' event.
    // Note that the 'message' event will get raised after the remove()
    // promise resolves.
    const tasks = [];
    const found = this.activeSessions_.get(session);
    if (found) {
      // This will force us to wait until the 'license-release' message has been
      // handled.
      found.updatePromise = new PublicPromise();
      tasks.push(found.updatePromise);
    }
    log.v2('Attempting to remove session', sessionId);
    tasks.push(session.remove());
    await Promise.all(tasks);
    this.activeSessions_.delete(session);
  }

  /**
   * Creates the sessions for the init data and waits for them to become ready.
   *
   */
  createOrLoad(): Promise {
    // Create temp sessions.
    const initDatas =
        (this.currentDrmInfo_ ? this.currentDrmInfo_.initData : []) || [];
    for (const initDataOverride of initDatas) {
      this.newInitData(
          initDataOverride.initDataType, initDataOverride.initData);
    }

    // Load each session.
    for (const sessionId of this.offlineSessionIds_) {
      this.loadOfflineSession_(sessionId);
    }

    // If we have no sessions, we need to resolve the promise right now or else
    // it will never get resolved.
    if (!initDatas.length && !this.offlineSessionIds_.length) {
      this.allSessionsLoaded_.resolve();
    }
    return this.allSessionsLoaded_;
  }

  /**
   * Called when new initialization data is encountered.  If this data hasn't
   * been seen yet, this will create a new session for it.
   *
   */
  newInitData(initDataType: string, initData: Uint8Array) {
    if (!initData.length) {
      return;
    }

    // Suppress duplicate init data.
    // Note that some init data are extremely large and can't portably be used
    // as keys in a dictionary.
    const metadatas = this.activeSessions_.values();
    for (const metadata of metadatas) {
      // Tizen 2015 and 2016 models will send multiple webkitneedkey events
      // with the same init data. If the duplicates are supressed, playback
      // will stall without errors.
      if (BufferUtils.equal(initData, metadata.initData) &&
          !Platform.isTizen2()) {
        log.debug('Ignoring duplicate init data.');
        return;
      }
    }
    this.createSession(
        initDataType, initData, this.currentDrmInfo_.sessionType);
  }

  initialized(): boolean {
    return this.initialized_;
  }

  static keySystem(drmInfo: shaka.extern.DrmInfo|null): string {
    return drmInfo ? drmInfo.keySystem : '';
  }

  static isPlayReadyKeySystem(keySystem: string|null): boolean {
    if (keySystem) {
      return !!keySystem.match(/^com\.(microsoft|chromecast)\.playready/);
    }
    return false;
  }

  static isFairPlayKeySystem(keySystem: string|null): boolean {
    if (keySystem) {
      return !!keySystem.match(/^com\.apple\.fps/);
    }
    return false;
  }

  /**
   * Check if DrmEngine (as initialized) will likely be able to support the
   * given content type.
   *
   */
  willSupport(contentType: string): boolean {
    // Edge 14 does not report correct capabilities.  It will only report the
    // first MIME type even if the others are supported.  To work around this,
    // we say that Edge supports everything.
    // See https://github.com/shaka-project/shaka-player/issues/1495 for
    // details.
    if (Platform.isLegacyEdge()) {
      return true;
    }
    contentType = contentType.toLowerCase();
    if (Platform.isTizen() && contentType.includes('codecs="ac-3"')) {
      // Some Tizen devices seem to misreport AC-3 support.  This works around
      // the issue, by falling back to EC-3, which seems to be supported on the
      // same devices and be correctly reported in all cases we have observed.
      // See https://github.com/shaka-project/shaka-player/issues/2989 for
      // details.
      const fallback = contentType.replace('ac-3', 'ec-3');
      return this.supportedTypes_.has(contentType) ||
          this.supportedTypes_.has(fallback);
    }
    return this.supportedTypes_.has(contentType);
  }

  /**
   * Returns the ID of the sessions currently active.
   *
   */
  getSessionIds(): string[] {
    const sessions = this.activeSessions_.keys();
    const ids = Iterables.map(sessions, (s) => s.sessionId);

    // TODO: Make |getSessionIds| return |Iterable| instead of |Array|.
    return Array.from(ids);
  }

  /**
   * Returns the next expiration time, or Infinity.
   */
  getExpiration(): number {
    // This will equal Infinity if there are no entries.
    let min = Infinity;
    const sessions = this.activeSessions_.keys();
    for (const session of sessions) {
      if (!isNaN(session.expiration)) {
        min = Math.min(min, session.expiration);
      }
    }
    return min;
  }

  /**
   * Returns the time spent on license requests during this session, or NaN.
   *
   */
  getLicenseTime(): number {
    if (this.licenseTimeSeconds_) {
      return this.licenseTimeSeconds_;
    }
    return NaN;
  }

  /**
   * Returns the DrmInfo that was used to initialize the current key system.
   *
   */
  getDrmInfo(): shaka.extern.DrmInfo|null {
    return this.currentDrmInfo_;
  }

  /**
   * Return the media keys created from the current mediaKeySystemAccess.
   */
  getMediaKeys(): MediaKeys {
    return this.mediaKeys_;
  }

  /**
   * Returns the current key statuses.
   *
   */
  getKeyStatuses(): {[key: string]: string} {
    return MapUtils.asObject(this.announcedKeyStatusByKeyId_);
  }

  /**
   * Returns the current media key sessions.
   *
   */
  getMediaKeySessions(): MediaKeySession[] {
    return Array.from(this.activeSessions_.keys());
  }

  private static computeMimeType_(
      stream: shaka.extern.Stream, codecOverride?: string): string {
    const realMimeType =
        MimeUtils.getFullType(stream.mimeType, codecOverride || stream.codecs);
    if (Transmuxer.isSupported(realMimeType)) {
      // This will be handled by the Transmuxer, so use the MIME type that the
      // Transmuxer will produce.
      return Transmuxer.convertTsCodecs(stream.type, realMimeType);
    }
    return realMimeType;
  }

  /**
   *   A dictionary of configs, indexed by key system, with an iteration order
   *   (insertion order) that reflects the preference for the application.
   * @return Resolved if/when a key system has been chosen.
   */
  private async queryMediaKeys_(
      configsByKeySystem: Map<string, MediaKeySystemConfiguration>,
      variants: shaka.extern.Variant[]): Promise {
    const drmInfosByKeySystem = new Map();
    const mediaKeySystemAccess = variants.length ?
        this.getKeySystemAccessFromVariants_(variants, drmInfosByKeySystem) :
        await this.getKeySystemAccessByConfigs_(configsByKeySystem);
    if (!mediaKeySystemAccess) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE);
    }
    this.destroyer_.ensureNotDestroyed();
    try {
      // Get the set of supported content types from the audio and video
      // capabilities. Avoid duplicates so that it is easier to read what is
      // supported.
      this.supportedTypes_.clear();

      // Store the capabilities of the key system.
      const realConfig = mediaKeySystemAccess.getConfiguration();
      log.v2('Got MediaKeySystemAccess with configuration', realConfig);
      const audioCaps = realConfig.audioCapabilities || [];
      const videoCaps = realConfig.videoCapabilities || [];
      for (const cap of audioCaps) {
        this.supportedTypes_.add(cap.contentType.toLowerCase());
      }
      for (const cap of videoCaps) {
        this.supportedTypes_.add(cap.contentType.toLowerCase());
      }
      asserts.assert(
          this.supportedTypes_.size,
          'We should get at least one supported MIME type');
      if (variants.length) {
        this.currentDrmInfo_ = this.createDrmInfoByInfos_(
            mediaKeySystemAccess.keySystem,
            drmInfosByKeySystem.get(mediaKeySystemAccess.keySystem));
      } else {
        this.currentDrmInfo_ = DrmEngine.createDrmInfoByConfigs_(
            mediaKeySystemAccess.keySystem,
            configsByKeySystem.get(mediaKeySystemAccess.keySystem));
      }
      if (!this.currentDrmInfo_.licenseServerUri) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
            ErrorExports.Code.NO_LICENSE_SERVER_GIVEN,
            this.currentDrmInfo_.keySystem);
      }
      const mediaKeys = await mediaKeySystemAccess.createMediaKeys();
      this.destroyer_.ensureNotDestroyed();
      log.info(
          'Created MediaKeys object for key system',
          this.currentDrmInfo_.keySystem);
      this.mediaKeys_ = mediaKeys;
      this.initialized_ = true;
      await this.setServerCertificate();
      this.destroyer_.ensureNotDestroyed();
    } catch (exception) {
      this.destroyer_.ensureNotDestroyed(exception);

      // Don't rewrap a shaka.util.Error from earlier in the chain:
      this.currentDrmInfo_ = null;
      this.supportedTypes_.clear();
      if (exception instanceof Error) {
        throw exception;
      }

      // We failed to create MediaKeys.  This generally shouldn't happen.
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.FAILED_TO_CREATE_CDM, exception.message);
    }
  }

  /**
   * Get the MediaKeySystemAccess from the decodingInfos of the variants.
   *   A dictionary of drmInfos, indexed by key system.
   */
  private getKeySystemAccessFromVariants_(
      variants: shaka.extern.Variant[],
      drmInfosByKeySystem: Map<string, shaka.extern.DrmInfo[]>):
      MediaKeySystemAccess {
    for (const variant of variants) {
      // Get all the key systems in the variant that shouldHaveLicenseServer.
      const drmInfos = this.getVariantDrmInfos_(variant);
      for (const info of drmInfos) {
        if (!drmInfosByKeySystem.has(info.keySystem)) {
          drmInfosByKeySystem.set(info.keySystem, []);
        }
        drmInfosByKeySystem.get(info.keySystem).push(info);
      }
    }
    if (drmInfosByKeySystem.size == 1 && drmInfosByKeySystem.has('')) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.NO_RECOGNIZED_KEY_SYSTEMS);
    }

    // If we have configured preferredKeySystems, choose a preferred keySystem
    // if available.
    for (const preferredKeySystem of this.config_.preferredKeySystems) {
      for (const variant of variants) {
        const decodingInfo = variant.decodingInfos.find((decodingInfo) => {
          return decodingInfo.supported &&
              decodingInfo.keySystemAccess != null &&
              decodingInfo.keySystemAccess.keySystem == preferredKeySystem;
        });
        if (decodingInfo) {
          return decodingInfo.keySystemAccess;
        }
      }
    }

    // Try key systems with configured license servers first.  We only have to
    // try key systems without configured license servers for diagnostic
    // reasons, so that we can differentiate between "none of these key
    // systems are available" and "some are available, but you did not
    // configure them properly."  The former takes precedence.
    for (const shouldHaveLicenseServer of [true, false]) {
      for (const variant of variants) {
        for (const decodingInfo of variant.decodingInfos) {
          if (!decodingInfo.supported || !decodingInfo.keySystemAccess) {
            continue;
          }
          const drmInfos =
              drmInfosByKeySystem.get(decodingInfo.keySystemAccess.keySystem);
          for (const info of drmInfos) {
            if (!!info.licenseServerUri == shouldHaveLicenseServer) {
              return decodingInfo.keySystemAccess;
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Get the MediaKeySystemAccess by querying requestMediaKeySystemAccess.
   *   A dictionary of configs, indexed by key system, with an iteration order
   *   (insertion order) that reflects the preference for the application.
   * @return Resolved if/when a
   *   mediaKeySystemAccess has been chosen.
   */
  private async getKeySystemAccessByConfigs_(
      configsByKeySystem: Map<string, MediaKeySystemConfiguration>):
      Promise<MediaKeySystemAccess> {
    let mediaKeySystemAccess: MediaKeySystemAccess;
    if (configsByKeySystem.size == 1 && configsByKeySystem.has('')) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.NO_RECOGNIZED_KEY_SYSTEMS);
    }

    // If there are no tracks of a type, these should be not present.
    // Otherwise the query will fail.
    for (const config of configsByKeySystem.values()) {
      if (config.audioCapabilities.length == 0) {
        delete config.audioCapabilities;
      }
      if (config.videoCapabilities.length == 0) {
        delete config.videoCapabilities;
      }
    }

    // If we have configured preferredKeySystems, choose the preferred one if
    // available.
    for (const keySystem of this.config_.preferredKeySystems) {
      if (configsByKeySystem.has(keySystem)) {
        const config = configsByKeySystem.get(keySystem);
        try {
          mediaKeySystemAccess =
              // eslint-disable-next-line no-await-in-loop
              await navigator.requestMediaKeySystemAccess(keySystem, [config]);
          return mediaKeySystemAccess;
        } catch (error) {
          // Suppress errors.
          log.v2('Requesting', keySystem, 'failed with config', config, error);
        }
        this.destroyer_.ensureNotDestroyed();
      }
    }

    // Try key systems with configured license servers first.  We only have to
    // try key systems without configured license servers for diagnostic
    // reasons, so that we can differentiate between "none of these key
    // systems are available" and "some are available, but you did not
    // configure them properly."  The former takes precedence.
    // TODO: once MediaCap implementation is complete, this part can be
    // simplified or removed.
    for (const shouldHaveLicenseServer of [true, false]) {
      for (const keySystem of configsByKeySystem.keys()) {
        const config = configsByKeySystem.get(keySystem);

        // TODO: refactor, don't stick drmInfos onto
        // MediaKeySystemConfiguration
        const hasLicenseServer = config['drmInfos'].some((info) => {
          return !!info.licenseServerUri;
        });
        if (hasLicenseServer != shouldHaveLicenseServer) {
          continue;
        }
        try {
          mediaKeySystemAccess =
              // eslint-disable-next-line no-await-in-loop
              await navigator.requestMediaKeySystemAccess(keySystem, [config]);
          return mediaKeySystemAccess;
        } catch (error) {
          // Suppress errors.
          log.v2('Requesting', keySystem, 'failed with config', config, error);
        }
        this.destroyer_.ensureNotDestroyed();
      }
    }
    return mediaKeySystemAccess;
  }

  /**
   * Create a DrmInfo using configured clear keys.
   * The server URI will be a data URI which decodes to a clearkey license.
   * @return or null if clear keys are not configured.
   * @see https://bit.ly/2K8gOnv for the spec on the clearkey license format.
   */
  private configureClearKey_(): shaka.extern.DrmInfo|null {
    const clearKeys = MapUtils.asMap(this.config_.clearKeys);
    if (clearKeys.size == 0) {
      return null;
    }
    const StringUtils = StringUtils;
    const Uint8ArrayUtils = Uint8ArrayUtils;
    const keys = [];
    const keyIds = [];
    clearKeys.forEach((keyHex, keyIdHex) => {
      const keyId = Uint8ArrayUtils.fromHex(keyIdHex);
      const key = Uint8ArrayUtils.fromHex(keyHex);
      const keyObj = {
        kty: 'oct',
        kid: Uint8ArrayUtils.toBase64(keyId, false),
        k: Uint8ArrayUtils.toBase64(key, false)
      };
      keys.push(keyObj);
      keyIds.push(keyObj.kid);
    });
    const jwkSet = {keys: keys};
    const license = JSON.stringify(jwkSet);

    // Use the keyids init data since is suggested by EME.
    // Suggestion: https://bit.ly/2JYcNTu
    // Format: https://www.w3.org/TR/eme-initdata-keyids/
    const initDataStr = JSON.stringify({'kids': keyIds});
    const initData = BufferUtils.toUint8(StringUtils.toUTF8(initDataStr));
    const initDatas = [{initData: initData, initDataType: 'keyids'}];
    return {
      keySystem: 'org.w3.clearkey',
      licenseServerUri: 'data:application/json;base64,' + window.btoa(license),
      distinctiveIdentifierRequired: false,
      persistentStateRequired: false,
      audioRobustness: '',
      videoRobustness: '',
      serverCertificate: null,
      serverCertificateUri: '',
      sessionType: '',
      initData: initDatas,
      keyIds: new Set(keyIds)
    };
  }

  private async loadOfflineSession_(sessionId: string):
      Promise<MediaKeySession> {
    let session;
    const sessionType = 'persistent-license';
    try {
      log.v1('Attempting to load an offline session', sessionId);
      session = this.mediaKeys_.createSession(sessionType);
    } catch (exception) {
      const error = new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.FAILED_TO_CREATE_SESSION, exception.message);
      this.onError_(error);
      return Promise.reject(error);
    }
    this.eventManager_.listen(
        session, 'message',
        ((event) => this.onSessionMessage_(event) as
             EventManagerExports.ListenerType));
    this.eventManager_.listen(
        session, 'keystatuseschange',
        (event) => this.onKeyStatusesChange_(event));
    const metadata = {
      initData: null,
      initDataType: null,
      loaded: false,
      oldExpiration: Infinity,
      updatePromise: null,
      type: sessionType
    };
    this.activeSessions_.set(session, metadata);
    try {
      const present = await session.load(sessionId);
      this.destroyer_.ensureNotDestroyed();
      log.v2('Loaded offline session', sessionId, present);
      if (!present) {
        this.activeSessions_.delete(session);
        this.onError_(new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
            ErrorExports.Code.OFFLINE_SESSION_REMOVED));
        return Promise.resolve();
      }

      // TODO: We should get a key status change event.  Remove once Chrome CDM
      // is fixed.
      metadata.loaded = true;
      if (this.areAllSessionsLoaded_()) {
        this.allSessionsLoaded_.resolve();
      }
      return session;
    } catch (error) {
      this.destroyer_.ensureNotDestroyed(error);
      this.activeSessions_.delete(session);
      this.onError_(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.FAILED_TO_CREATE_SESSION, error.message));
    }
    return Promise.resolve();
  }

  createSession(
      initDataType: string, initData: Uint8Array, sessionType: string) {
    asserts.assert(
        this.mediaKeys_,
        'mediaKeys_ should be valid when creating temporary session.');
    let session;
    try {
      log.info('Creating new', sessionType, 'session');
      session = this.mediaKeys_.createSession(sessionType);
    } catch (exception) {
      this.onError_(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.FAILED_TO_CREATE_SESSION, exception.message));
      return;
    }
    this.eventManager_.listen(
        session, 'message',
        ((event) => this.onSessionMessage_(event) as
             EventManagerExports.ListenerType));
    this.eventManager_.listen(
        session, 'keystatuseschange',
        (event) => this.onKeyStatusesChange_(event));
    const metadata = {
      initData: initData,
      initDataType: initDataType,
      loaded: false,
      oldExpiration: Infinity,
      updatePromise: null,
      type: sessionType
    };
    this.activeSessions_.set(session, metadata);
    try {
      initData = this.config_.initDataTransform(
          initData, initDataType, this.currentDrmInfo_);
    } catch (error) {
      let shakaError = error;
      if (!(error instanceof Error)) {
        shakaError = new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
            ErrorExports.Code.INIT_DATA_TRANSFORM_ERROR, error);
      }
      this.onError_(shakaError);
      return;
    }
    if (this.config_.logLicenseExchange) {
      const str = Uint8ArrayUtils.toBase64(initData);
      log.info('EME init data: type=', initDataType, 'data=', str);
    }
    session.generateRequest(initDataType, initData).catch((error) => {
      if (this.destroyer_.destroyed()) {
        return;
      }
      asserts.assert(error instanceof Error, 'Wrong error type!');
      this.activeSessions_.delete(session);

      // This may be supplied by some polyfills.
      const errorCode: MediaKeyError = error['errorCode'];
      let extended;
      if (errorCode && errorCode.systemCode) {
        extended = errorCode.systemCode;
        if (extended < 0) {
          extended += Math.pow(2, 32);
        }
        extended = '0x' + extended.toString(16);
      }
      this.onError_(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.FAILED_TO_GENERATE_LICENSE_REQUEST, error.message,
          error, extended));
    });
  }

  private onSessionMessage_(event: MediaKeyMessageEvent) {
    if (this.delayLicenseRequest_()) {
      this.mediaKeyMessageEvents_.push(event);
    } else {
      this.sendLicenseRequest_(event);
    }
  }

  private delayLicenseRequest_(): boolean {
    if (!this.video_) {
      // If there's no video, don't delay the license request; i.e., in the case
      // of offline storage.
      return false;
    }
    return this.config_.delayLicenseRequestUntilPlayed && this.video_.paused &&
        !this.initialRequestsSent_;
  }

  /**
   * Sends a license request.
   */
  private async sendLicenseRequest_(event: MediaKeyMessageEvent) {
    const session: MediaKeySession = event.target;
    log.v1(
        'Sending license request for session', session.sessionId, 'of type',
        event.messageType);
    if (this.config_.logLicenseExchange) {
      const str = Uint8ArrayUtils.toBase64(event.message);
      log.info('EME license request', str);
    }
    const metadata = this.activeSessions_.get(session);
    let url = this.currentDrmInfo_.licenseServerUri;
    const advancedConfig =
        this.config_.advanced[this.currentDrmInfo_.keySystem];
    if (event.messageType == 'individualization-request' && advancedConfig &&
        advancedConfig.individualizationServer) {
      url = advancedConfig.individualizationServer;
    }
    const requestType = NetworkingEngineExports.RequestType.LICENSE;
    const request =
        NetworkingEngine.makeRequest([url], this.config_.retryParameters);
    request.body = event.message;
    request.method = 'POST';
    request.licenseRequestType = event.messageType;
    request.sessionId = session.sessionId;
    request.drmInfo = this.currentDrmInfo_;
    if (metadata) {
      request.initData = metadata.initData;
      request.initDataType = metadata.initDataType;
    }

    // NOTE: allowCrossSiteCredentials can be set in a request filter.
    if (DrmEngine.isPlayReadyKeySystem(this.currentDrmInfo_.keySystem)) {
      this.unpackPlayReadyRequest_(request);
    }
    const startTimeRequest = Date.now();
    let response;
    try {
      const req = this.playerInterface_.netEngine.request(requestType, request);
      response = await req.promise;
    } catch (error) {
      // Request failed!
      asserts.assert(
          error instanceof Error, 'Wrong NetworkingEngine error type!');
      const shakaErr = new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.LICENSE_REQUEST_FAILED, error);
      this.onError_(shakaErr);
      if (metadata && metadata.updatePromise) {
        metadata.updatePromise.reject(shakaErr);
      }
      return;
    }
    if (this.destroyer_.destroyed()) {
      return;
    }
    this.licenseTimeSeconds_ += (Date.now() - startTimeRequest) / 1000;
    if (this.config_.logLicenseExchange) {
      const str = Uint8ArrayUtils.toBase64(response.data);
      log.info('EME license response', str);
    }

    // Request succeeded, now pass the response to the CDM.
    try {
      log.v1('Updating session', session.sessionId);
      await session.update(response.data);
    } catch (error) {
      // Session update failed!
      const shakaErr = new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.LICENSE_RESPONSE_REJECTED, error.message);
      this.onError_(shakaErr);
      if (metadata && metadata.updatePromise) {
        metadata.updatePromise.reject(shakaErr);
      }
      return;
    }
    if (this.destroyer_.destroyed()) {
      return;
    }
    const updateEvent = new FakeEvent('drmsessionupdate');
    this.playerInterface_.onEvent(updateEvent);
    if (metadata) {
      if (metadata.updatePromise) {
        metadata.updatePromise.resolve();
      }

      // In case there are no key statuses, consider this session loaded
      // after a reasonable timeout.  It should definitely not take 5
      // seconds to process a license.
      const timer = new Timer(() => {
        metadata.loaded = true;
        if (this.areAllSessionsLoaded_()) {
          this.allSessionsLoaded_.resolve();
        }
      });
      timer.tickAfter(SESSION_LOAD_TIMEOUT_);
    }
  }

  /**
   * Unpacks PlayReady license requests.  Modifies the request object.
   */
  private unpackPlayReadyRequest_(request: shaka.extern.Request) {
    // On Edge, the raw license message is UTF-16-encoded XML.  We need
    // to unpack the Challenge element (base64-encoded string containing the
    // actual license request) and any HttpHeader elements (sent as request
    // headers).

    // Example XML:

    // <PlayReadyKeyMessage type="LicenseAcquisition">
    //   <LicenseAcquisition Version="1">
    //     <Challenge encoding="base64encoded">{Base64Data}</Challenge>
    //     <HttpHeaders>
    //       <HttpHeader>
    //         <name>Content-Type</name>
    //         <value>text/xml; charset=utf-8</value>
    //       </HttpHeader>
    //       <HttpHeader>
    //         <name>SOAPAction</name>
    //         <value>http://schemas.microsoft.com/DRM/etc/etc</value>
    //       </HttpHeader>
    //     </HttpHeaders>
    //   </LicenseAcquisition>
    // </PlayReadyKeyMessage>
    const xml = StringUtils.fromUTF16(
        request.body,
        /* littleEndian= */
        true,
        /* noThrow= */
        true);
    if (!xml.includes('PlayReadyKeyMessage')) {
      // This does not appear to be a wrapped message as on Edge.  Some
      // clients do not need this unwrapping, so we will assume this is one of
      // them.  Note that "xml" at this point probably looks like random
      // garbage, since we interpreted UTF-8 as UTF-16.
      log.debug('PlayReady request is already unwrapped.');
      request.headers['Content-Type'] = 'text/xml; charset=utf-8';
      return;
    }
    log.debug('Unwrapping PlayReady request.');
    const dom = (new DOMParser()).parseFromString(xml, 'application/xml');

    // Set request headers.
    const headers = dom.getElementsByTagName('HttpHeader');
    for (const header of headers) {
      const name = header.getElementsByTagName('name')[0];
      const value = header.getElementsByTagName('value')[0];
      asserts.assert(name && value, 'Malformed PlayReady headers!');
      request.headers[name.textContent] = value.textContent;
    }

    // Unpack the base64-encoded challenge.
    const challenge = dom.getElementsByTagName('Challenge')[0];
    asserts.assert(challenge, 'Malformed PlayReady challenge!');
    asserts.assert(
        challenge.getAttribute('encoding') == 'base64encoded',
        'Unexpected PlayReady challenge encoding!');
    request.body = Uint8ArrayUtils.fromBase64(challenge.textContent);
  }

  /**
   * @suppress {invalidCasts} to swap keyId and status
   */
  private onKeyStatusesChange_(event: Event) {
    const session = (event.target as MediaKeySession);
    log.v2('Key status changed for session', session.sessionId);
    const found = this.activeSessions_.get(session);
    const keyStatusMap = session.keyStatuses;
    let hasExpiredKeys = false;
    keyStatusMap.forEach((status, keyId) => {
      // The spec has changed a few times on the exact order of arguments here.
      // As of 2016-06-30, Edge has the order reversed compared to the current
      // EME spec.  Given the back and forth in the spec, it may not be the only
      // one.  Try to detect this and compensate:
      if (typeof keyId == 'string') {
        const tmp = keyId;
        keyId = (status as ArrayBuffer);
        status = (tmp as string);
      }

      // Microsoft's implementation in Edge seems to present key IDs as
      // little-endian UUIDs, rather than big-endian or just plain array of
      // bytes.
      // standard: 6e 5a 1d 26 - 27 57 - 47 d7 - 80 46 ea a5 d1 d3 4b 5a
      // on Edge:  26 1d 5a 6e - 57 27 - d7 47 - 80 46 ea a5 d1 d3 4b 5a
      // Bug filed: https://bit.ly/2thuzXu

      // NOTE that we skip this if byteLength != 16.  This is used for Edge
      // which uses single-byte dummy key IDs.
      // However, unlike Edge and Chromecast, Tizen doesn't have this problem.
      if (DrmEngine.isPlayReadyKeySystem(this.currentDrmInfo_.keySystem) &&
          keyId.byteLength == 16 && (Platform.isEdge() || Platform.isPS4())) {
        // Read out some fields in little-endian:
        const dataView = BufferUtils.toDataView(keyId);
        const part0 = dataView.getUint32(
            0,
            /* LE= */
            true);
        const part1 = dataView.getUint16(
            4,
            /* LE= */
            true);
        const part2 = dataView.getUint16(
            6,
            /* LE= */
            true);

        // Write it back in big-endian:
        dataView.setUint32(
            0, part0,
            /* BE= */
            false);
        dataView.setUint16(
            4, part1,
            /* BE= */
            false);
        dataView.setUint16(
            6, part2,
            /* BE= */
            false);
      }
      if (status != 'status-pending') {
        found.loaded = true;
      }
      if (!found) {
        // We can get a key status changed for a closed session after it has
        // been removed from |activeSessions_|.  If it is closed, none of its
        // keys should be usable.
        asserts.assert(
            status != 'usable', 'Usable keys found in closed session');
      }
      if (status == 'expired') {
        hasExpiredKeys = true;
      }
      const keyIdHex = Uint8ArrayUtils.toHex(keyId);
      this.keyStatusByKeyId_.set(keyIdHex, status);
    });

    // If the session has expired, close it.
    // Some CDMs do not have sub-second time resolution, so the key status may
    // fire with hundreds of milliseconds left until the stated expiration time.
    const msUntilExpiration = session.expiration - Date.now();
    if (msUntilExpiration < 0 || hasExpiredKeys && msUntilExpiration < 1000) {
      // If this is part of a remove(), we don't want to close the session until
      // the update is complete.  Otherwise, we will orphan the session.
      if (found && !found.updatePromise) {
        log.debug('Session has expired', session.sessionId);
        this.activeSessions_.delete(session);

        // Silence uncaught rejection errors
        session.close().catch(() => {});
      }
    }
    if (!this.areAllSessionsLoaded_()) {
      // Don't announce key statuses or resolve the "all loaded" promise until
      // everything is loaded.
      return;
    }
    this.allSessionsLoaded_.resolve();

    // Batch up key status changes before checking them or notifying Player.
    // This handles cases where the statuses of multiple sessions are set
    // simultaneously by the browser before dispatching key status changes for
    // each of them.  By batching these up, we only send one status change event
    // and at most one EXPIRED error on expiration.
    this.keyStatusTimer_.tickAfter(KEY_STATUS_BATCH_TIME);
  }

  private processKeyStatusChanges_() {
    const privateMap = this.keyStatusByKeyId_;
    const publicMap = this.announcedKeyStatusByKeyId_;

    // Copy the latest key statuses into the publicly-accessible map.
    publicMap.clear();
    privateMap.forEach((status, keyId) => publicMap.set(keyId, status));

    // If all keys are expired, fire an error. |every| is always true for an
    // empty array but we shouldn't fire an error for a lack of key status info.
    const statuses = Array.from(publicMap.values());
    const allExpired =
        statuses.length && statuses.every((status) => status == 'expired');
    if (allExpired) {
      this.onError_(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.EXPIRED));
    }
    this.playerInterface_.onKeyStatus(MapUtils.asObject(publicMap));
  }

  /**
   * Returns true if the browser has recent EME APIs.
   *
   */
  static isBrowserSupported(): boolean {
    const basic = !!window.MediaKeys && !!window.navigator &&
        !!window.navigator.requestMediaKeySystemAccess &&
        !!window.MediaKeySystemAccess &&
        // eslint-disable-next-line no-restricted-syntax
        !!window.MediaKeySystemAccess.prototype.getConfiguration;
    return basic;
  }

  /**
   * Returns a Promise to a map of EME support for well-known key systems.
   *
   */
  static async probeSupport():
      Promise<{[key: string]: shaka.extern.DrmSupportType | null}> {
    asserts.assert(
        DrmEngine.isBrowserSupported(), 'Must have basic EME support');
    const testKeySystems = [
      'org.w3.clearkey', 'com.widevine.alpha', 'com.microsoft.playready',
      'com.microsoft.playready.recommendation', 'com.apple.fps.1_0',
      'com.apple.fps', 'com.adobe.primetime'
    ];
    const basicVideoCapabilities = [
      {contentType: 'video/mp4; codecs="avc1.42E01E"'},
      {contentType: 'video/webm; codecs="vp8"'}
    ];
    const basicConfig = {
      initDataTypes: ['cenc'],
      videoCapabilities: basicVideoCapabilities
    };
    const offlineConfig = {
      videoCapabilities: basicVideoCapabilities,
      persistentState: 'required',
      sessionTypes: ['persistent-license']
    };

    // Try the offline config first, then fall back to the basic config.
    const configs = [offlineConfig, basicConfig];
    const support: Map<string, shaka.extern.DrmSupportType|null> = new Map();
    const testSystem = async (keySystem) => {
      try {
        // Our Polyfill will reject anything apart com.apple.fps key systems.
        // It seems the Safari modern EME API will allow to request a
        // MediaKeySystemAccess for the ClearKey CDM, create and update a key
        // session but playback will never start
        // Safari bug: https://bugs.webkit.org/show_bug.cgi?id=231006
        if (keySystem === 'org.w3.clearkey' && Platform.isSafari()) {
          throw new Error('Unsupported keySystem');
        }
        const access =
            await navigator.requestMediaKeySystemAccess(keySystem, configs);

        // Edge doesn't return supported session types, but current versions
        // do not support persistent-license.  If sessionTypes is missing,
        // assume no support for persistent-license.
        // TODO: Polyfill Edge to return known supported session types.
        // Edge bug: https://bit.ly/2IeKzho
        const sessionTypes = access.getConfiguration().sessionTypes;
        let persistentState =
            sessionTypes ? sessionTypes.includes('persistent-license') : false;

        // Tizen 3.0 doesn't support persistent licenses, but reports that it
        // does.  It doesn't fail until you call update() with a license
        // response, which is way too late.
        // This is a work-around for #894.
        if (Platform.isTizen3()) {
          persistentState = false;
        }
        support.set(keySystem, {persistentState: persistentState});
        await access.createMediaKeys();
      } catch (e) {
        // Either the request failed or createMediaKeys failed.
        // Either way, write null to the support object.
        support.set(keySystem, null);
      }
    };

    // Test each key system.
    const tests = testKeySystems.map((keySystem) => testSystem(keySystem));
    await Promise.all(tests);
    return MapUtils.asObject(support);
  }

  private onPlay_() {
    for (const event of this.mediaKeyMessageEvents_) {
      this.sendLicenseRequest_(event);
    }
    this.initialRequestsSent_ = true;
    this.mediaKeyMessageEvents_ = [];
  }

  /**
   * Close a drm session while accounting for a bug in Chrome. Sometimes the
   * Promise returned by close() never resolves.
   *
   * See issue #2741 and http://crbug.com/1108158.
   */
  private async closeSession_(session: MediaKeySession): Promise {
    const DrmEngine = DrmEngine;
    const timeout = new Promise((resolve, reject) => {
      const timer = new Timer(reject);
      timer.tickAfter(DrmEngine.CLOSE_TIMEOUT_);
    });
    try {
      await Promise.race(
          [Promise.all([session.close(), session.closed]), timeout]);
    } catch (e) {
      log.warning('Timeout waiting for session close');
    }
  }

  private async closeOpenSessions_() {
    // Close all open sessions.
    const openSessions = Array.from(this.activeSessions_.entries());
    this.activeSessions_.clear();

    // Close all sessions before we remove media keys from the video element.
    await Promise.all(openSessions.map(async ([session, metadata]) => {
      try {
        /**
         * Special case when a persistent-license session has been initiated,
         * without being registered in the offline sessions at start-up.
         * We should remove the session to prevent it from being orphaned after
         * the playback session ends
         */
        if (!this.initializedForStorage_ &&
            !this.offlineSessionIds_.includes(session.sessionId) &&
            metadata.type === 'persistent-license') {
          log.v1('Removing session', session.sessionId);
          await session.remove();
        } else {
          log.v1('Closing session', session.sessionId, metadata);
          await this.closeSession_(session);
        }
      } catch (error) {
        // Ignore errors when closing the sessions. Closing a session that
        // generated no key requests will throw an error.
        log.error('Failed to close or remove the session', error);
      }
    }));
  }

  /**
   * Check if a variant is likely to be supported by DrmEngine. This will err on
   * the side of being too accepting and may not reject a variant that it will
   * later fail to play.
   *
   */
  supportsVariant(variant: shaka.extern.Variant): boolean {
    const audio: shaka.extern.Stream|null = variant.audio;
    const video: shaka.extern.Stream|null = variant.video;
    if (audio && audio.encrypted) {
      const audioContentType = DrmEngine.computeMimeType_(audio);
      if (!this.willSupport(audioContentType)) {
        return false;
      }
    }
    if (video && video.encrypted) {
      const videoContentType = DrmEngine.computeMimeType_(video);
      if (!this.willSupport(videoContentType)) {
        return false;
      }
    }
    const keySystem = DrmEngine.keySystem(this.currentDrmInfo_);
    const drmInfos = this.getVariantDrmInfos_(variant);
    return drmInfos.length == 0 ||
        drmInfos.some((drmInfo) => drmInfo.keySystem == keySystem);
  }

  /**
   * Checks if two DrmInfos can be decrypted using the same key system.
   * Clear content is considered compatible with every key system.
   *
   */
  static areDrmCompatible(
      drms1: shaka.extern.DrmInfo[], drms2: shaka.extern.DrmInfo[]): boolean {
    if (!drms1.length || !drms2.length) {
      return true;
    }
    return DrmEngine.getCommonDrmInfos(drms1, drms2).length > 0;
  }

  /**
   * Returns an array of drm infos that are present in both input arrays.
   * If one of the arrays is empty, returns the other one since clear
   * content is considered compatible with every drm info.
   *
   */
  static getCommonDrmInfos(
      drms1: shaka.extern.DrmInfo[],
      drms2: shaka.extern.DrmInfo[]): shaka.extern.DrmInfo[] {
    if (!drms1.length) {
      return drms2;
    }
    if (!drms2.length) {
      return drms1;
    }
    const commonDrms = [];
    for (const drm1 of drms1) {
      for (const drm2 of drms2) {
        // This method is only called to compare drmInfos of a video and an
        // audio adaptations, so we shouldn't have to worry about checking
        // robustness.
        if (drm1.keySystem == drm2.keySystem) {
          let initData: shaka.extern.InitDataOverride[] = [];
          initData = initData.concat(drm1.initData || []);
          initData = initData.concat(drm2.initData || []);
          initData = initData.filter((d, i) => {
            return d.keyId === undefined || i === initData.findIndex((d2) => {
              return d2.keyId === d.keyId;
            });
          });
          const keyIds = drm1.keyIds && drm2.keyIds ?
              new Set([...drm1.keyIds, ...drm2.keyIds]) :
              drm1.keyIds || drm2.keyIds;
          const mergedDrm = {
            keySystem: drm1.keySystem,
            licenseServerUri: drm1.licenseServerUri || drm2.licenseServerUri,
            distinctiveIdentifierRequired: drm1.distinctiveIdentifierRequired ||
                drm2.distinctiveIdentifierRequired,
            persistentStateRequired:
                drm1.persistentStateRequired || drm2.persistentStateRequired,
            videoRobustness: drm1.videoRobustness || drm2.videoRobustness,
            audioRobustness: drm1.audioRobustness || drm2.audioRobustness,
            serverCertificate: drm1.serverCertificate || drm2.serverCertificate,
            serverCertificateUri:
                drm1.serverCertificateUri || drm2.serverCertificateUri,
            initData,
            keyIds
          };
          commonDrms.push(mergedDrm);
          break;
        }
      }
    }
    return commonDrms;
  }

  /**
   * Concat the audio and video drmInfos in a variant.
   */
  private getVariantDrmInfos_(variant: shaka.extern.Variant):
      shaka.extern.DrmInfo[] {
    const videoDrmInfos = variant.video ? variant.video.drmInfos : [];
    const audioDrmInfos = variant.audio ? variant.audio.drmInfos : [];
    return videoDrmInfos.concat(audioDrmInfos);
  }

  /**
   * Called in an interval timer to poll the expiration times of the sessions.
   * We don't get an event from EME when the expiration updates, so we poll it
   * so we can fire an event when it happens.
   */
  private pollExpiration_() {
    this.activeSessions_.forEach((metadata, session) => {
      const oldTime = metadata.oldExpiration;
      let newTime = session.expiration;
      if (isNaN(newTime)) {
        newTime = Infinity;
      }
      if (newTime != oldTime) {
        this.playerInterface_.onExpirationUpdated(session.sessionId, newTime);
        metadata.oldExpiration = newTime;
      }
    });
  }

  private areAllSessionsLoaded_(): boolean {
    const metadatas = this.activeSessions_.values();
    return Iterables.every(metadatas, (data) => data.loaded);
  }

  /**
   * Replace the drm info used in each variant in |variants| to reflect each
   * key service in |keySystems|.
   *
   */
  private static replaceDrmInfo_(
      variants: shaka.extern.Variant[], keySystems: Map<string, string>) {
    const drmInfos = [];
    keySystems.forEach((uri, keySystem) => {
      drmInfos.push({
        keySystem: keySystem,
        licenseServerUri: uri,
        distinctiveIdentifierRequired: false,
        persistentStateRequired: false,
        audioRobustness: '',
        videoRobustness: '',
        serverCertificate: null,
        serverCertificateUri: '',
        initData: [],
        keyIds: new Set()
      });
    });
    for (const variant of variants) {
      if (variant.video) {
        variant.video.drmInfos = drmInfos;
      }
      if (variant.audio) {
        variant.audio.drmInfos = drmInfos;
      }
    }
  }

  /**
   * Creates a DrmInfo object describing the settings used to initialize the
   * engine.
   *
   *
   */
  private createDrmInfoByInfos_(
      keySystem: string,
      drmInfos: shaka.extern.DrmInfo[]): shaka.extern.DrmInfo {
    const licenseServers: string[] = [];
    const serverCertificateUris: string[] = [];
    const serverCerts: Uint8Array[] = [];
    const initDatas: shaka.extern.InitDataOverride[] = [];
    const keyIds: Set<string> = new Set();
    DrmEngine.processDrmInfos_(
        drmInfos, licenseServers, serverCerts, serverCertificateUris, initDatas,
        keyIds);
    if (serverCerts.length > 1) {
      log.warning(
          'Multiple unique server certificates found! ' +
          'Only the first will be used.');
    }
    if (licenseServers.length > 1) {
      log.warning(
          'Multiple unique license server URIs found! ' +
          'Only the first will be used.');
    }
    if (serverCertificateUris.length > 1) {
      log.warning(
          'Multiple unique server certificate URIs found! ' +
          'Only the first will be used.');
    }
    const defaultSessionType =
        this.usePersistentLicenses_ ? 'persistent-license' : 'temporary';
    const res: shaka.extern.DrmInfo = {
      keySystem,
      licenseServerUri: licenseServers[0],
      distinctiveIdentifierRequired: drmInfos[0].distinctiveIdentifierRequired,
      persistentStateRequired: drmInfos[0].persistentStateRequired,
      sessionType: drmInfos[0].sessionType || defaultSessionType,
      audioRobustness: drmInfos[0].audioRobustness || '',
      videoRobustness: drmInfos[0].videoRobustness || '',
      serverCertificate: serverCerts[0],
      serverCertificateUri: serverCertificateUris[0],
      initData: initDatas,
      keyIds
    };
    for (const info of drmInfos) {
      if (info.distinctiveIdentifierRequired) {
        res.distinctiveIdentifierRequired = info.distinctiveIdentifierRequired;
      }
      if (info.persistentStateRequired) {
        res.persistentStateRequired = info.persistentStateRequired;
      }
    }
    return res;
  }

  /**
   * Creates a DrmInfo object describing the settings used to initialize the
   * engine.
   *
   *
   */
  private static createDrmInfoByConfigs_(
      keySystem: string,
      config: MediaKeySystemConfiguration): shaka.extern.DrmInfo {
    const licenseServers: string[] = [];
    const serverCertificateUris: string[] = [];
    const serverCerts: Uint8Array[] = [];
    const initDatas: shaka.extern.InitDataOverride[] = [];
    const keyIds: Set<string> = new Set();

    // TODO: refactor, don't stick drmInfos onto MediaKeySystemConfiguration
    DrmEngine.processDrmInfos_(
        config['drmInfos'], licenseServers, serverCerts, serverCertificateUris,
        initDatas, keyIds);
    if (serverCerts.length > 1) {
      log.warning(
          'Multiple unique server certificates found! ' +
          'Only the first will be used.');
    }
    if (serverCertificateUris.length > 1) {
      log.warning(
          'Multiple unique server certificate URIs found! ' +
          'Only the first will be used.');
    }
    if (licenseServers.length > 1) {
      log.warning(
          'Multiple unique license server URIs found! ' +
          'Only the first will be used.');
    }

    // TODO: This only works when all DrmInfo have the same robustness.
    const audioRobustness =
        config.audioCapabilities ? config.audioCapabilities[0].robustness : '';
    const videoRobustness =
        config.videoCapabilities ? config.videoCapabilities[0].robustness : '';
    const distinctiveIdentifier = config.distinctiveIdentifier;
    return {
      keySystem,
      licenseServerUri: licenseServers[0],
      distinctiveIdentifierRequired: distinctiveIdentifier == 'required',
      persistentStateRequired: config.persistentState == 'required',
      sessionType: config.sessionTypes[0] || 'temporary',
      audioRobustness: audioRobustness || '',
      videoRobustness: videoRobustness || '',
      serverCertificate: serverCerts[0],
      serverCertificateUri: serverCertificateUris[0],
      initData: initDatas,
      keyIds
    };
  }

  /**
   * Extract license server, server cert, and init data from |drmInfos|, taking
   * care to eliminate duplicates.
   *
   */
  private static processDrmInfos_(
      drmInfos: shaka.extern.DrmInfo[], licenseServers: string[],
      serverCerts: Uint8Array[], serverCertificateUris: string[],
      initDatas: shaka.extern.InitDataOverride[], keyIds: Set<string>) {
    const initDataOverrideEqual: (
        p1: shaka.extern.InitDataOverride, p2: shaka.extern.InitDataOverride) =>
        boolean = (a, b) => {
          if (a.keyId && a.keyId == b.keyId) {
            // Two initDatas with the same keyId are considered to be the same,
            // unless that "same keyId" is null.
            return true;
          }
          return a.initDataType == b.initDataType &&
              BufferUtils.equal(a.initData, b.initData);
        };
    for (const drmInfo of drmInfos) {
      // Build an array of unique license servers.
      if (!licenseServers.includes(drmInfo.licenseServerUri)) {
        licenseServers.push(drmInfo.licenseServerUri);
      }

      // Build an array of unique license servers.
      if (!serverCertificateUris.includes(drmInfo.serverCertificateUri)) {
        serverCertificateUris.push(drmInfo.serverCertificateUri);
      }

      // Build an array of unique server certs.
      if (drmInfo.serverCertificate) {
        const found = serverCerts.some(
            (cert) => BufferUtils.equal(cert, drmInfo.serverCertificate));
        if (!found) {
          serverCerts.push(drmInfo.serverCertificate);
        }
      }

      // Build an array of unique init datas.
      if (drmInfo.initData) {
        for (const initDataOverride of drmInfo.initData) {
          const found = initDatas.some(
              (initData) => initDataOverrideEqual(initData, initDataOverride));
          if (!found) {
            initDatas.push(initDataOverride);
          }
        }
      }
      if (drmInfo.keyIds) {
        for (const keyId of drmInfo.keyIds) {
          keyIds.add(keyId);
        }
      }
    }
  }

  /**
   * Use |servers| and |advancedConfigs| to fill in missing values in drmInfo
   * that the parser left blank. Before working with any drmInfo, it should be
   * passed through here as it is uncommon for drmInfo to be complete when
   * fetched from a manifest because most manifest formats do not have the
   * required information. Also applies the key systems mapping.
   *
   * @param
   *   advancedConfigs
   */
  private static fillInDrmInfoDefaults_(
      drmInfo: shaka.extern.DrmInfo, servers: Map<string, string>,
      advancedConfigs: Map<string, shaka.extern.AdvancedDrmConfiguration>,
      keySystemsMapping: {[key: string]: string}) {
    const originalKeySystem = drmInfo.keySystem;
    if (!originalKeySystem) {
      // This is a placeholder from the manifest parser for an unrecognized key
      // system.  Skip this entry, to avoid logging nonsensical errors.
      return;
    }

    // The order of preference for drmInfo:
    // 1. Clear Key config, used for debugging, should override everything else.
    //    (The application can still specify a clearkey license server.)
    // 2. Application-configured servers, if any are present, should override
    //    anything from the manifest.  Nuance: if key system A is in the
    //    manifest and key system B is in the player config, only B will be
    //    used, not A.
    // 3. Manifest-provided license servers are only used if nothing else is
    //    specified.
    // This is important because it allows the application a clear way to
    // indicate which DRM systems should be used on platforms with multiple DRM
    // systems.
    // The only way to get license servers from the manifest is not to specify
    // any in your player config.
    if (originalKeySystem == 'org.w3.clearkey' && drmInfo.licenseServerUri) {
      // Preference 1: Clear Key with pre-configured keys will have a data URI
      // assigned as its license server.  Don't change anything.
      return;
    } else {
      if (servers.size) {
        // Preference 2: If anything is configured at the application level,
        // override whatever was in the manifest.
        const server = servers.get(originalKeySystem) || '';
        drmInfo.licenseServerUri = server;
      } else {
      }
    }

    // Preference 3: Keep whatever we had in drmInfo.licenseServerUri, which
    // comes from the manifest.
    if (!drmInfo.keyIds) {
      drmInfo.keyIds = new Set();
    }
    const advancedConfig = advancedConfigs.get(originalKeySystem);
    if (advancedConfig) {
      if (!drmInfo.distinctiveIdentifierRequired) {
        drmInfo.distinctiveIdentifierRequired =
            advancedConfig.distinctiveIdentifierRequired;
      }
      if (!drmInfo.persistentStateRequired) {
        drmInfo.persistentStateRequired =
            advancedConfig.persistentStateRequired;
      }
      if (!drmInfo.videoRobustness) {
        drmInfo.videoRobustness = advancedConfig.videoRobustness;
      }
      if (!drmInfo.audioRobustness) {
        drmInfo.audioRobustness = advancedConfig.audioRobustness;
      }
      if (!drmInfo.serverCertificate) {
        drmInfo.serverCertificate = advancedConfig.serverCertificate;
      }
      if (advancedConfig.sessionType) {
        drmInfo.sessionType = advancedConfig.sessionType;
      }
      if (!drmInfo.serverCertificateUri) {
        drmInfo.serverCertificateUri = advancedConfig.serverCertificateUri;
      }
    }
    if (keySystemsMapping[originalKeySystem]) {
      drmInfo.keySystem = keySystemsMapping[originalKeySystem];
    }

    // Chromecast has a variant of PlayReady that uses a different key
    // system ID.  Since manifest parsers convert the standard PlayReady
    // UUID to the standard PlayReady key system ID, here we will switch
    // to the Chromecast version if we are running on that platform.
    // Note that this must come after fillInDrmInfoDefaults_, since the
    // player config uses the standard PlayReady ID for license server
    // configuration.
    if (window.cast && window.cast.__platform__) {
      if (originalKeySystem == 'com.microsoft.playready') {
        drmInfo.keySystem = 'com.chromecast.playready';
      }
    }
  }
}
type SessionMetaData = {
  loaded: boolean,
  initData: Uint8Array,
  initDataType: string|null,
  oldExpiration: number,
  type: string,
  updatePromise: PublicPromise
};

export {SessionMetaData};
type PlayerInterface = {
  netEngine: NetworkingEngine,
  onError: (p1: Error) => any,
  onKeyStatus: (p1: {[key: string]: string}) => any,
  onExpirationUpdated: (p1: string, p2: number) => any,
  onEvent: (p1: Event) => any
};

export {PlayerInterface};

/**
 * The amount of time, in seconds, we wait to consider a session closed.
 * This allows us to work around Chrome bug https://crbug.com/1108158.
 */
export const CLOSE_TIMEOUT_: number = 1;

/**
 * The amount of time, in seconds, we wait to consider session loaded even if no
 * key status information is available.  This allows us to support browsers/CDMs
 * without key statuses.
 */
export const SESSION_LOAD_TIMEOUT_: number = 5;

/**
 * The amount of time, in seconds, we wait to batch up rapid key status changes.
 * This allows us to avoid multiple expiration events in most cases.
 */
export const KEY_STATUS_BATCH_TIME: number = 0.5;

/**
 * Contains the suggested "default" key ID used by EME polyfills that do not
 * have a per-key key status. See w3c/encrypted-media#32.
 */
export const DUMMY_KEY_ID: Lazy<ArrayBuffer> =
    new Lazy(() => BufferUtils.toArrayBuffer(new Uint8Array([0])));
