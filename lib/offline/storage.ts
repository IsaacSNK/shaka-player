/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as logExports from './debug___log';
import {log} from './debug___log';
import * as PlayerExports from './lib___player';
import {Player} from './lib___player';
import * as DrmEngineExports from './media___drm_engine';
import {DrmEngine} from './media___drm_engine';
import * as ManifestParserExports from './media___manifest_parser';
import {ManifestParser} from './media___manifest_parser';
import * as SegmentReferenceExports from './media___segment_reference';
import {SegmentReference} from './media___segment_reference';
import * as NetworkingEngineExports from './net___networking_engine';
import {NetworkingEngine} from './net___networking_engine';
import {DownloadInfo} from './offline___download_info';
import {DownloadManager} from './offline___download_manager';
import {OfflineUri} from './offline___offline_uri';
import * as SessionDeleterExports from './offline___session_deleter';
import {SessionDeleter} from './offline___session_deleter';
import * as StorageMuxerExports from './offline___storage_muxer';
import {StorageCellHandle, StorageMuxer} from './offline___storage_muxer';
import {StoredContentUtils} from './offline___stored_content_utils';
import * as StreamBandwidthEstimatorExports from './offline___stream_bandwidth_estimator';
import {StreamBandwidthEstimator} from './offline___stream_bandwidth_estimator';
import {AbortableOperation} from './util___abortable_operation';
import {ArrayUtils} from './util___array_utils';
import {ConfigUtils} from './util___config_utils';
import {Destroyer} from './util___destroyer';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import {IDestroyable} from './util___i_destroyable';
import {Iterables} from './util___iterables';
import * as MimeUtilsExports from './util___mime_utils';
import {MimeUtils} from './util___mime_utils';
import * as PlatformExports from './util___platform';
import {Platform} from './util___platform';
import {PlayerConfiguration} from './util___player_configuration';
import * as StreamUtilsExports from './util___stream_utils';
import {StreamUtils} from './util___stream_utils';

/**
 * @summary
 * This manages persistent offline data including storage, listing, and deleting
 * stored manifests.  Playback of offline manifests are done through the Player
 * using a special URI (see shaka.offline.OfflineUri).
 *
 * First, check support() to see if offline is supported by the platform.
 * Second, configure() the storage object with callbacks to your application.
 * Third, call store(), remove(), or list() as needed.
 * When done, call destroy().
 *
 * @export
 */
export class Storage implements IDestroyable {
  private config_: shaka.extern.PlayerConfiguration|null = null;
  private networkingEngine_: NetworkingEngine = null;

  /**
   * A list of open operations that are being performed by this instance of
   * |shaka.offline.Storage|.
   *
   */
  private openOperations_: Promise[] = [];

  /**
   * A list of open download managers that are being used to download things.
   *
   */
  private openDownloadManagers_: DownloadManager[] = [];
  private destroyer_: Destroyer;

  /**
   *    A player instance to share a networking engine and configuration with.
   *    When initializing with a player, storage is only valid as long as
   *    |destroy| has not been called on the player instance. When omitted,
   *    storage will manage its own networking engine and configuration.
   */
  constructor(player?: Player) {
    // It is an easy mistake to make to pass a Player proxy from CastProxy.
    // Rather than throw a vague exception later, throw an explicit and clear
    // one now.
    // TODO(vaage): After we decide whether or not we want to support
    //  initializing storage with a player proxy, we should either remove
    //  this error or rename the error.
    if (player && player.constructor != Player) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.LOCAL_PLAYER_INSTANCE_REQUIRED);
    }

    // Initialize |config_| and |networkingEngine_| based on whether or not
    // we were given a player instance.
    if (player) {
      this.config_ = player.getSharedConfiguration();
      this.networkingEngine_ = player.getNetworkingEngine();
      asserts.assert(
          this.networkingEngine_,
          'Storage should not be initialized with a player that had ' +
              '|destroy| called on it.');
    } else {
      this.config_ = PlayerConfiguration.createDefault();
      this.networkingEngine_ = new NetworkingEngine();
    }

    /**
     * Storage should only destroy the networking engine if it was initialized
     * without a player instance. Store this as a flag here to avoid including
     * the player object in the destoyer's closure.
     *
     */
    const destroyNetworkingEngine: boolean = !player;
    this.destroyer_ = new Destroyer(async () => {
      // Cancel all in-progress store operations.
      await Promise.all(this.openDownloadManagers_.map((dl) => dl.abortAll()));

      // Wait for all remaining open operations to end. Wrap each operations so
      // that a single rejected promise won't cause |Promise.all| to return
      // early or to return a rejected Promise.
      const noop = () => {};
      const awaits = [];
      for (const op of this.openOperations_) {
        awaits.push(op.then(noop, noop));
      }
      await Promise.all(awaits);

      // Wait until after all the operations have finished before we destroy
      // the networking engine to avoid any unexpected errors.
      if (destroyNetworkingEngine) {
        await this.networkingEngine_.destroy();
      }

      // Drop all references to internal objects to help with GC.
      this.config_ = null;
      this.networkingEngine_ = null;
    });
  }

  /**
   * Gets whether offline storage is supported.  Returns true if offline storage
   * is supported for clear content.  Support for offline storage of encrypted
   * content will not be determined until storage is attempted.
   *
   * @export
   */
  static support(): boolean {
    // Our Storage system is useless without MediaSource.  MediaSource allows us
    // to pull data from anywhere (including our Storage system) and feed it to
    // the video element.
    if (!Platform.supportsMediaSource()) {
      return false;
    }
    return StorageMuxer.support();
  }

  /**
   * @override
   * @export
   */
  destroy() {
    return this.destroyer_.destroy();
  }

  /**
   * Sets configuration values for Storage.  This is associated with
   * Player.configure and will change the player instance given at
   * initialization.
   *
   * @param config This should either be a field name or an
   *   object following the form of {@link shaka.extern.PlayerConfiguration},
   *   where you may omit any field you do not wish to change.
   * @param value This should be provided if the previous parameter
   *   was a string field name.
   * @export
   */
  configure(config: string|Object, value?: any): boolean {
    asserts.assert(
        typeof config == 'object' || arguments.length == 2,
        'String configs should have values!');

    // ('fieldName', value) format
    if (arguments.length == 2 && typeof config == 'string') {
      config = ConfigUtils.convertToConfigObject(config, value);
    }
    asserts.assert(typeof config == 'object', 'Should be an object!');
    asserts.assert(
        this.config_, 'Cannot reconfigure storage after calling destroy.');
    return PlayerConfiguration.mergeConfigObjects(
        /* destination= */
        this.config_,
        /* updates= */
        config);
  }

  /**
   * Return a copy of the current configuration.  Modifications of the returned
   * value will not affect the Storage instance's active configuration.  You
   * must call storage.configure() to make changes.
   *
   * @export
   */
  getConfiguration(): shaka.extern.PlayerConfiguration {
    asserts.assert(this.config_, 'Config must not be null!');
    const ret = PlayerConfiguration.createDefault();
    PlayerConfiguration.mergeConfigObjects(
        ret, this.config_, PlayerConfiguration.createDefault());
    return ret;
  }

  /**
   * Return the networking engine that storage is using. If storage was
   * initialized with a player instance, then the networking engine returned
   * will be the same as |player.getNetworkingEngine()|.
   *
   * The returned value will only be null if |destroy| was called before
   * |getNetworkingEngine|.
   *
   * @export
   */
  getNetworkingEngine(): NetworkingEngine {
    return this.networkingEngine_;
  }

  /**
   * Stores the given manifest.  If the content is encrypted, and encrypted
   * content cannot be stored on this platform, the Promise will be rejected
   * with error code 6001, REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE.
   * Multiple assets can be downloaded at the same time, but note that since
   * the storage instance has a single networking engine, multiple storage
   * objects will be necessary if some assets require unique network filters.
   * This snapshots the storage config at the time of the call, so it will not
   * honor any changes to config mid-store operation.
   *
   * @param uri The URI of the manifest to store.
   * @param appMetadata An arbitrary object from the application
   *   that will be stored along-side the offline content.  Use this for any
   *   application-specific metadata you need associated with the stored
   *   content.  For details on the data types that can be stored here, please
   *   refer to {@link https://bit.ly/StructClone}
   *   The mime type for the content |manifestUri| points to.
   *   An AbortableOperation that resolves with a structure representing what
   *   was stored.  The "offlineUri" member is the URI that should be given to
   *   Player.load() to play this piece of content offline.  The "appMetadata"
   *   member is the appMetadata argument you passed to store().
   *   If you want to cancel this download, call the "abort" method on
   *   AbortableOperation.
   * @export
   */
  store(uri: string, appMetadata?: Object, mimeType?: string):
      shaka.extern.IAbortableOperation<shaka.extern.StoredContent> {
    asserts.assert(
        this.networkingEngine_, 'Cannot call |store| after calling |destroy|.');

    // Get a copy of the current config.
    const config = this.getConfiguration();
    const getParser = async () => {
      asserts.assert(
          this.networkingEngine_, 'Should not call |store| after |destroy|');
      const factory = await ManifestParser.getFactory(
          uri, this.networkingEngine_, config.manifest.retryParameters,
          mimeType || null);
      return factory();
    };
    const downloader: DownloadManager =
        new DownloadManager(this.networkingEngine_);
    this.openDownloadManagers_.push(downloader);
    const storeOp =
        this.store_(uri, appMetadata || {}, getParser, config, downloader);
    const abortableStoreOp = new AbortableOperation(storeOp, () => {
      return downloader.abortAll();
    });
    abortableStoreOp.finally(() => {
      ArrayUtils.remove(this.openDownloadManagers_, downloader);
    });
    return this.startAbortableOperation_(abortableStoreOp);
  }

  /**
   * See |shaka.offline.Storage.store| for details.
   *
   */
  private async store_(
      uri: string, appMetadata: Object,
      getParser: () => Promise<shaka.extern.ManifestParser>,
      config: shaka.extern.PlayerConfiguration,
      downloader: DownloadManager): Promise<shaka.extern.StoredContent> {
    this.requireSupport_();

    // Since we will need to use |parser|, |drmEngine|, |activeHandle|, and
    // |muxer| in the catch/finally blocks, we need to define them out here.
    // Since they may not get initialized when we enter the catch/finally block,
    // we need to assume that they may be null/undefined when we get there.
    let parser: shaka.extern.ManifestParser|null = null;
    let drmEngine: DrmEngine|null = null;
    const muxer: StorageMuxer = new StorageMuxer();
    let activeHandle: StorageCellHandle|null = null;
    let manifestId: number|null = null;

    // This will be used to store any errors from drm engine. Whenever drm
    // engine is passed to another function to do work, we should check if this
    // was set.
    let drmError = null;
    try {
      parser = await getParser();
      const manifest = await this.parseManifest(uri, parser, config);

      // Check if we were asked to destroy ourselves while we were "away"
      // downloading the manifest.
      this.ensureNotDestroyed_();

      // Check if we can even download this type of manifest before trying to
      // create the drm engine.
      const canDownload = !manifest.presentationTimeline.isLive() &&
          !manifest.presentationTimeline.isInProgress();
      if (!canDownload) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
            ErrorExports.Code.CANNOT_STORE_LIVE_OFFLINE, uri);
      }

      // Create the DRM engine, and load the keys in the manifest.
      drmEngine = await this.createDrmEngine(manifest, (e) => {
        drmError = drmError || e;
      }, config);

      // We could have been asked to destroy ourselves while we were "away"
      // creating the drm engine.
      this.ensureNotDestroyed_();
      if (drmError) {
        throw drmError;
      }
      await this.filterManifest_(manifest, drmEngine, config);
      await muxer.init();
      this.ensureNotDestroyed_();

      // Get the cell that we are saving the manifest to. Once we get a cell
      // we will only reference the cell and not the muxer so that the manifest
      // and segments will all be saved to the same cell.
      activeHandle = await muxer.getActive();
      this.ensureNotDestroyed_();
      asserts.assert(drmEngine, 'drmEngine should be non-null here.');
      const {manifestDB, toDownload} = this.makeManifestDB_(
          drmEngine, manifest, uri, appMetadata, config, downloader);

      // Store the empty manifest, before downloading the segments.
      const ids = await activeHandle.cell.addManifests([manifestDB]);
      this.ensureNotDestroyed_();
      manifestId = ids[0];
      asserts.assert(drmEngine, 'drmEngine should be non-null here.');
      this.ensureNotDestroyed_();
      if (drmError) {
        throw drmError;
      }
      await this.downloadSegments_(
          toDownload, manifestId, manifestDB, downloader, config,
          activeHandle.cell, manifest, drmEngine);
      this.ensureNotDestroyed_();
      const offlineUri = OfflineUri.manifest(
          activeHandle.path.mechanism, activeHandle.path.cell, manifestId);
      return StoredContentUtils.fromManifestDB(offlineUri, manifestDB);
    } catch (e) {
      if (manifestId != null) {
        await Storage.cleanStoredManifest(manifestId);
      }

      // If we already had an error, ignore this error to avoid hiding
      // the original error.
      throw drmError || e;
    } finally {
      await muxer.destroy();
      if (parser) {
        await parser.stop();
      }
      if (drmEngine) {
        await drmEngine.destroy();
      }
    }
  }

  /**
   * Download and then store the contents of each segment.
   * The promise this returns will wait for local downloads.
   *
   */
  private async downloadSegments_(
      toDownload: DownloadInfo[], manifestId: number,
      manifestDB: shaka.extern.ManifestDB, downloader: DownloadManager,
      config: shaka.extern.PlayerConfiguration,
      storage: shaka.extern.StorageCell, manifest: shaka.extern.Manifest,
      drmEngine: DrmEngine): Promise {
    let pendingManifestUpdates = {};
    let pendingDataSize = 0;
    const download = async (toDownload: DownloadInfo[], updateDRM: boolean) => {
      for (const download of toDownload) {
        const request = download.makeSegmentRequest(config);
        const estimateId = download.estimateId;
        const isInitSegment = download.isInitSegment;
        const onDownloaded = async (data) => {
          // Store the data.
          const dataKeys = await storage.addSegments([{data}]);
          this.ensureNotDestroyed_();

          // Store the necessary update to the manifest, to be processed later.
          const ref = (download.ref as SegmentReference);
          const id = DownloadInfo.idForSegmentRef(ref);
          pendingManifestUpdates[id] = dataKeys[0];
          pendingDataSize += data.byteLength;
        };
        downloader.queue(
            download.groupId, request, estimateId, isInitSegment, onDownloaded);
      }
      await downloader.waitToFinish();
      if (updateDRM) {
        // Re-store the manifest, to attach session IDs.
        // These were (maybe) discovered inside the downloader; we can only add
        // them now, at the end, since the manifestDB is in flux during the
        // process of downloading and storing, and assignSegmentsToManifest
        // does not know about the DRM engine.
        this.ensureNotDestroyed_();
        this.setManifestDrmFields_(manifest, manifestDB, drmEngine, config);
        await storage.updateManifest(manifestId, manifestDB);
      }
    };
    const usingBgFetch = false;

    // TODO: Get.

    // TODO: Send the request to the service worker. Don't await the result.
    try {
      if (this.getManifestIsEncrypted_(manifest) && usingBgFetch &&
          !this.getManifestIncludesInitData_(manifest)) {
        // Background fetch can't make DRM sessions, so if we have to get the
        // init data from the init segments, download those first before
        // anything else.
        await download(toDownload.filter((info) => info.isInitSegment), true);
        this.ensureNotDestroyed_();
        toDownload = toDownload.filter((info) => !info.isInitSegment);

        // Copy these and reset them now, before calling await.
        const manifestUpdates = pendingManifestUpdates;
        const dataSize = pendingDataSize;
        pendingManifestUpdates = {};
        pendingDataSize = 0;
        await Storage.assignSegmentsToManifest(
            storage, manifestId, manifestDB, manifestUpdates, dataSize,
            () => this.ensureNotDestroyed_());
        this.ensureNotDestroyed_();
      }
      if (!usingBgFetch) {
        await download(toDownload, false);
        this.ensureNotDestroyed_();

        // Copy these and reset them now, before calling await.
        const manifestUpdates = pendingManifestUpdates;
        const dataSize = pendingDataSize;
        pendingManifestUpdates = {};
        pendingDataSize = 0;
        await Storage.assignSegmentsToManifest(
            storage, manifestId, manifestDB, manifestUpdates, dataSize,
            () => this.ensureNotDestroyed_());
        this.ensureNotDestroyed_();
        asserts.assert(
            !manifestDB.isIncomplete, 'The manifest should be complete by now');
      } else {
      }
    } catch (error) {
      const dataKeys = Object.values(pendingManifestUpdates);

      // Remove these pending segments that are not yet linked to the manifest.
      await storage.removeSegments(dataKeys, (key) => {});
      throw error;
    }
  }

  /**
   * Removes all of the contents for a given manifest, statelessly.
   *
   */
  static async cleanStoredManifest(manifestId: number): Promise {
    const muxer = new StorageMuxer();
    await muxer.init();
    const activeHandle = await muxer.getActive();
    const uri = OfflineUri.manifest(
        activeHandle.path.mechanism, activeHandle.path.cell, manifestId);
    await muxer.destroy();
    const storage = new Storage();
    await storage.remove(uri.toString());
  }

  /**
   * Updates the given manifest, assigns database keys to segments, then stores
   * the updated manifest.
   *
   * It is up to the caller to ensure that this method is not called
   * concurrently on the same manifest.
   *
   * @param throwIfAbortedFn  A function that should throw if the
   *   download has been aborted.
   */
  static async assignSegmentsToManifest(
      storage: shaka.extern.StorageCell, manifestId: number,
      manifestDB: shaka.extern.ManifestDB,
      manifestUpdates: {[key: string]: number}, dataSizeUpdate: number,
      throwIfAbortedFn: () => any): Promise {
    let manifestUpdated = false;
    try {
      // Assign the stored data to the manifest.
      let complete = true;
      for (const stream of manifestDB.streams) {
        for (const segment of stream.segments) {
          let dataKey = segment.pendingSegmentRefId ?
              manifestUpdates[segment.pendingSegmentRefId] :
              null;
          if (dataKey != null) {
            segment.dataKey = dataKey;

            // Now that the segment has been associated with the appropriate
            // dataKey, the pendingSegmentRefId is no longer necessary.
            segment.pendingSegmentRefId = undefined;
          }
          dataKey = segment.pendingInitSegmentRefId ?
              manifestUpdates[segment.pendingInitSegmentRefId] :
              null;
          if (dataKey != null) {
            segment.initSegmentKey = dataKey;

            // Now that the init segment has been associated with the
            // appropriate initSegmentKey, the pendingInitSegmentRefId is no
            // longer necessary.
            segment.pendingInitSegmentRefId = undefined;
          }
          if (segment.pendingSegmentRefId) {
            complete = false;
          }
          if (segment.pendingInitSegmentRefId) {
            complete = false;
          }
        }
      }

      // Update the size of the manifest.
      manifestDB.size += dataSizeUpdate;

      // Mark the manifest as complete, if all segments are downloaded.
      if (complete) {
        manifestDB.isIncomplete = false;
      }

      // Update the manifest.
      await storage.updateManifest(manifestId, manifestDB);
      manifestUpdated = true;
      throwIfAbortedFn();
    } catch (e) {
      await Storage.cleanStoredManifest(manifestId);
      if (!manifestUpdated) {
        const dataKeys = Object.values(manifestUpdates);

        // The cleanStoredManifest method will not "see" any segments that have
        // been downloaded but not assigned to the manifest yet. So un-store
        // them separately.
        await storage.removeSegments(dataKeys, (key) => {});
      }
      throw e;
    }
  }

  /**
   * Filter |manifest| such that it will only contain the variants and text
   * streams that we want to store and can actually play.
   *
   */
  private async filterManifest_(
      manifest: shaka.extern.Manifest, drmEngine: DrmEngine,
      config: shaka.extern.PlayerConfiguration): Promise {
    // Filter the manifest based on the restrictions given in the player
    // configuration.
    const maxHwRes = {width: Infinity, height: Infinity};
    StreamUtils.filterByRestrictions(manifest, config.restrictions, maxHwRes);

    // Filter the manifest based on what we know MediaCapabilities will be able
    // to play later (no point storing something we can't play).
    await StreamUtils.filterManifestByMediaCapabilities(
        manifest, config.offline.usePersistentLicense);

    // Gather all tracks.
    const allTracks = [];

    // Choose the codec that has the lowest average bandwidth.
    const preferredAudioChannelCount = config.preferredAudioChannelCount;
    const preferredDecodingAttributes = config.preferredDecodingAttributes;
    const preferredVideoCodecs = config.preferredVideoCodecs;
    const preferredAudioCodecs = config.preferredAudioCodecs;
    StreamUtils.chooseCodecsAndFilterManifest(
        manifest, preferredVideoCodecs, preferredAudioCodecs,
        preferredAudioChannelCount, preferredDecodingAttributes);
    for (const variant of manifest.variants) {
      asserts.assert(
          StreamUtils.isPlayable(variant),
          'We should have already filtered by "is playable"');
      allTracks.push(StreamUtils.variantToTrack(variant));
    }
    for (const text of manifest.textStreams) {
      allTracks.push(StreamUtils.textStreamToTrack(text));
    }
    for (const image of manifest.imageStreams) {
      allTracks.push(StreamUtils.imageStreamToTrack(image));
    }

    // Let the application choose which tracks to store.
    const chosenTracks = await config.offline.trackSelectionCallback(allTracks);
    const duration = manifest.presentationTimeline.getDuration();
    let sizeEstimate = 0;
    for (const track of chosenTracks) {
      const trackSize = track.bandwidth * duration / 8;
      sizeEstimate += trackSize;
    }
    try {
      const allowedDownload =
          await config.offline.downloadSizeCallback(sizeEstimate);
      if (!allowedDownload) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
            ErrorExports.Code.STORAGE_LIMIT_REACHED);
      }
    } catch (e) {
      // It is necessary to be able to catch the STORAGE_LIMIT_REACHED error
      if (e instanceof Error) {
        throw e;
      }
      log.warning('downloadSizeCallback has produced an unexpected error', e);
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.DOWNLOAD_SIZE_CALLBACK_ERROR);
    }
    const variantIds: Set<number> = new Set();
    const textIds: Set<number> = new Set();
    const imageIds: Set<number> = new Set();

    // Collect the IDs of the chosen tracks.
    for (const track of chosenTracks) {
      if (track.type == 'variant') {
        variantIds.add(track.id);
      }
      if (track.type == 'text') {
        textIds.add(track.id);
      }
      if (track.type == 'image') {
        imageIds.add(track.id);
      }
    }

    // Filter the manifest to keep only what the app chose.
    manifest.variants =
        manifest.variants.filter((variant) => variantIds.has(variant.id));
    manifest.textStreams =
        manifest.textStreams.filter((stream) => textIds.has(stream.id));
    manifest.imageStreams =
        manifest.imageStreams.filter((stream) => imageIds.has(stream.id));

    // Check the post-filtered manifest for characteristics that may indicate
    // issues with how the app selected tracks.
    Storage.validateManifest_(manifest);
  }

  /**
   * Create a download manager and download the manifest.
   * This also sets up download infos for each segment to be downloaded.
   *
   * @return {{
   *   manifestDB: shaka.extern.ManifestDB,
   *   toDownload: !Array.<!shaka.offline.DownloadInfo>
   * }}
   */
  private makeManifestDB_(
      drmEngine: DrmEngine, manifest: shaka.extern.Manifest, uri: string,
      metadata: Object, config: shaka.extern.PlayerConfiguration,
      downloader: DownloadManager):
      {manifestDB: shaka.extern.ManifestDB, toDownload: DownloadInfo[]} {
    const pendingContent = StoredContentUtils.fromManifest(
        uri, manifest,
        /* size= */
        0, metadata);

    // In https://github.com/shaka-project/shaka-player/issues/2652, we found
    // that this callback would be removed by the compiler if we reference the
    // config in the onProgress closure below.  Reading it into a local
    // variable first seems to work around this apparent compiler bug.
    const progressCallback = config.offline.progressCallback;
    const onProgress = (progress, size) => {
      // Update the size of the stored content before issuing a progress
      // update.
      pendingContent.size = size;
      progressCallback(pendingContent, progress);
    };
    const onInitData = (initData, systemId) => {
      if (needsInitData && config.offline.usePersistentLicense &&
          currentSystemId == systemId) {
        drmEngine.newInitData('cenc', initData);
      }
    };
    downloader.setCallbacks(onProgress, onInitData);
    const needsInitData = this.getManifestIsEncrypted_(manifest) &&
        !this.getManifestIncludesInitData_(manifest);
    let currentSystemId = null;
    if (needsInitData) {
      const drmInfo = drmEngine.getDrmInfo();
      currentSystemId = defaultSystemIds_.get(drmInfo.keySystem);
    }

    // Make the estimator, which is used to make the download registries.
    const estimator = new StreamBandwidthEstimator();
    for (const stream of manifest.textStreams) {
      estimator.addText(stream);
    }
    for (const stream of manifest.imageStreams) {
      estimator.addImage(stream);
    }
    for (const variant of manifest.variants) {
      estimator.addVariant(variant);
    }
    const {streams, toDownload} =
        this.createStreams_(downloader, estimator, drmEngine, manifest, config);
    const drmInfo = drmEngine.getDrmInfo();
    const usePersistentLicense = config.offline.usePersistentLicense;
    if (drmInfo && usePersistentLicense) {
      // Don't store init data, since we have stored sessions.
      drmInfo.initData = [];
    }
    const manifestDB = {
      creationTime: Date.now(),
      originalManifestUri: uri,
      duration: manifest.presentationTimeline.getDuration(),
      size: 0,
      expiration: drmEngine.getExpiration(),
      streams,
      sessionIds: usePersistentLicense ? drmEngine.getSessionIds() : [],
      drmInfo,
      appMetadata: metadata,
      isIncomplete: true,
      sequenceMode: manifest.sequenceMode
    };
    return {manifestDB, toDownload};
  }

  private getManifestIsEncrypted_(manifest: shaka.extern.Manifest): boolean {
    return manifest.variants.some((variant) => {
      const videoEncrypted = variant.video && variant.video.encrypted;
      const audioEncrypted = variant.audio && variant.audio.encrypted;
      return videoEncrypted || audioEncrypted;
    });
  }

  private getManifestIncludesInitData_(manifest: shaka.extern.Manifest):
      boolean {
    return manifest.variants.some((variant) => {
      const videoDrmInfos = variant.video ? variant.video.drmInfos : [];
      const audioDrmInfos = variant.audio ? variant.audio.drmInfos : [];
      const drmInfos = videoDrmInfos.concat(audioDrmInfos);
      return drmInfos.some((drmInfos) => {
        return drmInfos.initData && drmInfos.initData.length;
      });
    });
  }

  private setManifestDrmFields_(
      manifest: shaka.extern.Manifest, manifestDB: shaka.extern.ManifestDB,
      drmEngine: DrmEngine, config: shaka.extern.PlayerConfiguration) {
    manifestDB.expiration = drmEngine.getExpiration();
    const sessions = drmEngine.getSessionIds();
    manifestDB.sessionIds = config.offline.usePersistentLicense ? sessions : [];
    if (this.getManifestIsEncrypted_(manifest) &&
        config.offline.usePersistentLicense && !sessions.length) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.NO_INIT_DATA_FOR_OFFLINE);
    }
  }

  /**
   * Removes the given stored content.  This will also attempt to release the
   * licenses, if any.
   *
   * @export
   */
  remove(contentUri: string): Promise {
    return this.startOperation_(this.remove_(contentUri));
  }

  /**
   * See |shaka.offline.Storage.remove| for details.
   *
   */
  private async remove_(contentUri: string): Promise {
    this.requireSupport_();
    const nullableUri = OfflineUri.parse(contentUri);
    if (nullableUri == null || !nullableUri.isManifest()) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.MALFORMED_OFFLINE_URI, contentUri);
    }
    const uri: OfflineUri = nullableUri;
    const muxer: StorageMuxer = new StorageMuxer();
    try {
      await muxer.init();
      const cell = await muxer.getCell(uri.mechanism(), uri.cell());
      const manifests = await cell.getManifests([uri.key()]);
      const manifest = manifests[0];
      await Promise.all([
        this.removeFromDRM_(uri, manifest, muxer),
        this.removeFromStorage_(cell, uri, manifest)
      ]);
    } finally {
      await muxer.destroy();
    }
  }

  private static getCapabilities_(
      manifestDb: shaka.extern.ManifestDB,
      isVideo: boolean): MediaKeySystemMediaCapability[] {
    const MimeUtils = MimeUtils;
    const ret = [];
    for (const stream of manifestDb.streams) {
      if (isVideo && stream.type == 'video') {
        ret.push({
          contentType: MimeUtils.getFullType(stream.mimeType, stream.codecs),
          robustness: manifestDb.drmInfo.videoRobustness
        });
      } else {
        if (!isVideo && stream.type == 'audio') {
          ret.push({
            contentType: MimeUtils.getFullType(stream.mimeType, stream.codecs),
            robustness: manifestDb.drmInfo.audioRobustness
          });
        }
      }
    }
    return ret;
  }

  private async removeFromDRM_(
      uri: OfflineUri, manifestDb: shaka.extern.ManifestDB,
      muxer: StorageMuxer): Promise {
    asserts.assert(this.networkingEngine_, 'Cannot be destroyed');
    await Storage.deleteLicenseFor_(
        this.networkingEngine_, this.config_.drm, muxer, manifestDb);
  }

  private removeFromStorage_(
      storage: shaka.extern.StorageCell, uri: OfflineUri,
      manifest: shaka.extern.ManifestDB): Promise {
    const segmentIds: number[] = Storage.getAllSegmentIds_(manifest);

    // Count(segments) + Count(manifests)
    const toRemove = segmentIds.length + 1;
    let removed = 0;
    const pendingContent = StoredContentUtils.fromManifestDB(uri, manifest);
    const onRemove = (key) => {
      removed += 1;
      this.config_.offline.progressCallback(pendingContent, removed / toRemove);
    };
    return Promise.all([
      storage.removeSegments(segmentIds, onRemove),
      storage.removeManifests([uri.key()], onRemove)
    ]);
  }

  /**
   * Removes any EME sessions that were not successfully removed before.  This
   * returns whether all the sessions were successfully removed.
   *
   * @export
   */
  removeEmeSessions(): Promise<boolean> {
    return this.startOperation_(this.removeEmeSessions_());
  }

  private async removeEmeSessions_(): Promise<boolean> {
    this.requireSupport_();
    asserts.assert(this.networkingEngine_, 'Cannot be destroyed');
    const net = this.networkingEngine_;
    const config = this.config_.drm;
    const muxer: StorageMuxer = new StorageMuxer();
    const deleter: SessionDeleter = new SessionDeleter();
    let hasRemaining = false;

    /* eslint-enable no-await-in-loop */
    try {
      await muxer.init();
      const cells: shaka.extern.EmeSessionStorageCell[] = [];
      muxer.forEachEmeSessionCell((c) => cells.push(c));

      // Run these sequentially to avoid creating too many DrmEngine instances
      // and having multiple CDMs alive at once.  Some embedded platforms may
      // not support that.
      for (const sessionIdCell of cells) {
        /* eslint-disable no-await-in-loop */
        const sessions = await sessionIdCell.getAll();
        const deletedSessionIds = await deleter.delete(config, net, sessions);
        await sessionIdCell.remove(deletedSessionIds);
        if (deletedSessionIds.length != sessions.length) {
          hasRemaining = true;
        }
      }
    } finally {
      await muxer.destroy();
    }
    return !hasRemaining;
  }

  /**
   * Lists all the stored content available.
   *
   * @return  A Promise to an
   *   array of structures representing all stored content.  The "offlineUri"
   *   member of the structure is the URI that should be given to Player.load()
   *   to play this piece of content offline.  The "appMetadata" member is the
   *   appMetadata argument you passed to store().
   * @export
   */
  list(): Promise<shaka.extern.StoredContent[]> {
    return this.startOperation_(this.list_());
  }

  /**
   * See |shaka.offline.Storage.list| for details.
   *
   */
  private async list_(): Promise<shaka.extern.StoredContent[]> {
    this.requireSupport_();
    const result: shaka.extern.StoredContent[] = [];
    const muxer: StorageMuxer = new StorageMuxer();
    try {
      await muxer.init();
      let p = Promise.resolve();
      muxer.forEachCell((path, cell) => {
        p = p.then(async () => {
          const manifests = await cell.getAllManifests();
          manifests.forEach((manifest, key) => {
            const uri = OfflineUri.manifest(path.mechanism, path.cell, key);
            const content = StoredContentUtils.fromManifestDB(uri, manifest);
            result.push(content);
          });
        });
      });
      await p;
    } finally {
      await muxer.destroy();
    }
    return result;
  }

  /**
   * This method is public so that it can be overridden in testing.
   *
   */
  async parseManifest(
      uri: string, parser: shaka.extern.ManifestParser,
      config: shaka.extern.PlayerConfiguration):
      Promise<shaka.extern.Manifest> {
    let error = null;
    const networkingEngine = this.networkingEngine_;
    asserts.assert(networkingEngine, 'Should be initialized!');
    const playerInterface: shaka.extern.ManifestParser.PlayerInterface = {
      networkingEngine: networkingEngine,
      // No need to apply CMCD data for offline requests
      modifyManifestRequest: (request, manifestInfo) => {},
      modifySegmentRequest: (request, segmentInfo) => {},
      // Don't bother filtering now. We will do that later when we have all the
      // information we need to filter.
      filter: () => Promise.resolve(),
      // The responsibility for making mock text streams for closed captions is
      // handled inside shaka.offline.OfflineManifestParser, before playback.
      makeTextStreamsForClosedCaptions: (manifest) => {},
      onTimelineRegionAdded: () => {},
      onEvent: () => {},
      // Used to capture an error from the manifest parser. We will check the
      // error before returning.
      onError: (e) => {
        error = e;
      },
      isLowLatencyMode: () => false,
      isAutoLowLatencyMode: () => false,
      enableLowLatencyMode: () => {}
    };
    parser.configure(config.manifest);

    // We may have been destroyed while we were waiting on |getParser| to
    // resolve.
    this.ensureNotDestroyed_();
    const manifest = await parser.start(uri, playerInterface);

    // We may have been destroyed while we were waiting on |start| to
    // resolve.
    this.ensureNotDestroyed_();

    // Get all the streams that are used in the manifest.
    const streams = Storage.getAllStreamsFromManifest_(manifest);

    // Wait for each stream to create their segment indexes.
    await Promise.all(Iterables.map(streams, (stream) => {
      return stream.createSegmentIndex();
    }));

    // We may have been destroyed while we were waiting on
    // |createSegmentIndex| to resolve for each stream.
    this.ensureNotDestroyed_();

    // If we saw an error while parsing, surface the error.
    if (error) {
      throw error;
    }
    return manifest;
  }

  /**
   * This method is public so that it can be override in testing.
   *
   */
  async createDrmEngine(
      manifest: shaka.extern.Manifest, onError: (p1: Error) => any,
      config: shaka.extern.PlayerConfiguration): Promise<DrmEngine> {
    asserts.assert(
        this.networkingEngine_,
        'Cannot call |createDrmEngine| after |destroy|');
    const drmEngine: DrmEngine = new DrmEngine({
      netEngine: this.networkingEngine_,
      onError: onError,
      onKeyStatus: () => {},
      onExpirationUpdated: () => {},
      onEvent: () => {}
    });
    drmEngine.configure(config.drm);
    await drmEngine.initForStorage(
        manifest.variants, config.offline.usePersistentLicense);
    await drmEngine.setServerCertificate();
    await drmEngine.createOrLoad();
    return drmEngine;
  }

  /**
   * Converts manifest Streams to database Streams.
   *
   * @return {{
   *   streams: !Array.<shaka.extern.StreamDB>,
   *   toDownload: !Array.<!shaka.offline.DownloadInfo>
   * }}
   */
  private createStreams_(
      downloader: DownloadManager, estimator: StreamBandwidthEstimator,
      drmEngine: DrmEngine, manifest: shaka.extern.Manifest,
      config: shaka.extern.PlayerConfiguration):
      {streams: shaka.extern.StreamDB[], toDownload: DownloadInfo[]} {
    // Download infos are stored based on their refId, to dedup them.
    const toDownload: Map<string, DownloadInfo> = new Map();

    // Find the streams we want to download and create a stream db instance
    // for each of them.
    const streamSet = Storage.getAllStreamsFromManifest_(manifest);
    const streamDBs = new Map();
    for (const stream of streamSet) {
      const streamDB = this.createStream_(
          downloader, estimator, manifest, stream, config, toDownload);
      streamDBs.set(stream.id, streamDB);
    }

    // Connect streams and variants together.
    for (const variant of manifest.variants) {
      if (variant.audio) {
        streamDBs.get(variant.audio.id).variantIds.push(variant.id);
      }
      if (variant.video) {
        streamDBs.get(variant.video.id).variantIds.push(variant.id);
      }
    }
    return {
      streams: Array.from(streamDBs.values()),
      toDownload: Array.from(toDownload.values())
    };
  }

  /**
   * Converts a manifest stream to a database stream.  This will search the
   * segment index and add all the segments to the download infos.
   *
   */
  private createStream_(
      downloader: DownloadManager, estimator: StreamBandwidthEstimator,
      manifest: shaka.extern.Manifest, stream: shaka.extern.Stream,
      config: shaka.extern.PlayerConfiguration,
      toDownload: Map<string, DownloadInfo>): shaka.extern.StreamDB {
    const streamDb: shaka.extern.StreamDB = {
      id: stream.id,
      originalId: stream.originalId,
      primary: stream.primary,
      type: stream.type,
      mimeType: stream.mimeType,
      codecs: stream.codecs,
      frameRate: stream.frameRate,
      pixelAspectRatio: stream.pixelAspectRatio,
      hdr: stream.hdr,
      kind: stream.kind,
      language: stream.language,
      label: stream.label,
      width: stream.width || null,
      height: stream.height || null,
      encrypted: stream.encrypted,
      keyIds: stream.keyIds,
      segments: [],
      variantIds: [],
      roles: stream.roles,
      forced: stream.forced,
      channelsCount: stream.channelsCount,
      audioSamplingRate: stream.audioSamplingRate,
      spatialAudio: stream.spatialAudio,
      closedCaptions: stream.closedCaptions,
      tilesLayout: stream.tilesLayout
    };
    const startTime =
        manifest.presentationTimeline.getSegmentAvailabilityStart();
    const numberOfParallelDownloads = config.offline.numberOfParallelDownloads;
    let groupId = 0;
    Storage.forEachSegment_(stream, startTime, (segment) => {
      const pendingSegmentRefId = DownloadInfo.idForSegmentRef(segment);
      let pendingInitSegmentRefId = undefined;

      // Set up the download for the segment, which will be downloaded later,
      // perhaps in a service worker.
      if (!toDownload.has(pendingSegmentRefId)) {
        const estimateId = downloader.addDownloadEstimate(
            estimator.getSegmentEstimate(stream.id, segment));
        const segmentDownload = new DownloadInfo(
            segment, estimateId, groupId,
            /* isInitSegment= */
            false);
        toDownload.set(pendingSegmentRefId, segmentDownload);
      }

      // Set up the download for the init segment, similarly, if there is one.
      if (segment.initSegmentReference) {
        pendingInitSegmentRefId =
            DownloadInfo.idForSegmentRef(segment.initSegmentReference);
        if (!toDownload.has(pendingInitSegmentRefId)) {
          const estimateId = downloader.addDownloadEstimate(
              estimator.getInitSegmentEstimate(stream.id));
          const initDownload = new DownloadInfo(
              segment.initSegmentReference, estimateId, groupId,
              /* isInitSegment= */
              true);
          toDownload.set(pendingInitSegmentRefId, initDownload);
        }
      }
      const segmentDB: shaka.extern.SegmentDB = {
        pendingInitSegmentRefId,
        initSegmentKey: pendingInitSegmentRefId ? 0 : null,
        startTime: segment.startTime,
        endTime: segment.endTime,
        appendWindowStart: segment.appendWindowStart,
        appendWindowEnd: segment.appendWindowEnd,
        timestampOffset: segment.timestampOffset,
        tilesLayout: segment.tilesLayout,
        pendingSegmentRefId,
        dataKey: 0
      };
      streamDb.segments.push(segmentDB);
      groupId = (groupId + 1) % numberOfParallelDownloads;
    });
    return streamDb;
  }

  private static forEachSegment_(
      stream: shaka.extern.Stream, startTime: number,
      callback: (p1: SegmentReference) => any) {
    let i: number|null = stream.segmentIndex.find(startTime);
    if (i == null) {
      return;
    }
    let ref: SegmentReference|null = stream.segmentIndex.get(i);
    while (ref) {
      callback(ref);
      ref = stream.segmentIndex.get(++i);
    }
  }

  /**
   * Throws an error if the object is destroyed.
   */
  private ensureNotDestroyed_() {
    if (this.destroyer_.destroyed()) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.OPERATION_ABORTED);
    }
  }

  /**
   * Used by functions that need storage support to ensure that the current
   * platform has storage support before continuing. This should only be
   * needed to be used at the start of public methods.
   *
   */
  private requireSupport_() {
    if (!Storage.support()) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.STORAGE_NOT_SUPPORTED);
    }
  }

  /**
   * Perform an action. Track the action's progress so that when we destroy
   * we will wait until all the actions have completed before allowing destroy
   * to resolve.
   *
   * @template T
   */
  private async startOperation_(action: Promise<T>): Promise<T> {
    this.openOperations_.push(action);
    try {
      // Await |action| so we can use the finally statement to remove |action|
      // from |openOperations_| when we still have a reference to |action|.
      return await action;
    } finally {
      ArrayUtils.remove(this.openOperations_, action);
    }
  }

  /**
   * The equivalent of startOperation_, but for abortable operations.
   *
   * @template T
   */
  private startAbortableOperation_(action: shaka.extern.IAbortableOperation<T>):
      shaka.extern.IAbortableOperation<T> {
    const promise = action.promise;
    this.openOperations_.push(promise);

    // Remove the open operation once the action has completed. So that we
    // can still return the AbortableOperation, this is done using a |finally|
    // block, rather than awaiting the result.
    return action.finally(() => {
      ArrayUtils.remove(this.openOperations_, promise);
    });
  }

  private static getAllSegmentIds_(manifest: shaka.extern.ManifestDB):
      number[] {
    const ids: Set<number> = new Set();

    // Get every segment for every stream in the manifest.
    for (const stream of manifest.streams) {
      for (const segment of stream.segments) {
        if (segment.initSegmentKey != null) {
          ids.add(segment.initSegmentKey);
        }
        ids.add(segment.dataKey);
      }
    }
    return Array.from(ids);
  }

  /**
   * Delete the on-disk storage and all the content it contains. This should not
   * be done in normal circumstances. Only do it when storage is rendered
   * unusable, such as by a version mismatch. No business logic will be run, and
   * licenses will not be released.
   *
   * @export
   */
  static async deleteAll(): Promise {
    const muxer: StorageMuxer = new StorageMuxer();
    try {
      // Wipe all content from all storage mechanisms.
      await muxer.erase();
    } finally {
      // Destroy the muxer, whether or not erase() succeeded.
      await muxer.destroy();
    }
  }

  private static async deleteLicenseFor_(
      net: NetworkingEngine, drmConfig: shaka.extern.DrmConfiguration,
      muxer: StorageMuxer, manifestDb: shaka.extern.ManifestDB): Promise {
    if (!manifestDb.drmInfo) {
      return;
    }
    const sessionIdCell = muxer.getEmeSessionCell();
    const sessions: shaka.extern.EmeSessionDB[] =
        manifestDb.sessionIds.map((sessionId) => {
          return {
            sessionId: sessionId,
            keySystem: manifestDb.drmInfo.keySystem,
            licenseUri: manifestDb.drmInfo.licenseServerUri,
            serverCertificate: manifestDb.drmInfo.serverCertificate,
            audioCapabilities: Storage.getCapabilities_(
                manifestDb,
                /* isVideo= */
                false),
            videoCapabilities: Storage.getCapabilities_(
                manifestDb,
                /* isVideo= */
                true)
          };
        });

    // Try to delete the sessions; any sessions that weren't deleted get stored
    // in the database so we can try to remove them again later.  This allows us
    // to still delete the stored content but not "forget" about these sessions.
    // Later, we can remove the sessions to free up space.
    const deleter = new SessionDeleter();
    const deletedSessionIds = await deleter.delete(drmConfig, net, sessions);
    await sessionIdCell.remove(deletedSessionIds);
    await sessionIdCell.add(sessions.filter(
        (session) => !deletedSessionIds.includes(session.sessionId)));
  }

  /**
   * Get the set of all streams in |manifest|.
   *
   */
  private static getAllStreamsFromManifest_(manifest: shaka.extern.Manifest):
      Set<shaka.extern.Stream> {
    const set: Set<shaka.extern.Stream> = new Set();
    for (const text of manifest.textStreams) {
      set.add(text);
    }
    for (const image of manifest.imageStreams) {
      set.add(image);
    }
    for (const variant of manifest.variants) {
      if (variant.audio) {
        set.add(variant.audio);
      }
      if (variant.video) {
        set.add(variant.video);
      }
    }
    return set;
  }

  /**
   * Go over a manifest and issue warnings for any suspicious properties.
   *
   */
  private static validateManifest_(manifest: shaka.extern.Manifest) {
    const videos = new Set(manifest.variants.map((v) => v.video));
    const audios = new Set(manifest.variants.map((v) => v.audio));
    const texts = manifest.textStreams;
    if (videos.size > 1) {
      log.warning('Multiple video tracks selected to be stored');
    }
    for (const audio1 of audios) {
      for (const audio2 of audios) {
        if (audio1 != audio2 && audio1.language == audio2.language) {
          log.warning(
              'Similar audio tracks were selected to be stored', audio1.id,
              audio2.id);
        }
      }
    }
    for (const text1 of texts) {
      for (const text2 of texts) {
        if (text1 != text2 && text1.language == text2.language) {
          log.warning(
              'Similar text tracks were selected to be stored', text1.id,
              text2.id);
        }
      }
    }
  }
}

export const defaultSystemIds_ =
    (new Map())
        .set('org.w3.clearkey', '1077efecc0b24d02ace33c1e52e2fb4b')
        .set('com.widevine.alpha', 'edef8ba979d64acea3c827dcd51d21ed')
        .set('com.microsoft.playready', '9a04f07998404286ab92e65be0885f95')
        .set(
            'com.microsoft.playready.recommendation',
            '9a04f07998404286ab92e65be0885f95')
        .set(
            'com.microsoft.playready.software',
            '9a04f07998404286ab92e65be0885f95')
        .set(
            'com.microsoft.playready.hardware',
            '9a04f07998404286ab92e65be0885f95')
        .set('com.adobe.primetime', 'f239e769efa348509c16a903c6932efb');
Player.registerSupportPlugin('offline', Storage.support);
