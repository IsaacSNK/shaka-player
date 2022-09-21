/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.require('goog.Uri');
import {asserts} from './debug___asserts';
import * as assertsExports from './debug___asserts';
import {ManifestTextParser} from './hls___manifest_text_parser';
import * as ManifestTextParserExports from './hls___manifest_text_parser';
import {Playlist} from './hls___hls_classes';
import {PlaylistType} from './hls___hls_classes';
import {Tag} from './hls___hls_classes';
import {Utils} from './hls___hls_utils';
import {log} from './debug___log';
import * as logExports from './debug___log';
import {DrmEngine} from './media___drm_engine';
import * as DrmEngineExports from './media___drm_engine';
import {InitSegmentReference} from './media___segment_reference';
import {ManifestParser} from './media___manifest_parser';
import * as ManifestParserExports from './media___manifest_parser';
import {MediaSourceEngine} from './media___media_source_engine';
import * as MediaSourceEngineExports from './media___media_source_engine';
import {PresentationTimeline} from './media___presentation_timeline';
import {SegmentIndex} from './media___segment_index';
import {SegmentReference} from './media___segment_reference';
import * as SegmentReferenceExports from './media___segment_reference';
import {DataUriPlugin} from './net___data_uri_plugin';
import {NetworkingEngine} from './net___networking_engine';
import * as NetworkingEngineExports from './net___networking_engine';
import {ArrayUtils} from './util___array_utils';
import {BufferUtils} from './util___buffer_utils';
import {CmcdManager} from './util___cmcd_manager';
import * as CmcdManagerExports from './util___cmcd_manager';
import {Error} from './util___error';
import * as ErrorExports from './util___error';
import {FakeEvent} from './util___fake_event';
import * as FakeEventExports from './util___fake_event';
import {Functional} from './util___functional';
import {LanguageUtils} from './util___language_utils';
import * as LanguageUtilsExports from './util___language_utils';
import {ManifestParserUtils} from './util___manifest_parser_utils';
import * as ManifestParserUtilsExports from './util___manifest_parser_utils';
import {MimeUtils} from './util___mime_utils';
import * as MimeUtilsExports from './util___mime_utils';
import {OperationManager} from './util___operation_manager';
import {Pssh} from './util___pssh';
import {Timer} from './util___timer';
import {Platform} from './util___platform';
import * as PlatformExports from './util___platform';
import {Uint8ArrayUtils} from './util___uint8array_utils';
import {XmlUtils} from './util___xml_utils';
import {Segment} from './hls___hls_classes';

/**
 * HLS parser.
 *
 * @export
 */
export class HlsParser implements shaka.
extern.ManifestParser {
  private playerInterface_: shaka.extern.ManifestParser.PlayerInterface|null =
      null;
  private config_: shaka.extern.ManifestConfiguration|null = null;
  private globalId_: number = 1;
  private globalVariables_: Map<string, string>;

  /**
   * A map from group id to stream infos created from the media tags.
   */
  private groupIdToStreamInfosMap_: Map<string, (StreamInfo | null)[]>;

  /**
   * The values are strings of the form "<VIDEO URI> - <AUDIO URI>",
   * where the URIs are the verbatim media playlist URIs as they appeared in
   * the master playlist.
   *
   * Used to avoid duplicates that vary only in their text stream.
   *
   */
  private variantUriSet_: Set<string>;

  /**
   * A map from (verbatim) media playlist URI to stream infos representing the
   * playlists.
   *
   * On update, used to iterate through and update from media playlists.
   *
   * On initial parse, used to iterate through and determine minimum
   * timestamps, offsets, and to handle TS rollover.
   *
   * During parsing, used to avoid duplicates in the async methods
   * createStreamInfoFromMediaTag_, createStreamInfoFromImageTag_ and
   * createStreamInfoFromVariantTag_.
   *
   */
  private uriToStreamInfosMap_: Map<string, StreamInfo>;
  private presentationTimeline_: PresentationTimeline|null = null;

  /**
   * The master playlist URI, after redirects.
   *
   */
  private masterPlaylistUri_: string = '';
  private manifestTextParser_: ManifestTextParser;

  /**
   * This is the number of seconds we want to wait between finishing a
   * manifest update and starting the next one. This will be set when we parse
   * the manifest.
   *
   */
  private updatePlaylistDelay_: number = 0;

  /**
   * If true, we have already calculated offsets to synchronize streams.
   * Offsets are computed in syncStreams*_().
   */
  private streamsSynced_: boolean = false;

  /**
   * The minimum sequence number for generated segments, when ignoring
   * EXT-X-PROGRAM-DATE-TIME.
   *
   */
  private minSequenceNumber_: number|null = null;

  /**
   * This timer is used to trigger the start of a manifest update. A manifest
   * update is async. Once the update is finished, the timer will be restarted
   * to trigger the next update. The timer will only be started if the content
   * is live content.
   *
   */
  private updatePlaylistTimer_: Timer;
  private presentationType_: PresentationType_;
  private manifest_: shaka.extern.Manifest|null = null;
  private maxTargetDuration_: number = 0;
  private minTargetDuration_: number = Infinity;

  /**
   * Partial segments target duration.
   */
  private partialTargetDuration_: number = 0;
  private lowLatencyPresentationDelay_: number = 0;
  private operationManager_: OperationManager;
  private segmentsToNotifyByStream_: SegmentReference[][] = [];

  /**
   * A map from closed captions' group id, to a map of closed captions info.
   * {group id -> {closed captions channel id -> language}}
   */
  private groupIdToClosedCaptionsMap_: Map<string, Map<string, string>>;
  private groupIdToCodecsMap_: Map<string, string>;

  /**
   * A cache mapping EXT-X-MAP tag info to the InitSegmentReference created
   * from the tag.
   * The key is a string combining the EXT-X-MAP tag's absolute uri, and
   * its BYTERANGE if available.
   * {!Map.<string, !shaka.media.InitSegmentReference>}
   */
  mapTagToInitSegmentRefMap_: any;
  private lowLatencyMode_: boolean = false;

  /**
   * Creates an Hls Parser object.
   */
  constructor() {
    this.globalVariables_ = new Map();
    this.groupIdToStreamInfosMap_ = new Map();
    this.variantUriSet_ = new Set();
    this.uriToStreamInfosMap_ = new Map();
    this.manifestTextParser_ = new ManifestTextParser();
    this.updatePlaylistTimer_ = new Timer(() => {
      this.onUpdate_();
    });
    this.presentationType_ = PresentationType_.VOD;
    this.operationManager_ = new OperationManager();
    this.groupIdToClosedCaptionsMap_ = new Map();
    this.groupIdToCodecsMap_ = new Map();
    this.mapTagToInitSegmentRefMap_ = new Map();
  }

  /**
   * @override
   * @exportInterface
   */
  configure(config) {
    this.config_ = config;
  }

  /**
   * @override
   * @exportInterface
   */
  async start(uri, playerInterface) {
    asserts.assert(this.config_, 'Must call configure() before start()!');
    this.playerInterface_ = playerInterface;
    this.lowLatencyMode_ = playerInterface.isLowLatencyMode();
    const response = await this.requestManifest_(uri);

    // Record the master playlist URI after redirects.
    this.masterPlaylistUri_ = response.uri;
    asserts.assert(response.data, 'Response data should be non-null!');
    await this.parseManifest_(response.data, uri);

    // Start the update timer if we want updates.
    const delay = this.updatePlaylistDelay_;
    if (delay > 0) {
      this.updatePlaylistTimer_.tickAfter(
          /* seconds= */
          delay);
    }
    asserts.assert(this.manifest_, 'Manifest should be non-null');
    return this.manifest_;
  }

  /**
   * @override
   * @exportInterface
   */
  stop() {
    // Make sure we don't update the manifest again. Even if the timer is not
    // running, this is safe to call.
    if (this.updatePlaylistTimer_) {
      this.updatePlaylistTimer_.stop();
      this.updatePlaylistTimer_ = null;
    }
    const pending: Promise[] = [];
    if (this.operationManager_) {
      pending.push(this.operationManager_.destroy());
      this.operationManager_ = null;
    }
    this.playerInterface_ = null;
    this.config_ = null;
    this.variantUriSet_.clear();
    this.manifest_ = null;
    this.uriToStreamInfosMap_.clear();
    this.groupIdToStreamInfosMap_.clear();
    this.groupIdToCodecsMap_.clear();
    this.globalVariables_.clear();
    return Promise.all(pending);
  }

  /**
   * @override
   * @exportInterface
   */
  async update() {
    if (!this.isLive_()) {
      return;
    }
    const updates: Promise[] = [];
    const streamInfos = Array.from(this.uriToStreamInfosMap_.values());

    // Wait for the first stream info created, so that the start time is fetched
    // and can be reused.
    if (streamInfos.length) {
      await this.updateStream_(streamInfos[0]);
    }
    for (let i = 1; i < streamInfos.length; i++) {
      updates.push(this.updateStream_(streamInfos[i]));
    }
    await Promise.all(updates);
  }

  /**
   * Updates a stream.
   *
   */
  private async updateStream_(streamInfo: StreamInfo): Promise {
    const PresentationType = PresentationType_;
    const manifestUri = streamInfo.absoluteMediaPlaylistUri;
    const uriObj = new goog.Uri(manifestUri);
    if (this.lowLatencyMode_ && streamInfo.canSkipSegments) {
      // Enable delta updates. This will replace older segments with
      // 'EXT-X-SKIP' tag in the media playlist.
      uriObj.setQueryData(new goog.Uri.QueryData('_HLS_skip=YES'));
    }
    const response = await this.requestManifest_(uriObj.toString());
    const playlist: Playlist =
        this.manifestTextParser_.parsePlaylist(response.data, response.uri);
    if (playlist.type != PlaylistType.MEDIA) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.HLS_INVALID_PLAYLIST_HIERARCHY);
    }
    const variablesTags: Tag[] =
        Utils.filterTagsByName(playlist.tags, 'EXT-X-DEFINE');
    const mediaVariables = this.parseMediaVariables_(variablesTags);
    const stream = streamInfo.stream;
    const segments = this.createSegments_(
        streamInfo.verbatimMediaPlaylistUri, playlist, stream.type,
        stream.mimeType, streamInfo.mediaSequenceToStartTime, mediaVariables,
        stream.codecs);
    stream.segmentIndex.mergeAndEvict(
        segments, this.presentationTimeline_.getSegmentAvailabilityStart());
    if (segments.length) {
      const mediaSequenceNumber = Utils.getFirstTagWithNameAsNumber(
          playlist.tags, 'EXT-X-MEDIA-SEQUENCE', 0);
      const playlistStartTime =
          streamInfo.mediaSequenceToStartTime.get(mediaSequenceNumber);
      stream.segmentIndex.evict(playlistStartTime);
    }
    const newestSegment = segments[segments.length - 1];
    asserts.assert(newestSegment, 'Should have segments!');

    // Once the last segment has been added to the playlist,
    // #EXT-X-ENDLIST tag will be appended.
    // If that happened, treat the rest of the EVENT presentation as VOD.
    const endListTag =
        Utils.getFirstTagWithName(playlist.tags, 'EXT-X-ENDLIST');
    if (endListTag) {
      // Convert the presentation to VOD and set the duration to the last
      // segment's end time.
      this.setPresentationType_(PresentationType.VOD);
      this.presentationTimeline_.setDuration(newestSegment.endTime);
    }
  }

  /**
   * @override
   * @exportInterface
   */
  onExpirationUpdated(sessionId, expiration) {}

  // No-op
  /**
   * Align all streams by sequence number by dropping early segments.  Then
   * offset all streams to begin at presentation time 0.
   */
  private syncStreamsWithSequenceNumber_() {
    if (this.streamsSynced_) {
      return;
    }

    // Sync using media sequence number.  Find the highest starting sequence
    // number among all streams.  Later, we will drop any references to
    // earlier segments in other streams, then offset everything back to 0.
    let highestStartingSequenceNumber = -1;
    const firstSequenceNumberMap = new Map();
    for (const streamInfo of this.uriToStreamInfosMap_.values()) {
      const segmentIndex = streamInfo.stream.segmentIndex;
      if (segmentIndex) {
        const segment0 = segmentIndex.earliestReference();
        if (segment0) {
          // This looks inefficient, but iteration order is insertion order.
          // So the very first entry should be the one we want.
          // We assert that this holds true so that we are alerted by debug
          // builds and tests if it changes.  We still do a loop, though, so
          // that the code functions correctly in production no matter what.
          if (goog.DEBUG) {
            const firstSequenceStartTime =
                streamInfo.mediaSequenceToStartTime.values().next().value;
            asserts.assert(
                firstSequenceStartTime == segment0.startTime,
                'Sequence number map is not ordered as expected!');
          }
          for (const [sequence, start] of streamInfo.mediaSequenceToStartTime) {
            if (start == segment0.startTime) {
              firstSequenceNumberMap.set(streamInfo, sequence);
              highestStartingSequenceNumber =
                  Math.max(highestStartingSequenceNumber, sequence);
              break;
            }
          }
        }
      }
    }
    if (highestStartingSequenceNumber < 0) {
      // Nothing to sync.
      return;
    }

    // From now on, updates will ignore any references before this number.
    this.minSequenceNumber_ = highestStartingSequenceNumber;
    log.debug(
        'Syncing HLS streams against base sequence number:',
        this.minSequenceNumber_);
    for (const streamInfo of this.uriToStreamInfosMap_.values()) {
      const segmentIndex = streamInfo.stream.segmentIndex;
      if (segmentIndex) {
        // Drop any earlier references.
        const numSegmentsToDrop =
            this.minSequenceNumber_ - firstSequenceNumberMap.get(streamInfo);
        segmentIndex.dropFirstReferences(numSegmentsToDrop);

        // Now adjust timestamps back to begin at 0.
        const segmentN = segmentIndex.earliestReference();
        if (segmentN) {
          this.offsetStream_(streamInfo, -segmentN.startTime);
        }
      }
    }
    this.streamsSynced_ = true;
  }

  /**
   * Synchronize streams by the EXT-X-PROGRAM-DATE-TIME tags attached to their
   * segments.  Also normalizes segment times so that the earliest segment in
   * any stream is at time 0.
   */
  private syncStreamsWithProgramDateTime_() {
    if (this.streamsSynced_) {
      return;
    }
    let lowestSyncTime = Infinity;
    for (const streamInfo of this.uriToStreamInfosMap_.values()) {
      const segmentIndex = streamInfo.stream.segmentIndex;
      if (segmentIndex) {
        const segment0 = segmentIndex.earliestReference();
        if (segment0 != null && segment0.syncTime != null) {
          lowestSyncTime = Math.min(lowestSyncTime, segment0.syncTime);
        }
      }
    }
    if (lowestSyncTime == Infinity) {
      // Nothing to sync.
      return;
    }
    log.debug('Syncing HLS streams against base time:', lowestSyncTime);
    for (const streamInfo of this.uriToStreamInfosMap_.values()) {
      const segmentIndex = streamInfo.stream.segmentIndex;
      if (segmentIndex != null) {
        const segment0 = segmentIndex.earliestReference();
        if (segment0.syncTime == null) {
          log.alwaysError(
              'Missing EXT-X-PROGRAM-DATE-TIME for stream',
              streamInfo.verbatimMediaPlaylistUri, 'Expect AV sync issues!');
        } else {
          // The first segment's target startTime should be based entirely on
          // its syncTime.  The rest of the stream will be based on that
          // starting point.  The earliest segment sync time from any stream
          // will become presentation time 0.  If two streams start e.g. 6
          // seconds apart in syncTime, then their first segments will also
          // start 6 seconds apart in presentation time.
          const segment0TargetTime = segment0.syncTime - lowestSyncTime;
          const streamOffset = segment0TargetTime - segment0.startTime;
          this.offsetStream_(streamInfo, streamOffset);
        }
      }
    }
    this.streamsSynced_ = true;
  }

  private offsetStream_(streamInfo: StreamInfo, offset: number) {
    streamInfo.stream.segmentIndex.offset(offset);
    streamInfo.maxTimestamp += offset;
    asserts.assert(
        streamInfo.maxTimestamp >= 0,
        'Negative maxTimestamp after adjustment!');
    for (const [key, value] of streamInfo.mediaSequenceToStartTime) {
      streamInfo.mediaSequenceToStartTime.set(key, value + offset);
    }
    log.debug(
        'Offset', offset, 'applied to', streamInfo.verbatimMediaPlaylistUri);
  }

  /**
   * Parses the manifest.
   *
   */
  private async parseManifest_(data: BufferSource, uri: string): Promise {
    const Utils = Utils;
    asserts.assert(
        this.masterPlaylistUri_,
        'Master playlist URI must be set before calling parseManifest_!');
    const playlist =
        this.manifestTextParser_.parsePlaylist(data, this.masterPlaylistUri_);
    const variablesTags: Tag[] =
        Utils.filterTagsByName(playlist.tags, 'EXT-X-DEFINE');
    this.parseMasterVariables_(variablesTags);
    let variants: shaka.extern.Variant[] = [];
    let textStreams: shaka.extern.Stream[] = [];
    let imageStreams: shaka.extern.Stream[] = [];

    // Parsing a media playlist results in a single-variant stream.
    if (playlist.type == PlaylistType.MEDIA) {
      // Get necessary info for this stream, from the config. These are things
      // we would normally find from the master playlist (e.g. from values on
      // EXT-X-MEDIA tags).
      const fullMimeType = this.config_.hls.mediaPlaylistFullMimeType;
      const mimeType = MimeUtils.getBasicType(fullMimeType);
      const type = mimeType.split('/')[0];
      const codecs = MimeUtils.getCodecs(fullMimeType);

      // Some values we cannot figure out, and aren't important enough to ask
      // the user to provide through config values. A lot of these are only
      // relevant to ABR, which isn't necessary if there's only one variant.
      // So these unknowns should be set to false or null, largely.
      const language = '';
      const channelsCount = null;
      const spatialAudio = false;
      const characteristics = null;
      const closedCaptions = new Map();
      const forced = false;

      // Only relevant for text.
      const primary = true;

      // This is the only stream!
      const name = 'Media Playlist';

      // Make the stream info, with those values.
      const streamInfo = await this.convertParsedPlaylistIntoStreamInfo_(
          playlist, uri, uri, codecs, type, language, primary, name,
          channelsCount, closedCaptions, characteristics, forced, spatialAudio,
          mimeType);
      this.uriToStreamInfosMap_.set(uri, streamInfo);

      // Wrap the stream from that stream info with a variant.
      variants.push({
        id: 0,
        language: 'und',
        disabledUntilTime: 0,
        primary: true,
        audio: type == 'audio' ? streamInfo.stream : null,
        video: type == 'video' ? streamInfo.stream : null,
        bandwidth: 0,
        allowedByApplication: true,
        allowedByKeySystem: true,
        decodingInfos: []
      });
    } else {
      const mediaTags: Tag[] =
          Utils.filterTagsByName(playlist.tags, 'EXT-X-MEDIA');
      const variantTags: Tag[] =
          Utils.filterTagsByName(playlist.tags, 'EXT-X-STREAM-INF');
      const imageTags: Tag[] =
          Utils.filterTagsByName(playlist.tags, 'EXT-X-IMAGE-STREAM-INF');
      this.parseCodecs_(variantTags);
      const sesionDataTags: Tag[] =
          Utils.filterTagsByName(playlist.tags, 'EXT-X-SESSION-DATA');
      for (const tag of sesionDataTags) {
        const id = tag.getAttributeValue('DATA-ID');
        const uri = tag.getAttributeValue('URI');
        const language = tag.getAttributeValue('LANGUAGE');
        const value = tag.getAttributeValue('VALUE');
        const data = (new Map()).set('id', id);
        if (uri) {
          data.set(
              'uri', Utils.constructAbsoluteUri(this.masterPlaylistUri_, uri));
        }
        if (language) {
          data.set('language', language);
        }
        if (value) {
          data.set('value', value);
        }
        const event = new FakeEvent('sessiondata', data);
        if (this.playerInterface_) {
          this.playerInterface_.onEvent(event);
        }
      }

      // Parse audio and video media tags first, so that we can extract segment
      // start time from audio/video streams and reuse for text streams.
      await this.createStreamInfosFromMediaTags_(mediaTags);
      this.parseClosedCaptions_(mediaTags);
      variants = await this.createVariantsForTags_(variantTags);
      textStreams = await this.parseTexts_(mediaTags);
      imageStreams = await this.parseImages_(imageTags);
    }

    // Make sure that the parser has not been destroyed.
    if (!this.playerInterface_) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
          ErrorExports.Code.OPERATION_ABORTED);
    }

    // Now that we have generated all streams, we can determine the offset to
    // apply to sync times.
    if (this.config_.hls.ignoreManifestProgramDateTime) {
      this.syncStreamsWithSequenceNumber_();
    } else {
      this.syncStreamsWithProgramDateTime_();
    }

    // Find the min and max timestamp of the earliest segment in all streams.
    // Find the minimum duration of all streams as well.
    let minDuration = Infinity;
    for (const streamInfo of this.uriToStreamInfosMap_.values()) {
      if (streamInfo.stream.type != 'text') {
        // Since everything is already offset to 0 (either by sync or by being
        // VOD), only maxTimestamp is necessary to compute the duration.
        minDuration = Math.min(minDuration, streamInfo.maxTimestamp);
      }
    }

    // This assert is our own sanity check.
    asserts.assert(
        this.presentationTimeline_ == null,
        'Presentation timeline created early!');
    this.createPresentationTimeline_();

    // This assert satisfies the compiler that it is not null for the rest of
    // the method.
    asserts.assert(
        this.presentationTimeline_, 'Presentation timeline not created!');
    if (this.isLive_()) {
      // The HLS spec (RFC 8216) states in 6.3.4:
      // "the client MUST wait for at least the target duration before
      // attempting to reload the Playlist file again".
      // For LL-HLS, the server must add a new partial segment to the Playlist
      // every part target duration.
      this.updatePlaylistDelay_ = this.minTargetDuration_;

      // The spec says nothing much about seeking in live content, but Safari's
      // built-in HLS implementation does not allow it.  Therefore we will set
      // the availability window equal to the presentation delay.  The player
      // will be able to buffer ahead three segments, but the seek window will
      // be zero-sized.
      const PresentationType = PresentationType_;
      if (this.presentationType_ == PresentationType.LIVE) {
        // This defaults to the presentation delay, which has the effect of
        // making the live stream unseekable.  This is consistent with Apple's
        // HLS implementation.
        let segmentAvailabilityDuration = this.presentationTimeline_.getDelay();

        // The app can override that with a longer duration, to allow seeking.
        if (!isNaN(this.config_.availabilityWindowOverride)) {
          segmentAvailabilityDuration = this.config_.availabilityWindowOverride;
        }
        this.presentationTimeline_.setSegmentAvailabilityDuration(
            segmentAvailabilityDuration);
      }
    } else {
      // Use the minimum duration as the presentation duration.
      this.presentationTimeline_.setDuration(minDuration);
      for (const streamInfo of this.uriToStreamInfosMap_.values()) {
        // Fit the segments to the playlist duration.
        streamInfo.stream.segmentIndex.fit(
            /* periodStart= */
            0, minDuration);
      }
    }

    // Now that the content has been fit, notify segments.
    this.segmentsToNotifyByStream_ = [];
    const streamsToNotify = [];
    for (const variant of variants) {
      for (const stream of [variant.video, variant.audio]) {
        if (stream) {
          streamsToNotify.push(stream);
        }
      }
    }
    await Promise.all(streamsToNotify.map(async (stream) => {
      await stream.createSegmentIndex();
    }));
    for (const stream of streamsToNotify) {
      this.segmentsToNotifyByStream_.push(stream.segmentIndex.references);
    }
    this.notifySegments_();

    // This is the first point where we have a meaningful presentation start
    // time, and we need to tell PresentationTimeline that so that it can
    // maintain consistency from here on.
    this.presentationTimeline_.lockStartTime();

    // This asserts that the live edge is being calculated from segment times.
    // For VOD and event streams, this check should still pass.
    asserts.assert(
        !this.presentationTimeline_.usingPresentationStartTime(),
        'We should not be using the presentation start time in HLS!');
    this.manifest_ = {
      presentationTimeline: this.presentationTimeline_,
      variants,
      textStreams,
      imageStreams,
      offlineSessionIds: [],
      minBufferTime: 0,
      sequenceMode: true
    };
    this.playerInterface_.makeTextStreamsForClosedCaptions(this.manifest_);
  }

  /**
   * Get the variables of each variant tag, and store in a map.
   * @param tags Variant tags from the playlist.
   */
  private parseMasterVariables_(tags: Tag[]) {
    for (const variableTag of tags) {
      const name = variableTag.getAttributeValue('NAME');
      const value = variableTag.getAttributeValue('VALUE');
      if (name && value) {
        if (!this.globalVariables_.has(name)) {
          this.globalVariables_.set(name, value);
        }
      }
    }
  }

  /**
   * Get the variables of each variant tag, and store in a map.
   * @param tags Variant tags from the playlist.
   */
  private parseMediaVariables_(tags: Tag[]): Map<string, string> {
    const mediaVariables = new Map();
    for (const variableTag of tags) {
      const name = variableTag.getAttributeValue('NAME');
      const value = variableTag.getAttributeValue('VALUE');
      const mediaImport = variableTag.getAttributeValue('IMPORT');
      if (name && value) {
        mediaVariables.set(name, value);
      }
      if (mediaImport) {
        const globalValue = this.globalVariables_.get(mediaImport);
        if (globalValue) {
          mediaVariables.set(mediaImport, globalValue);
        }
      }
    }
    return mediaVariables;
  }

  /**
   * Get the codecs of each variant tag, and store in a map from
   * audio/video/subtitle group id to the codecs arraylist.
   * @param tags Variant tags from the playlist.
   */
  private parseCodecs_(tags: Tag[]) {
    const ContentType = ManifestParserUtilsExports.ContentType;
    for (const variantTag of tags) {
      const audioGroupId = variantTag.getAttributeValue('AUDIO');
      const videoGroupId = variantTag.getAttributeValue('VIDEO');
      const subGroupId = variantTag.getAttributeValue('SUBTITLES');
      const allCodecs = this.getCodecsForVariantTag_(variantTag);
      if (subGroupId) {
        const textCodecs =
            ManifestParserUtils.guessCodecsSafe(ContentType.TEXT, allCodecs);
        asserts.assert(textCodecs != null, 'Text codecs should be valid.');
        this.groupIdToCodecsMap_.set(subGroupId, textCodecs);
        ArrayUtils.remove(allCodecs, textCodecs);
      }
      if (audioGroupId) {
        const codecs =
            ManifestParserUtils.guessCodecs(ContentType.AUDIO, allCodecs);
        this.groupIdToCodecsMap_.set(audioGroupId, codecs);
      }
      if (videoGroupId) {
        const codecs =
            ManifestParserUtils.guessCodecs(ContentType.VIDEO, allCodecs);
        this.groupIdToCodecsMap_.set(videoGroupId, codecs);
      }
    }
  }

  /**
   * Parse Subtitles and Closed Captions from 'EXT-X-MEDIA' tags.
   * Create text streams for Subtitles, but not Closed Captions.
   *
   * @param mediaTags Media tags from the playlist.
   */
  private async parseTexts_(mediaTags: Tag[]): Promise<shaka.extern.Stream[]> {
    // Create text stream for each Subtitle media tag.
    const subtitleTags = Utils.filterTagsByType(mediaTags, 'SUBTITLES');
    const textStreamPromises = subtitleTags.map(async (tag) => {
      const disableText = this.config_.disableText;
      if (disableText) {
        return null;
      }
      try {
        const streamInfo = await this.createStreamInfoFromMediaTag_(tag);
        return streamInfo.stream;
      } catch (e) {
        if (this.config_.hls.ignoreTextStreamFailures) {
          return null;
        }
        throw e;
      }
    });
    const textStreams = await Promise.all(textStreamPromises);

    // Set the codecs for text streams.
    for (const tag of subtitleTags) {
      const groupId = tag.getRequiredAttrValue('GROUP-ID');
      const codecs = this.groupIdToCodecsMap_.get(groupId);
      if (codecs) {
        const textStreamInfos = this.groupIdToStreamInfosMap_.get(groupId);
        if (textStreamInfos) {
          for (const textStreamInfo of textStreamInfos) {
            textStreamInfo.stream.codecs = codecs;
          }
        }
      }
    }

    // Do not create text streams for Closed captions.
    return textStreams.filter((s) => s);
  }

  /**
   * @param imageTags from the playlist.
   */
  private async parseImages_(imageTags: Tag[]): Promise<shaka.extern.Stream[]> {
    // Create image stream for each image tag.
    const imageStreamPromises = imageTags.map(async (tag) => {
      const disableThumbnails = this.config_.disableThumbnails;
      if (disableThumbnails) {
        return null;
      }
      try {
        const streamInfo = await this.createStreamInfoFromImageTag_(tag);
        return streamInfo.stream;
      } catch (e) {
        if (this.config_.hls.ignoreImageStreamFailures) {
          return null;
        }
        throw e;
      }
    });
    const imageStreams = await Promise.all(imageStreamPromises);
    return imageStreams.filter((s) => s);
  }

  /**
   * @param mediaTags Media tags from the playlist.
   */
  private async createStreamInfosFromMediaTags_(mediaTags: Tag[]) {
    // Filter out subtitles and  media tags without uri.
    mediaTags = mediaTags.filter((tag) => {
      const uri = tag.getAttributeValue('URI') || '';
      const type = tag.getAttributeValue('TYPE');
      return type != 'SUBTITLES' && uri != '';
    });

    // Create stream info for each audio / video media tag.
    const promises = mediaTags.map((tag) => {
      return this.createStreamInfoFromMediaTag_(tag);
    });
    await Promise.all(promises);
  }

  /**
   * @param tags Variant tags from the playlist.
   */
  private async createVariantsForTags_(tags: Tag[]):
      Promise<shaka.extern.Variant[]> {
    // Create variants for each variant tag.
    const variantsPromises = tags.map(async (tag) => {
      const frameRate = tag.getAttributeValue('FRAME-RATE');
      const bandwidth = Number(tag.getAttributeValue('AVERAGE-BANDWIDTH')) ||
          Number(tag.getRequiredAttrValue('BANDWIDTH'));
      const resolution = tag.getAttributeValue('RESOLUTION');
      const [width, height] = resolution ? resolution.split('x') : [null, null];
      const videoRange = tag.getAttributeValue('VIDEO-RANGE');
      const streamInfos = await this.createStreamInfosForVariantTag_(
          tag, resolution, frameRate);
      asserts.assert(
          streamInfos.audio.length || streamInfos.video.length,
          'We should have created a stream!');
      return this.createVariants_(
          streamInfos.audio, streamInfos.video, bandwidth, width, height,
          frameRate, videoRange);
    });
    const allVariants = await Promise.all(variantsPromises);
    let variants = allVariants.reduce(Functional.collapseArrays, []);

    // Filter out null variants.
    variants = variants.filter((variant) => variant != null);
    return variants;
  }

  /**
   * Create audio and video streamInfos from an 'EXT-X-STREAM-INF' tag and its
   * related media tags.
   *
   */
  private async createStreamInfosForVariantTag_(
      tag: Tag, resolution: string|null,
      frameRate: string|null): Promise<StreamInfos> {
    const ContentType = ManifestParserUtilsExports.ContentType;
    let allCodecs: string[] = this.getCodecsForVariantTag_(tag);
    const audioGroupId = tag.getAttributeValue('AUDIO');
    const videoGroupId = tag.getAttributeValue('VIDEO');
    asserts.assert(
        audioGroupId == null || videoGroupId == null,
        'Unexpected: both video and audio described by media tags!');
    const groupId = audioGroupId || videoGroupId;
    const streamInfos = groupId && this.groupIdToStreamInfosMap_.has(groupId) ?
        this.groupIdToStreamInfosMap_.get(groupId) :
        [];
    const res: StreamInfos = {
      audio: audioGroupId ? streamInfos : [],
      video: videoGroupId ? streamInfos : []
    };

    // Make an educated guess about the stream type.
    log.debug('Guessing stream type for', tag.toString());
    let type;
    let ignoreStream = false;

    // The Microsoft HLS manifest generators will make audio-only variants
    // that link to their URI both directly and through an audio tag.
    // In that case, ignore the local URI and use the version in the
    // AUDIO tag, so you inherit its language.
    // As an example, see the manifest linked in issue #860.
    const streamURI = tag.getRequiredAttrValue('URI');
    const hasSameUri = res.audio.find((audio) => {
      return audio && audio.verbatimMediaPlaylistUri == streamURI;
    });
    const videoCodecs =
        ManifestParserUtils.guessCodecsSafe(ContentType.VIDEO, allCodecs);
    const audioCodecs =
        ManifestParserUtils.guessCodecsSafe(ContentType.AUDIO, allCodecs);
    if (audioCodecs && !videoCodecs) {
      // There are no associated media tags, and there's only audio codec,
      // and no video codec, so it should be audio.
      type = ContentType.AUDIO;
      log.debug('Guessing audio-only.');
    } else {
      if (!streamInfos.length && audioCodecs && videoCodecs) {
        // There are both audio and video codecs, so assume multiplexed content.
        // Note that the default used when CODECS is missing assumes multiple
        // (and therefore multiplexed).
        // Recombine the codec strings into one so that MediaSource isn't
        // lied to later. (That would trigger an error in Chrome.)
        log.debug('Guessing multiplexed audio+video.');
        type = ContentType.VIDEO;
        allCodecs = [[videoCodecs, audioCodecs].join(',')];
      } else {
        if (res.audio.length && hasSameUri) {
          log.debug('Guessing audio-only.');
          type = ContentType.AUDIO;
          ignoreStream = true;
        } else {
          if (res.video.length) {
            // There are associated video streams.  Assume this is audio.
            log.debug('Guessing audio-only.');
            type = ContentType.AUDIO;
          } else {
            log.debug('Guessing video-only.');
            type = ContentType.VIDEO;
          }
        }
      }
    }
    if (!ignoreStream) {
      const streamInfo =
          await this.createStreamInfoFromVariantTag_(tag, allCodecs, type);
      res[streamInfo.stream.type] = [streamInfo];
    }
    this.filterLegacyCodecs_(res);
    return res;
  }

  /**
   * Get the codecs from the 'EXT-X-STREAM-INF' tag.
   *
   * @return codecs
   */
  private getCodecsForVariantTag_(tag: Tag): string[] {
    // These are the default codecs to assume if none are specified.
    const defaultCodecsArray = [];
    if (!this.config_.disableVideo) {
      defaultCodecsArray.push(this.config_.hls.defaultVideoCodec);
    }
    if (!this.config_.disableAudio) {
      defaultCodecsArray.push(this.config_.hls.defaultAudioCodec);
    }
    const defaultCodecs = defaultCodecsArray.join(',');
    const codecsString = tag.getAttributeValue('CODECS', defaultCodecs);

    // Strip out internal whitespace while splitting on commas:
    const codecs: string[] = codecsString.split(/\s*,\s*/);

    // Filter out duplicate codecs.
    const seen = new Set();
    const ret = [];
    for (const codec of codecs) {
      // HLS says the CODECS field needs to include all codecs that appear in
      // the content. This means that if the content changes profiles, it should
      // include both. Since all known browsers support changing profiles
      // without any other work, just ignore them.  See also:
      // https://github.com/shaka-project/shaka-player/issues/1817
      const shortCodec = MimeUtils.getCodecBase(codec);
      if (!seen.has(shortCodec)) {
        ret.push(codec);
        seen.add(shortCodec);
      } else {
        log.debug('Ignoring duplicate codec');
      }
    }
    return ret;
  }

  /**
   * Get the channel count information for an HLS audio track.
   * CHANNELS specifies an ordered, "/" separated list of parameters.
   * If the type is audio, the first parameter will be a decimal integer
   * specifying the number of independent, simultaneous audio channels.
   * No other channels parameters are currently defined.
   *
   */
  private getChannelsCount_(tag: Tag): number|null {
    const channels = tag.getAttributeValue('CHANNELS');
    if (!channels) {
      return null;
    }
    const channelcountstring = channels.split('/')[0];
    const count = parseInt(channelcountstring, 10);
    return count;
  }

  /**
   * Get the spatial audio information for an HLS audio track.
   * In HLS the channels field indicates the number of audio channels that the
   * stream has (eg: 2). In the case of Dolby Atmos, the complexity is
   * expressed with the number of channels followed by the word JOC
   * (eg: 16/JOC), so 16 would be the number of channels (eg: 7.3.6 layout),
   * and JOC indicates that the stream has spatial audio.
   * @see https://developer.apple.com/documentation/http_live_streaming/hls_authoring_specification_for_apple_devices/hls_authoring_specification_for_apple_devices_appendixes
   *
   */
  private isSpatialAudio_(tag: Tag): boolean {
    const channels = tag.getAttributeValue('CHANNELS');
    if (!channels) {
      return false;
    }
    return channels.includes('/JOC');
  }

  /**
   * Get the closed captions map information for the EXT-X-STREAM-INF tag, to
   * create the stream info.
   * @return closedCaptions
   */
  private getClosedCaptions_(tag: Tag, type: string): Map<string, string> {
    const ContentType = ManifestParserUtilsExports.ContentType;

    // The attribute of closed captions is optional, and the value may be
    // 'NONE'.
    const closedCaptionsAttr = tag.getAttributeValue('CLOSED-CAPTIONS');

    // EXT-X-STREAM-INF tags may have CLOSED-CAPTIONS attributes.
    // The value can be either a quoted-string or an enumerated-string with
    // the value NONE. If the value is a quoted-string, it MUST match the
    // value of the GROUP-ID attribute of an EXT-X-MEDIA tag elsewhere in the
    // Playlist whose TYPE attribute is CLOSED-CAPTIONS.
    if (type == ContentType.VIDEO && closedCaptionsAttr &&
        closedCaptionsAttr != 'NONE') {
      return this.groupIdToClosedCaptionsMap_.get(closedCaptionsAttr);
    }
    return null;
  }

  /**
   * Get the language value.
   *
   */
  private getLanguage_(tag: Tag): string {
    const LanguageUtils = LanguageUtils;
    const languageValue = tag.getAttributeValue('LANGUAGE') || 'und';
    return LanguageUtils.normalize(languageValue);
  }

  /**
   * Get the type value.
   * Shaka recognizes the content types 'audio', 'video' and 'text'.
   * The HLS 'subtitles' type needs to be mapped to 'text'.
   */
  private getType_(tag: Tag): string {
    let type = tag.getRequiredAttrValue('TYPE').toLowerCase();
    if (type == 'subtitles') {
      type = ManifestParserUtilsExports.ContentType.TEXT;
    }
    return type;
  }

  /**
   * Filters out unsupported codec strings from an array of stream infos.
   */
  private filterLegacyCodecs_(streamInfos: StreamInfos) {
    for (const streamInfo of streamInfos.audio.concat(streamInfos.video)) {
      if (!streamInfo) {
        continue;
      }
      let codecs = streamInfo.stream.codecs.split(',');
      codecs = codecs.filter((codec) => {
        // mp4a.40.34 is a nonstandard codec string that is sometimes used in
        // HLS for legacy reasons.  It is not recognized by non-Apple MSE.
        // See https://bugs.chromium.org/p/chromium/issues/detail?id=489520
        // Therefore, ignore this codec string.
        return codec != 'mp4a.40.34';
      });
      streamInfo.stream.codecs = codecs.join(',');
    }
  }

  private createVariants_(
      audioInfos: StreamInfo[], videoInfos: StreamInfo[], bandwidth: number,
      width: string|null, height: string|null, frameRate: string|null,
      videoRange: string|null): shaka.extern.Variant[] {
    const ContentType = ManifestParserUtilsExports.ContentType;
    const DrmEngine = DrmEngine;
    for (const info of videoInfos) {
      this.addVideoAttributes_(
          info.stream, width, height, frameRate, videoRange);
    }

    // In case of audio-only or video-only content or the audio/video is
    // disabled by the config, we create an array of one item containing
    // a null. This way, the double-loop works for all kinds of content.
    // NOTE: we currently don't have support for audio-only content.
    const disableAudio = this.config_.disableAudio;
    if (!audioInfos.length || disableAudio) {
      audioInfos = [null];
    }
    const disableVideo = this.config_.disableVideo;
    if (!videoInfos.length || disableVideo) {
      videoInfos = [null];
    }
    const variants = [];
    for (const audioInfo of audioInfos) {
      for (const videoInfo of videoInfos) {
        const audioStream = audioInfo ? audioInfo.stream : null;
        const videoStream = videoInfo ? videoInfo.stream : null;
        const audioDrmInfos = audioInfo ? audioInfo.stream.drmInfos : null;
        const videoDrmInfos = videoInfo ? videoInfo.stream.drmInfos : null;
        const videoStreamUri =
            videoInfo ? videoInfo.verbatimMediaPlaylistUri : '';
        const audioStreamUri =
            audioInfo ? audioInfo.verbatimMediaPlaylistUri : '';
        const variantUriKey = videoStreamUri + ' - ' + audioStreamUri;
        if (audioStream && videoStream) {
          if (!DrmEngine.areDrmCompatible(audioDrmInfos, videoDrmInfos)) {
            log.warning('Incompatible DRM info in HLS variant.  Skipping.');
            continue;
          }
        }
        if (this.variantUriSet_.has(variantUriKey)) {
          // This happens when two variants only differ in their text streams.
          log.debug('Skipping variant which only differs in text streams.');
          continue;
        }

        // Since both audio and video are of the same type, this assertion will
        // catch certain mistakes at runtime that the compiler would miss.
        asserts.assert(
            !audioStream || audioStream.type == ContentType.AUDIO,
            'Audio parameter mismatch!');
        asserts.assert(
            !videoStream || videoStream.type == ContentType.VIDEO,
            'Video parameter mismatch!');
        const variant = {
          id: this.globalId_++,
          language: audioStream ? audioStream.language : 'und',
          primary: !!audioStream && audioStream.primary ||
              !!videoStream && videoStream.primary,
          audio: audioStream,
          video: videoStream,
          bandwidth,
          allowedByApplication: true,
          allowedByKeySystem: true,
          decodingInfos: []
        };
        variants.push(variant);
        this.variantUriSet_.add(variantUriKey);
      }
    }
    return variants;
  }

  /**
   * Parses an array of EXT-X-MEDIA tags, then stores the values of all tags
   * with TYPE="CLOSED-CAPTIONS" into a map of group id to closed captions.
   *
   */
  private parseClosedCaptions_(mediaTags: Tag[]) {
    const closedCaptionsTags =
        Utils.filterTagsByType(mediaTags, 'CLOSED-CAPTIONS');
    for (const tag of closedCaptionsTags) {
      asserts.assert(
          tag.name == 'EXT-X-MEDIA', 'Should only be called on media tags!');
      const language = this.getLanguage_(tag);

      // The GROUP-ID value is a quoted-string that specifies the group to which
      // the Rendition belongs.
      const groupId = tag.getRequiredAttrValue('GROUP-ID');

      // The value of INSTREAM-ID is a quoted-string that specifies a Rendition
      // within the segments in the Media Playlist. This attribute is REQUIRED
      // if the TYPE attribute is CLOSED-CAPTIONS.
      const instreamId = tag.getRequiredAttrValue('INSTREAM-ID');
      if (!this.groupIdToClosedCaptionsMap_.get(groupId)) {
        this.groupIdToClosedCaptionsMap_.set(groupId, new Map());
      }
      this.groupIdToClosedCaptionsMap_.get(groupId).set(instreamId, language);
    }
  }

  /**
   * Parse EXT-X-MEDIA media tag into a Stream object.
   *
   */
  private async createStreamInfoFromMediaTag_(tag: Tag): Promise<StreamInfo> {
    asserts.assert(
        tag.name == 'EXT-X-MEDIA', 'Should only be called on media tags!');
    const groupId = tag.getRequiredAttrValue('GROUP-ID');
    let codecs = '';
    const type: string = this.getType_(tag);

    // Text does not require a codec.
    if (type != ManifestParserUtilsExports.ContentType.TEXT && groupId &&
        this.groupIdToCodecsMap_.has(groupId)) {
      codecs = this.groupIdToCodecsMap_.get(groupId);
    }
    const verbatimMediaPlaylistUri = this.variableSubstitution_(
        tag.getRequiredAttrValue('URI'), this.globalVariables_);

    // Check if the stream has already been created as part of another Variant
    // and return it if it has.
    if (this.uriToStreamInfosMap_.has(verbatimMediaPlaylistUri)) {
      return this.uriToStreamInfosMap_.get(verbatimMediaPlaylistUri);
    }
    const language = this.getLanguage_(tag);
    const name = tag.getAttributeValue('NAME');

    // NOTE: According to the HLS spec, "DEFAULT=YES" requires "AUTOSELECT=YES".
    // However, we don't bother to validate "AUTOSELECT", since we don't
    // actually use it in our streaming model, and we treat everything as
    // "AUTOSELECT=YES".  A value of "AUTOSELECT=NO" would imply that it may
    // only be selected explicitly by the user, and we don't have a way to
    // represent that in our model.
    const defaultAttrValue = tag.getAttributeValue('DEFAULT');
    const primary = defaultAttrValue == 'YES';
    const channelsCount = type == 'audio' ? this.getChannelsCount_(tag) : null;
    const spatialAudio = type == 'audio' ? this.isSpatialAudio_(tag) : false;
    const characteristics = tag.getAttributeValue('CHARACTERISTICS');
    const forcedAttrValue = tag.getAttributeValue('FORCED');
    const forced = forcedAttrValue == 'YES';

    // TODO: Should we take into account some of the currently ignored
    // attributes: INSTREAM-ID, Attribute descriptions: https://bit.ly/2lpjOhj
    const streamInfo = await this.createStreamInfo_(
        verbatimMediaPlaylistUri, codecs, type, language, primary, name,
        channelsCount,
        /* closedCaptions= */
        null, characteristics, forced, spatialAudio);
    if (this.groupIdToStreamInfosMap_.has(groupId)) {
      this.groupIdToStreamInfosMap_.get(groupId).push(streamInfo);
    } else {
      this.groupIdToStreamInfosMap_.set(groupId, [streamInfo]);
    }

    // TODO: This check is necessary because of the possibility of multiple
    // calls to createStreamInfoFromMediaTag_ before either has resolved.
    if (this.uriToStreamInfosMap_.has(verbatimMediaPlaylistUri)) {
      return this.uriToStreamInfosMap_.get(verbatimMediaPlaylistUri);
    }
    this.uriToStreamInfosMap_.set(verbatimMediaPlaylistUri, streamInfo);
    return streamInfo;
  }

  /**
   * Parse EXT-X-MEDIA media tag into a Stream object.
   *
   */
  private async createStreamInfoFromImageTag_(tag: Tag): Promise<StreamInfo> {
    asserts.assert(
        tag.name == 'EXT-X-IMAGE-STREAM-INF',
        'Should only be called on image tags!');
    const type: string = ManifestParserUtilsExports.ContentType.IMAGE;
    const verbatimImagePlaylistUri = this.variableSubstitution_(
        tag.getRequiredAttrValue('URI'), this.globalVariables_);
    const codecs = tag.getAttributeValue('CODECS', 'jpeg') || '';

    // Check if the stream has already been created as part of another Variant
    // and return it if it has.
    if (this.uriToStreamInfosMap_.has(verbatimImagePlaylistUri)) {
      return this.uriToStreamInfosMap_.get(verbatimImagePlaylistUri);
    }
    const language = this.getLanguage_(tag);
    const name = tag.getAttributeValue('NAME');
    const characteristics = tag.getAttributeValue('CHARACTERISTICS');
    const streamInfo = await this.createStreamInfo_(
        verbatimImagePlaylistUri, codecs, type, language,
        /* primary= */
        false, name,
        /* channelsCount= */
        null,
        /* closedCaptions= */
        null, characteristics,
        /* forced= */
        false,
        /* spatialAudio= */
        false);

    // TODO: This check is necessary because of the possibility of multiple
    // calls to createStreamInfoFromImageTag_ before either has resolved.
    if (this.uriToStreamInfosMap_.has(verbatimImagePlaylistUri)) {
      return this.uriToStreamInfosMap_.get(verbatimImagePlaylistUri);
    }

    // Parse misc attributes.
    const resolution = tag.getAttributeValue('RESOLUTION');
    if (resolution) {
      // The RESOLUTION tag represents the resolution of a single thumbnail, not
      // of the entire sheet at once (like we expect in the output).
      // So multiply by the layout size.
      const reference = streamInfo.stream.segmentIndex.get(0);
      const layout = reference.getTilesLayout();
      if (layout) {
        streamInfo.stream.width =
            Number(resolution.split('x')[0]) * Number(layout.split('x')[0]);
        streamInfo.stream.height =
            Number(resolution.split('x')[1]) * Number(layout.split('x')[1]);
      }
    }

    // TODO: What happens if there are multiple grids, with different
    // layout sizes, inside this image stream?
    const bandwidth = tag.getAttributeValue('BANDWIDTH');
    if (bandwidth) {
      streamInfo.stream.bandwidth = Number(bandwidth);
    }
    this.uriToStreamInfosMap_.set(verbatimImagePlaylistUri, streamInfo);
    return streamInfo;
  }

  /**
   * Parse an EXT-X-STREAM-INF media tag into a Stream object.
   *
   */
  private async createStreamInfoFromVariantTag_(
      tag: Tag, allCodecs: string[], type: string): Promise<StreamInfo> {
    asserts.assert(
        tag.name == 'EXT-X-STREAM-INF',
        'Should only be called on variant tags!');
    const verbatimMediaPlaylistUri = this.variableSubstitution_(
        tag.getRequiredAttrValue('URI'), this.globalVariables_);
    if (this.uriToStreamInfosMap_.has(verbatimMediaPlaylistUri)) {
      return this.uriToStreamInfosMap_.get(verbatimMediaPlaylistUri);
    }
    const closedCaptions = this.getClosedCaptions_(tag, type);
    const codecs = ManifestParserUtils.guessCodecs(type, allCodecs);
    const streamInfo = await this.createStreamInfo_(
        verbatimMediaPlaylistUri, codecs, type,
        /* language= */
        'und',
        /* primary= */
        false,
        /* name= */
        null,
        /* channelcount= */
        null, closedCaptions,
        /* characteristics= */
        null, false,
        /* forced= */
        false);

    /* spatialAudio= */
    // TODO: This check is necessary because of the possibility of multiple
    // calls to createStreamInfoFromVariantTag_ before either has resolved.
    if (this.uriToStreamInfosMap_.has(verbatimMediaPlaylistUri)) {
      return this.uriToStreamInfosMap_.get(verbatimMediaPlaylistUri);
    }
    this.uriToStreamInfosMap_.set(verbatimMediaPlaylistUri, streamInfo);
    return streamInfo;
  }

  private async createStreamInfo_(
      verbatimMediaPlaylistUri: string, codecs: string, type: string,
      language: string, primary: boolean, name: string|null,
      channelsCount: number|null, closedCaptions: Map<string, string>,
      characteristics: string|null, forced: boolean,
      spatialAudio: boolean): Promise<StreamInfo> {
    // TODO: Refactor, too many parameters
    let absoluteMediaPlaylistUri = Utils.constructAbsoluteUri(
        this.masterPlaylistUri_, verbatimMediaPlaylistUri);
    const response = await this.requestManifest_(absoluteMediaPlaylistUri);

    // Record the final URI after redirects.
    absoluteMediaPlaylistUri = response.uri;

    // Record the redirected, final URI of this media playlist when we parse it.
    const playlist: Playlist = this.manifestTextParser_.parsePlaylist(
        response.data, absoluteMediaPlaylistUri);
    return this.convertParsedPlaylistIntoStreamInfo_(
        playlist, verbatimMediaPlaylistUri, absoluteMediaPlaylistUri, codecs,
        type, language, primary, name, channelsCount, closedCaptions,
        characteristics, forced, spatialAudio);
  }

  private async convertParsedPlaylistIntoStreamInfo_(
      playlist: Playlist, verbatimMediaPlaylistUri: string,
      absoluteMediaPlaylistUri: string, codecs: string, type: string,
      language: string, primary: boolean, name: string|null,
      channelsCount: number|null, closedCaptions: Map<string, string>,
      characteristics: string|null, forced: boolean, spatialAudio: boolean,
      mimeType: string|undefined = undefined): Promise<StreamInfo> {
    if (playlist.type != PlaylistType.MEDIA) {
      // EXT-X-MEDIA and EXT-X-IMAGE-STREAM-INF tags should point to media
      // playlists.
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.HLS_INVALID_PLAYLIST_HIERARCHY);
    }
    const variablesTags: Tag[] =
        Utils.filterTagsByName(playlist.tags, 'EXT-X-DEFINE');
    const mediaVariables = this.parseMediaVariables_(variablesTags);
    asserts.assert(
        playlist.segments != null, 'Media playlist should have segments!');
    this.determinePresentationType_(playlist);
    if (!mimeType) {
      mimeType =
          await this.guessMimeType_(type, codecs, playlist, mediaVariables);
    }
    const drmTags: Tag[] = [];
    if (playlist.segments) {
      for (const segment of playlist.segments) {
        const segmentKeyTags =
            Utils.filterTagsByName(segment.tags, 'EXT-X-KEY');
        drmTags.push(...segmentKeyTags);
      }
    }
    let encrypted = false;
    let aesEncrypted = false;
    const drmInfos: shaka.extern.DrmInfo[] = [];
    const keyIds = new Set();

    // TODO: May still need changes to support key rotation.
    for (const drmTag of drmTags) {
      const method = drmTag.getRequiredAttrValue('METHOD');
      if (method != 'NONE') {
        encrypted = true;
        if (method == 'AES-128') {
          // These keys are handled separately.
          aesEncrypted = true;
        } else {
          // According to the HLS spec, KEYFORMAT is optional and implicitly
          // defaults to "identity".
          // https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis-11#section-4.4.4.4
          const keyFormat = drmTag.getAttributeValue('KEYFORMAT') || 'identity';
          const drmParser = KEYFORMATS_TO_DRM_PARSERS_[keyFormat];
          const drmInfo = drmParser ? drmParser(drmTag, mimeType) : null;
          if (drmInfo) {
            if (drmInfo.keyIds) {
              for (const keyId of drmInfo.keyIds) {
                keyIds.add(keyId);
              }
            }
            drmInfos.push(drmInfo);
          } else {
            log.warning('Unsupported HLS KEYFORMAT', keyFormat);
          }
        }
      }
    }
    if (encrypted && !drmInfos.length && !aesEncrypted) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.HLS_KEYFORMATS_NOT_SUPPORTED);
    }

    // MediaSource expects no codec strings combined with raw formats.
    if (MediaSourceEngineExports.RAW_FORMATS.includes(mimeType)) {
      codecs = '';
    }
    const mediaSequenceToStartTime: Map<number, number> = new Map();
    const segments = this.createSegments_(
        verbatimMediaPlaylistUri, playlist, type, mimeType,
        mediaSequenceToStartTime, mediaVariables, codecs);
    const lastEndTime = segments[segments.length - 1].endTime;
    const segmentIndex: SegmentIndex = new SegmentIndex(segments);
    const kind = type == ManifestParserUtilsExports.ContentType.TEXT ?
        ManifestParserUtilsExports.TextStreamKind.SUBTITLE :
        undefined;
    const roles = [];
    if (characteristics) {
      for (const characteristic of characteristics.split(',')) {
        roles.push(characteristic);
      }
    }
    const serverControlTag =
        Utils.getFirstTagWithName(playlist.tags, 'EXT-X-SERVER-CONTROL');
    const canSkipSegments = serverControlTag ?
        serverControlTag.getAttribute('CAN-SKIP-UNTIL') != null :
        false;
    const stream: shaka.extern.Stream = {
      id: this.globalId_++,
      originalId: name,
      createSegmentIndex: () => Promise.resolve(),
      segmentIndex,
      mimeType,
      codecs,
      kind,
      encrypted,
      drmInfos,
      keyIds,
      language,
      label: name,
      // For historical reasons, since before "originalId".
      type,
      primary,
      // TODO: trick mode
      trickModeVideo: null,
      emsgSchemeIdUris: null,
      frameRate: undefined,
      pixelAspectRatio: undefined,
      width: undefined,
      height: undefined,
      bandwidth: undefined,
      roles: roles,
      forced: forced,
      channelsCount,
      audioSamplingRate: null,
      spatialAudio: spatialAudio,
      closedCaptions,
      hdr: undefined,
      tilesLayout: undefined
    };
    return {
      stream,
      verbatimMediaPlaylistUri,
      absoluteMediaPlaylistUri,
      maxTimestamp: lastEndTime,
      mediaSequenceToStartTime,
      canSkipSegments
    };
  }

  private parseAES128DrmTag_(
      drmTag: Tag, playlist: Playlist): shaka.extern.HlsAes128Key {
    // Check if the Web Crypto API is available.
    if (!window.crypto || !window.crypto.subtle) {
      log.alwaysWarn(
          'Web Crypto API is not available to decrypt ' +
          'AES-128. (Web Crypto only exists in secure origins like https)');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.NO_WEB_CRYPTO_API);
    }

    // HLS RFC 8216 Section 5.2:
    // An EXT-X-KEY tag with a KEYFORMAT of "identity" that does not have an IV
    // attribute indicates that the Media Sequence Number is to be used as the
    // IV when decrypting a Media Segment, by putting its big-endian binary
    // representation into a 16-octet (128-bit) buffer and padding (on the left)
    // with zeros.
    let firstMediaSequenceNumber = 0;
    let iv;
    const ivHex = drmTag.getAttributeValue('IV', '');
    if (!ivHex) {
      // Media Sequence Number will be used as IV.
      firstMediaSequenceNumber = Utils.getFirstTagWithNameAsNumber(
          playlist.tags, 'EXT-X-MEDIA-SEQUENCE', 0);
    } else {
      // Exclude 0x at the start of string.
      iv = Uint8ArrayUtils.fromHex(ivHex.substr(2));
      if (iv.byteLength != 16) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
            ErrorExports.Code.HLS_AES_128_INVALID_IV_LENGTH);
      }
    }
    const keyUri = Utils.constructAbsoluteUri(
        playlist.absoluteUri, drmTag.getRequiredAttrValue('URI'));
    const requestType = NetworkingEngineExports.RequestType.KEY;
    const request =
        NetworkingEngine.makeRequest([keyUri], this.config_.retryParameters);
    const keyInfo = {method: 'AES-128', iv, firstMediaSequenceNumber};

    // Don't download the key object until the segment is parsed, to avoid a
    // startup delay for long manifests with lots of keys.
    keyInfo.fetchKey = async () => {
      const keyResponse = await this.makeNetworkRequest_(request, requestType);

      // keyResponse.status is undefined when URI is "data:text/plain;base64,"
      if (!keyResponse.data || keyResponse.data.byteLength != 16) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
            ErrorExports.Code.HLS_AES_128_INVALID_KEY_LENGTH);
      }
      keyInfo.cryptoKey = await window.crypto.subtle.importKey(
          'raw', keyResponse.data, 'AES-CBC', true, ['decrypt']);
      keyInfo.fetchKey = undefined;
    };

    // No longer needed.
    return keyInfo;
  }

  private determinePresentationType_(playlist: Playlist) {
    const PresentationType = PresentationType_;
    const presentationTypeTag =
        Utils.getFirstTagWithName(playlist.tags, 'EXT-X-PLAYLIST-TYPE');
    const endListTag =
        Utils.getFirstTagWithName(playlist.tags, 'EXT-X-ENDLIST');
    const isVod =
        presentationTypeTag && presentationTypeTag.value == 'VOD' || endListTag;
    const isEvent =
        presentationTypeTag && presentationTypeTag.value == 'EVENT' && !isVod;
    const isLive = !isVod && !isEvent;
    if (isVod) {
      this.setPresentationType_(PresentationType.VOD);
    } else {
      // If it's not VOD, it must be presentation type LIVE or an ongoing EVENT.
      if (isLive) {
        this.setPresentationType_(PresentationType.LIVE);
      } else {
        this.setPresentationType_(PresentationType.EVENT);
      }
      const targetDurationTag =
          this.getRequiredTag_(playlist.tags, 'EXT-X-TARGETDURATION');
      const targetDuration = Number(targetDurationTag.value);
      const partialTargetDurationTag =
          Utils.getFirstTagWithName(playlist.tags, 'EXT-X-PART-INF');

      // According to the HLS spec, updates should not happen more often than
      // once in targetDuration.  It also requires us to only update the active
      // variant.  We might implement that later, but for now every variant
      // will be updated.  To get the update period, choose the smallest
      // targetDuration value across all playlists.
      // 1. Update the shortest one to use as update period and segment
      // availability time (for LIVE).
      if (this.lowLatencyMode_ && partialTargetDurationTag) {
        // For low latency streaming, use the partial segment target duration.
        this.partialTargetDuration_ = Number(
            partialTargetDurationTag.getRequiredAttrValue('PART-TARGET'));
        this.minTargetDuration_ =
            Math.min(this.partialTargetDuration_, this.minTargetDuration_);

        // Get the server-recommended min distance from the live edge.
        const serverControlTag =
            Utils.getFirstTagWithName(playlist.tags, 'EXT-X-SERVER-CONTROL');

        // Use 'PART-HOLD-BACK' as the presentation delay for low latency mode.
        this.lowLatencyPresentationDelay_ = serverControlTag ?
            Number(serverControlTag.getRequiredAttrValue('PART-HOLD-BACK')) :
            0;
      } else {
        // For regular HLS, use the target duration of regular segments.
        this.minTargetDuration_ =
            Math.min(targetDuration, this.minTargetDuration_);
      }

      // 2. Update the longest target duration if need be to use as a
      // presentation delay later.
      this.maxTargetDuration_ =
          Math.max(targetDuration, this.maxTargetDuration_);
    }
  }

  private createPresentationTimeline_() {
    if (this.isLive_()) {
      // The live edge will be calculated from segments, so we don't need to
      // set a presentation start time.  We will assert later that this is
      // working as expected.

      // The HLS spec (RFC 8216) states in 6.3.3:
      // "The client SHALL choose which Media Segment to play first ... the
      // client SHOULD NOT choose a segment that starts less than three target
      // durations from the end of the Playlist file.  Doing so can trigger
      // playback stalls."
      // We accomplish this in our DASH-y model by setting a presentation
      // delay of configured value, or 3 segments duration if not configured.
      // This will be the "live edge" of the presentation.
      let presentationDelay;
      if (this.config_.defaultPresentationDelay) {
        presentationDelay = this.config_.defaultPresentationDelay;
      } else {
        if (this.lowLatencyPresentationDelay_) {
          presentationDelay = this.lowLatencyPresentationDelay_;
        } else {
          presentationDelay = this.maxTargetDuration_ * 3;
        }
      }
      this.presentationTimeline_ = new PresentationTimeline(
          /* presentationStartTime= */
          0,
          /* delay= */
          presentationDelay);
      this.presentationTimeline_.setStatic(false);
    } else {
      this.presentationTimeline_ = new PresentationTimeline(
          /* presentationStartTime= */
          null,
          /* delay= */
          0);
      this.presentationTimeline_.setStatic(true);
    }
  }

  /**
   * Get the InitSegmentReference for a segment if it has a EXT-X-MAP tag.
   * @param playlistUri The absolute uri of the media playlist.
   * @param tags Segment tags
   */
  private getInitSegmentReference_(
      playlistUri: string, tags: Tag[],
      variables: Map<string, string>): InitSegmentReference {
    const mapTag: Tag|null = Utils.getFirstTagWithName(tags, 'EXT-X-MAP');
    if (!mapTag) {
      return null;
    }

    // Map tag example: #EXT-X-MAP:URI="main.mp4",BYTERANGE="720@0"
    const verbatimInitSegmentUri = mapTag.getRequiredAttrValue('URI');
    const absoluteInitSegmentUri = this.variableSubstitution_(
        Utils.constructAbsoluteUri(playlistUri, verbatimInitSegmentUri),
        variables);
    const mapTagKey = [
      absoluteInitSegmentUri, mapTag.getAttributeValue('BYTERANGE', '')
    ].join('-');
    if (!this.mapTagToInitSegmentRefMap_.has(mapTagKey)) {
      const initSegmentRef =
          this.createInitSegmentReference_(absoluteInitSegmentUri, mapTag);
      this.mapTagToInitSegmentRefMap_.set(mapTagKey, initSegmentRef);
    }
    return this.mapTagToInitSegmentRefMap_.get(mapTagKey);
  }

  /**
   * Create an InitSegmentReference object for the EXT-X-MAP tag in the media
   * playlist.
   * @param mapTag EXT-X-MAP
   */
  private createInitSegmentReference_(
      absoluteInitSegmentUri: string, mapTag: Tag): InitSegmentReference {
    let startByte = 0;
    let endByte = null;
    const byterange = mapTag.getAttributeValue('BYTERANGE');

    // If a BYTERANGE attribute is not specified, the segment consists
    // of the entire resource.
    if (byterange) {
      const blocks = byterange.split('@');
      const byteLength = Number(blocks[0]);
      startByte = Number(blocks[1]);
      endByte = startByte + byteLength - 1;
    }
    const initSegmentRef = new InitSegmentReference(
        () => [absoluteInitSegmentUri], startByte, endByte);
    return initSegmentRef;
  }

  /**
   * Parses one shaka.hls.Segment object into a shaka.media.SegmentReference.
   *
   */
  private createSegmentReference_(
      initSegmentReference: InitSegmentReference,
      previousReference: SegmentReference, hlsSegment: Segment,
      startTime: number, variables: Map<string, string>,
      absoluteMediaPlaylistUri: string, type: string,
      hlsAes128Key?: shaka.extern.HlsAes128Key): SegmentReference {
    const tags = hlsSegment.tags;
    const absoluteSegmentUri =
        this.variableSubstitution_(hlsSegment.absoluteUri, variables);
    const extinfTag = Utils.getFirstTagWithName(tags, 'EXTINF');
    let endTime = 0;
    let startByte = 0;
    let endByte = null;
    if (hlsSegment.partialSegments.length && !this.lowLatencyMode_) {
      log.alwaysWarn(
          'Low-latency HLS live stream detected, but ' +
          'low-latency streaming mode is not enabled in Shaka ' +
          'Player. Set streaming.lowLatencyMode configuration to ' +
          'true, and see https://bit.ly/3clctcj for details.');
    }
    let syncTime = null;
    if (!this.config_.hls.ignoreManifestProgramDateTime) {
      const dateTimeTag =
          Utils.getFirstTagWithName(tags, 'EXT-X-PROGRAM-DATE-TIME');
      if (dateTimeTag && dateTimeTag.value) {
        syncTime = XmlUtils.parseDate(dateTimeTag.value);
        asserts.assert(
            syncTime != null, 'EXT-X-PROGRAM-DATE-TIME format not valid');
      }
    }
    let status = SegmentReferenceExports.Status.AVAILABLE;
    if (Utils.getFirstTagWithName(tags, 'EXT-X-GAP')) {
      status = SegmentReferenceExports.Status.MISSING;
    }
    if (!extinfTag) {
      if (hlsSegment.partialSegments.length == 0) {
        // EXTINF tag must be available if the segment has no partial segments.
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
            ErrorExports.Code.HLS_REQUIRED_TAG_MISSING, 'EXTINF');
      } else {
        if (!this.lowLatencyMode_) {
          // Without EXTINF and without low-latency mode, partial segments get
          // ignored.
          return null;
        }
      }
    }

    // Create SegmentReferences for the partial segments.
    const partialSegmentRefs = [];
    if (this.lowLatencyMode_) {
      for (let i = 0; i < hlsSegment.partialSegments.length; i++) {
        const item = hlsSegment.partialSegments[i];
        const pPreviousReference = i == 0 ?
            previousReference :
            partialSegmentRefs[partialSegmentRefs.length - 1];
        const pStartTime = i == 0 ? startTime : pPreviousReference.endTime;

        // If DURATION is missing from this partial segment, use the target
        // partial duration from the top of the playlist, which is a required
        // attribute for content with partial segments.
        const pDuration = Number(item.getAttributeValue('DURATION')) ||
            this.partialTargetDuration_;

        // If for some reason we have neither an explicit duration, nor a target
        // partial duration, we should SKIP this partial segment to avoid
        // duplicating content in the presentation timeline.
        if (!pDuration) {
          continue;
        }
        const pEndTime = pStartTime + pDuration;
        let pStartByte = 0;
        let pEndByte = null;
        if (item.name == 'EXT-X-PRELOAD-HINT') {
          // A preload hinted partial segment may have byterange start info.
          const pByterangeStart = item.getAttributeValue('BYTERANGE-START');
          pStartByte = pByterangeStart ? Number(pByterangeStart) : 0;
        } else {
          const pByterange = item.getAttributeValue('BYTERANGE');
          [pStartByte, pEndByte] =
              this.parseByteRange_(pPreviousReference, pByterange);
        }
        const pUri = item.getAttributeValue('URI');
        if (!pUri) {
          continue;
        }
        const pAbsoluteUri =
            Utils.constructAbsoluteUri(absoluteMediaPlaylistUri, pUri);
        let partialStatus = SegmentReferenceExports.Status.AVAILABLE;
        if (item.getAttributeValue('GAP') == 'YES') {
          partialStatus = SegmentReferenceExports.Status.MISSING;
        }

        // We do not set the AES-128 key information for partial segments, as we
        // do not support AES-128 and low-latency at the same time.
        const partial = new SegmentReference(
            pStartTime, pEndTime, () => [pAbsoluteUri], pStartByte, pEndByte,
            initSegmentReference,
            /* timestampOffset= */
            0,
            // This value is ignored in sequence mode.
            0,
            /* appendWindowStart= */
            Infinity,
            /* appendWindowEnd= */
            [],
            /* partialReferences= */
            '',
            /* tilesLayout= */
            null,
            /* tileDuration= */
            null,
            /* syncTime= */
            partialStatus);
        partialSegmentRefs.push(partial);
      }
    }

    // for-loop of hlsSegment.partialSegments

    // If the segment has EXTINF tag, set the segment's end time, start byte
    // and end byte based on the duration and byterange information.
    // Otherwise, calculate the end time, start / end byte based on its partial
    // segments.
    // Note that the sum of partial segments durations may be slightly different
    // from the parent segment's duration. In this case, use the duration from
    // the parent segment tag.
    if (extinfTag) {
      // The EXTINF tag format is '#EXTINF:<duration>,[<title>]'.
      // We're interested in the duration part.
      const extinfValues = extinfTag.value.split(',');
      const duration = Number(extinfValues[0]);
      endTime = startTime + duration;
    } else {
      endTime = partialSegmentRefs[partialSegmentRefs.length - 1].endTime;
    }

    // If the segment has EXT-X-BYTERANGE tag, set the start byte and end byte
    // base on the byterange information. If segment has no EXT-X-BYTERANGE tag
    // and has partial segments, set the start byte and end byte base on the
    // partial segments.
    const byterangeTag = Utils.getFirstTagWithName(tags, 'EXT-X-BYTERANGE');
    if (byterangeTag) {
      [startByte, endByte] =
          this.parseByteRange_(previousReference, byterangeTag.value);
    } else {
      if (partialSegmentRefs.length) {
        startByte = partialSegmentRefs[0].startByte;
        endByte = partialSegmentRefs[partialSegmentRefs.length - 1].endByte;
      }
    }
    let tilesLayout = '';
    let tileDuration = null;
    if (type == ManifestParserUtilsExports.ContentType.IMAGE) {
      // By default in HLS the tilesLayout is 1x1
      tilesLayout = '1x1';
      const tilesTag = Utils.getFirstTagWithName(tags, 'EXT-X-TILES');
      if (tilesTag) {
        tilesLayout = tilesTag.getRequiredAttrValue('LAYOUT');
        const duration = tilesTag.getAttributeValue('DURATION');
        if (duration) {
          tileDuration = Number(duration);
        }
      }
    }
    return new SegmentReference(
        startTime, endTime,
        () => absoluteSegmentUri.length ? [absoluteSegmentUri] : [], startByte,
        endByte, initSegmentReference,
        /* timestampOffset= */
        0,
        // This value is ignored in sequence mode.
        0,
        /* appendWindowStart= */
        Infinity,
        /* appendWindowEnd= */
        partialSegmentRefs, tilesLayout, tileDuration, syncTime, status,
        hlsAes128Key);
  }

  /**
   * Parse the startByte and endByte.
   * @return An array with the start byte and end byte.
   */
  private parseByteRange_(
      previousReference: SegmentReference, byterange: string|null): number[] {
    let startByte = 0;
    let endByte = null;

    // If BYTERANGE is not specified, the segment consists of the entire
    // resource.
    if (byterange) {
      const blocks = byterange.split('@');
      const byteLength = Number(blocks[0]);
      if (blocks[1]) {
        startByte = Number(blocks[1]);
      } else {
        asserts.assert(
            previousReference, 'Cannot refer back to previous HLS segment!');
        startByte = previousReference.endByte + 1;
      }
      endByte = startByte + byteLength - 1;
    }
    return [startByte, endByte];
  }

  private notifySegments_() {
    // The presentation timeline may or may not be set yet.
    // If it does not yet exist, hold onto the segments until it does.
    if (!this.presentationTimeline_) {
      return;
    }
    for (const segments of this.segmentsToNotifyByStream_) {
      this.presentationTimeline_.notifySegments(segments);
    }
    this.segmentsToNotifyByStream_ = [];
  }

  /**
   * Parses shaka.hls.Segment objects into shaka.media.SegmentReferences.
   *
   */
  private createSegments_(
      verbatimMediaPlaylistUri: string, playlist: Playlist, type: string,
      mimeType: string, mediaSequenceToStartTime: Map<number, number>,
      variables: Map<string, string>, codecs: string): SegmentReference[] {
    const hlsSegments: Segment[] = playlist.segments;
    asserts.assert(hlsSegments.length, 'Playlist should have segments!');
    let initSegmentRef: InitSegmentReference;
    let hlsAes128Key: shaka.extern.HlsAes128Key|undefined = undefined;

    // We may need to look at the media itself to determine a segment start
    // time.
    const mediaSequenceNumber = Utils.getFirstTagWithNameAsNumber(
        playlist.tags, 'EXT-X-MEDIA-SEQUENCE', 0);
    const skipTag = Utils.getFirstTagWithName(playlist.tags, 'EXT-X-SKIP');
    const skippedSegments =
        skipTag ? Number(skipTag.getAttributeValue('SKIPPED-SEGMENTS')) : 0;
    let position = mediaSequenceNumber + skippedSegments;
    let firstStartTime = 0;

    // For live stream, use the cached value in the mediaSequenceToStartTime
    // map if available.
    if (this.isLive_() && mediaSequenceToStartTime.has(position)) {
      firstStartTime = mediaSequenceToStartTime.get(position);
    }
    const references: SegmentReference[] = [];
    let previousReference = null;
    for (let i = 0; i < hlsSegments.length; i++) {
      const item = hlsSegments[i];
      const startTime = i == 0 ? firstStartTime : previousReference.endTime;
      position = mediaSequenceNumber + skippedSegments + i;

      // Apply new AES-128 tags as you see them, keeping a running total.
      for (const drmTag of item.tags) {
        if (drmTag.name == 'EXT-X-KEY' &&
            drmTag.getRequiredAttrValue('METHOD') == 'AES-128') {
          hlsAes128Key = this.parseAES128DrmTag_(drmTag, playlist);
        }
      }
      mediaSequenceToStartTime.set(position, startTime);
      initSegmentRef = this.getInitSegmentReference_(
          playlist.absoluteUri, item.tags, variables);

      // If the stream is low latency and the user has not configured the
      // lowLatencyMode, but if it has been configured to activate the
      // lowLatencyMode if a stream of this type is detected, we automatically
      // activate the lowLatencyMode.
      if (!this.lowLatencyMode_) {
        const autoLowLatencyMode = this.playerInterface_.isAutoLowLatencyMode();
        if (autoLowLatencyMode) {
          this.playerInterface_.enableLowLatencyMode();
          this.lowLatencyMode_ = this.playerInterface_.isLowLatencyMode();
        }
      }
      const reference = this.createSegmentReference_(
          initSegmentRef, previousReference, item, startTime, variables,
          playlist.absoluteUri, type, hlsAes128Key);
      previousReference = reference;
      if (reference) {
        // This segment is ignored as part of our fallback synchronization
        // method.
        if (this.config_.hls.ignoreManifestProgramDateTime &&
            this.minSequenceNumber_ != null &&
            position < this.minSequenceNumber_) {
        } else {
          references.push(reference);
        }
      }
    }

    // If some segments have sync times, but not all, extrapolate the sync
    // times of the ones with none.
    const someSyncTime = references.some((ref) => ref.syncTime != null);
    if (someSyncTime) {
      for (let i = 0; i < references.length; i++) {
        const reference = references[i];
        if (reference.syncTime != null) {
          // No need to extrapolate.
          continue;
        }

        // Find the nearest segment with syncTime, in either direction.
        // This looks forward and backward simultaneously, keeping track of what
        // to offset the syncTime it finds by as it goes.
        let forwardAdd = 0;
        let forwardI = i;

        /**
         * Look forwards one reference at a time, summing all durations as we
         * go, until we find a reference with a syncTime to use as a basis.
         * This DOES count the original reference, but DOESN'T count the first
         * reference with a syncTime (as we approach it from behind).
         */
        const lookForward = (): number|null => {
          const other = references[forwardI];
          if (other) {
            if (other.syncTime != null) {
              return other.syncTime + forwardAdd;
            }
            forwardAdd -= other.endTime - other.startTime;
            forwardI += 1;
          }
          return null;
        };
        let backwardAdd = 0;
        let backwardI = i;

        /**
         * Look backwards one reference at a time, summing all durations as we
         * go, until we find a reference with a syncTime to use as a basis.
         * This DOESN'T count the original reference, but DOES count the first
         * reference with a syncTime (as we approach it from ahead).
         */
        const lookBackward = (): number|null => {
          const other = references[backwardI];
          if (other) {
            if (other != reference) {
              backwardAdd += other.endTime - other.startTime;
            }
            if (other.syncTime != null) {
              return other.syncTime + backwardAdd;
            }
            backwardI -= 1;
          }
          return null;
        };
        while (reference.syncTime == null) {
          reference.syncTime = lookBackward();
          if (reference.syncTime == null) {
            reference.syncTime = lookForward();
          }
        }
      }
    }

    // Split the sync times properly among partial segments.
    if (someSyncTime) {
      for (const reference of references) {
        let syncTime = reference.syncTime;
        for (const partial of reference.partialReferences) {
          partial.syncTime = syncTime;
          syncTime += partial.endTime - partial.startTime;
        }
      }
    }
    return references;
  }

  /**
   * Replaces the variables of a given URI.
   *
   */
  private variableSubstitution_(
      uri: string, variables: Map<string, string>): string {
    let newUri = String(uri).replace(/%7B/g, '{').replace(/%7D/g, '}');
    const uriVariables = newUri.match(/{\$\w*}/g);
    if (uriVariables) {
      for (const variable of uriVariables) {
        // Note: All variables have the structure {$...}
        const variableName = variable.slice(2, variable.length - 1);
        const replaceValue = variables.get(variableName);
        if (replaceValue) {
          newUri = newUri.replace(variable, replaceValue);
        } else {
          log.error(
              'A variable has been found that is not declared', variableName);
          throw new Error(
              ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
              ErrorExports.Code.HLS_VARIABLE_NOT_FOUND, variableName);
        }
      }
    }
    return newUri;
  }

  /**
   * Attempts to guess stream's mime type based on content type and URI.
   *
   */
  private async guessMimeType_(
      contentType: string, codecs: string, playlist: Playlist,
      variables: Map<string, string>): Promise<string> {
    const HlsParser = HlsParser;
    const ContentType = ManifestParserUtilsExports.ContentType;
    const requestType = NetworkingEngineExports.RequestType.SEGMENT;

    // If you wait long enough, requesting the first segment can fail
    // because it has fallen off the left edge of DVR, so to be safer,
    // let's request the middle segment.
    asserts.assert(playlist.segments.length, 'Playlist should have segments!');
    const middleSegmentIdx = Math.trunc((playlist.segments.length - 1) / 2);
    const middleSegmentUri = this.variableSubstitution_(
        playlist.segments[middleSegmentIdx].absoluteUri, variables);
    const parsedUri = new goog.Uri(middleSegmentUri);
    const extension = parsedUri.getPath().split('.').pop();
    const map = HlsParser.EXTENSION_MAP_BY_CONTENT_TYPE_[contentType];
    const mimeType = map[extension];
    if (mimeType) {
      return mimeType;
    }
    if (contentType == ContentType.TEXT) {
      // The extension map didn't work.
      if (codecs == 'vtt' || codecs == 'wvtt') {
        // If codecs is 'vtt', it's WebVTT.
        return 'text/vtt';
      } else {
        if (codecs && codecs !== '') {
          // Otherwise, assume MP4-embedded text, since text-based formats tend
          // not to have a codecs string at all.
          return 'application/mp4';
        }
      }
    }
    if (contentType == ContentType.IMAGE) {
      if (!codecs || codecs == 'jpeg') {
        return 'image/jpeg';
      }
    }

    // If unable to guess mime type, request a segment and try getting it
    // from the response.
    const headRequest = NetworkingEngine.makeRequest(
        [middleSegmentUri], this.config_.retryParameters);
    headRequest.method = 'HEAD';
    const response = await this.makeNetworkRequest_(headRequest, requestType);
    const contentMimeType = response.headers['content-type'];
    if (!contentMimeType) {
      if (contentType == ContentType.TEXT) {
        // If there was no codecs string and no content-type, assume HLS text
        // streams are WebVTT.
        return 'text/vtt';
      }

      // If the HLS content is lacking in both MIME type metadata and
      // segment file extensions, we fall back to assuming it's MP4.
      const fallbackMimeType = map['mp4'];
      return fallbackMimeType;
    }

    // Split the MIME type in case the server sent additional parameters.
    return contentMimeType.split(';')[0];
  }

  /**
   * Returns a tag with a given name.
   * Throws an error if tag was not found.
   *
   */
  private getRequiredTag_(tags: Tag[], tagName: string): Tag {
    const tag = Utils.getFirstTagWithName(tags, tagName);
    if (!tag) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.HLS_REQUIRED_TAG_MISSING, tagName);
    }
    return tag;
  }

  private addVideoAttributes_(
      stream: shaka.extern.Stream, width: string|null, height: string|null,
      frameRate: string|null, videoRange: string|null) {
    if (stream) {
      stream.width = Number(width) || undefined;
      stream.height = Number(height) || undefined;
      stream.frameRate = Number(frameRate) || undefined;
      stream.hdr = videoRange || undefined;
    }
  }

  /**
   * Makes a network request for the manifest and returns a Promise
   * with the resulting data.
   *
   */
  private requestManifest_(absoluteUri: string):
      Promise<shaka.extern.Response> {
    const requestType = NetworkingEngineExports.RequestType.MANIFEST;
    const request = NetworkingEngine.makeRequest(
        [absoluteUri], this.config_.retryParameters);
    const format = CmcdManagerExports.StreamingFormat.HLS;
    this.playerInterface_.modifyManifestRequest(request, {format: format});
    return this.makeNetworkRequest_(request, requestType);
  }

  /**
   * Called when the update timer ticks. Because parsing a manifest is async,
   * this method is async. To work with this, this method will schedule the next
   * update when it finished instead of using a repeating-start.
   *
   */
  private async onUpdate_(): Promise {
    log.info('Updating manifest...');
    asserts.assert(
        this.updatePlaylistDelay_ > 0,
        'We should only call |onUpdate_| when we are suppose to be updating.');

    // Detect a call to stop()
    if (!this.playerInterface_) {
      return;
    }
    try {
      await this.update();
      const delay = this.updatePlaylistDelay_;
      this.updatePlaylistTimer_.tickAfter(
          /* seconds= */
          delay);
    } catch (error) {
      // Detect a call to stop() during this.update()
      if (!this.playerInterface_) {
        return;
      }
      asserts.assert(
          error instanceof Error, 'Should only receive a Shaka error');

      // We will retry updating, so override the severity of the error.
      error.severity = ErrorExports.Severity.RECOVERABLE;
      this.playerInterface_.onError(error);

      // Try again very soon.
      this.updatePlaylistTimer_.tickAfter(
          /* seconds= */
          0.1);
    }
  }

  private isLive_(): boolean {
    const PresentationType = PresentationType_;
    return this.presentationType_ != PresentationType.VOD;
  }

  private setPresentationType_(type: PresentationType_) {
    this.presentationType_ = type;
    if (this.presentationTimeline_) {
      this.presentationTimeline_.setStatic(!this.isLive_());
    }

    // If this manifest is not for live content, then we have no reason to
    // update it.
    if (!this.isLive_()) {
      this.updatePlaylistTimer_.stop();
    }
  }

  /**
   * Create a networking request. This will manage the request using the
   * parser's operation manager. If the parser has already been stopped, the
   * request will not be made.
   *
   */
  private makeNetworkRequest_(
      request: shaka.extern.Request, type: NetworkingEngineExports.RequestType):
      Promise<shaka.extern.Response> {
    if (!this.operationManager_) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
          ErrorExports.Code.OPERATION_ABORTED);
    }
    const op = this.playerInterface_.networkingEngine.request(type, request);
    this.operationManager_.manage(op);
    return op.promise;
  }

  private static fairplayDrmParser_(
      drmTag: Tag, mimeType: string): shaka.extern.DrmInfo|null {
    if (mimeType == 'video/mp2t') {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.HLS_MSE_ENCRYPTED_MP2T_NOT_SUPPORTED);
    }
    if (Platform.isMediaKeysPolyfilled()) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code
              .HLS_MSE_ENCRYPTED_LEGACY_APPLE_MEDIA_KEYS_NOT_SUPPORTED);
    }

    /*
     * Even if we're not able to construct initData through the HLS tag, adding
     * a DRMInfo will allow DRM Engine to request a media key system access
     * with the correct keySystem and initDataType
     */
    const drmInfo = ManifestParserUtils.createDrmInfo(
        'com.apple.fps',
        [{initDataType: 'sinf', initData: new Uint8Array(0), keyId: null}]);
    return drmInfo;
  }

  private static widevineDrmParser_(drmTag: Tag): shaka.extern.DrmInfo|null {
    const method = drmTag.getRequiredAttrValue('METHOD');
    const VALID_METHODS = ['SAMPLE-AES', 'SAMPLE-AES-CTR'];
    if (!VALID_METHODS.includes(method)) {
      log.error(
          'Widevine in HLS is only supported with [', VALID_METHODS.join(', '),
          '], not', method);
      return null;
    }
    const uri = drmTag.getRequiredAttrValue('URI');
    const parsedData = DataUriPlugin.parseRaw(uri);

    // The data encoded in the URI is a PSSH box to be used as init data.
    const pssh = BufferUtils.toUint8(parsedData.data);
    const drmInfo = ManifestParserUtils.createDrmInfo(
        'com.widevine.alpha', [{initDataType: 'cenc', initData: pssh}]);
    const keyId = drmTag.getAttributeValue('KEYID');
    if (keyId) {
      const keyIdLowerCase = keyId.toLowerCase();

      // This value should begin with '0x':
      asserts.assert(
          keyIdLowerCase.startsWith('0x'), 'Incorrect KEYID format!');

      // But the output should not contain the '0x':
      drmInfo.keyIds = new Set([keyIdLowerCase.substr(2)]);
    }
    return drmInfo;
  }

  /**
   * See:
   * https://docs.microsoft.com/en-us/playready/packaging/mp4-based-formats-supported-by-playready-clients?tabs=case4
   *
   */
  private static playreadyDrmParser_(drmTag: Tag): shaka.extern.DrmInfo|null {
    const method = drmTag.getRequiredAttrValue('METHOD');
    const VALID_METHODS = ['SAMPLE-AES', 'SAMPLE-AES-CTR'];
    if (!VALID_METHODS.includes(method)) {
      log.error(
          'PlayReady in HLS is only supported with [', VALID_METHODS.join(', '),
          '], not', method);
      return null;
    }
    const uri = drmTag.getRequiredAttrValue('URI');
    const parsedData = DataUriPlugin.parseRaw(uri);

    // The data encoded in the URI is a PlayReady Pro Object, so we need
    // convert it to pssh.
    const data = BufferUtils.toUint8(parsedData.data);
    const systemId = new Uint8Array([
      154, 4, 240, 121, 152, 64, 66, 134, 171, 146, 230, 91, 224, 136, 95, 149
    ]);
    const keyIds = new Set();
    const psshVersion = 0;
    const pssh = Pssh.createPssh(data, systemId, keyIds, psshVersion);
    const drmInfo = ManifestParserUtils.createDrmInfo(
        'com.microsoft.playready', [{initDataType: 'cenc', initData: pssh}]);
    return drmInfo;
  }

  /**
   * See:
   * https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis-11#section-5.1
   *
   */
  private static identityDrmParser_(drmTag: Tag): shaka.extern.DrmInfo|null {
    const method = drmTag.getRequiredAttrValue('METHOD');
    const VALID_METHODS = ['SAMPLE-AES', 'SAMPLE-AES-CTR'];
    if (!VALID_METHODS.includes(method)) {
      log.error(
          'Identity (ClearKey) in HLS is only supported with [',
          VALID_METHODS.join(', '), '], not', method);
      return null;
    }

    // NOTE: The ClearKey CDM requires a key-id to key mapping.  HLS doesn't
    // provide a key ID anywhere.  So although we could use the 'URI' attribute
    // to fetch the actual 16-byte key, without a key ID, we can't provide this
    // automatically to the ClearKey CDM.  Instead, the application will have
    // to use player.configure('drm.clearKeys', { ... }) to provide the key IDs
    // and keys or player.configure('drm.servers.org\.w3\.clearkey', ...) to
    // provide a ClearKey license server URI.
    return ManifestParserUtils.createDrmInfo(
        'org.w3.clearkey',
        /* initDatas= */
        null);
  }
}
type StreamInfo = {
  stream: shaka.extern.Stream,
  verbatimMediaPlaylistUri: string,
  absoluteMediaPlaylistUri: string,
  maxTimestamp: number,
  mediaSequenceToStartTime: Map<number, number>,
  canSkipSegments: boolean
};

export {StreamInfo};
type StreamInfos = {
  audio: StreamInfo[],
  video: StreamInfo[]
};

export {StreamInfos};

export const AUDIO_EXTENSIONS_TO_MIME_TYPES_: {[key: string]: string} = {
  'mp4': 'audio/mp4',
  'mp4a': 'audio/mp4',
  'm4s': 'audio/mp4',
  'm4i': 'audio/mp4',
  'm4a': 'audio/mp4',
  'm4f': 'audio/mp4',
  'cmfa': 'audio/mp4',
  // MPEG2-TS also uses video/ for audio: https://bit.ly/TsMse
  'ts': 'video/mp2t',
  // Raw formats:
  'aac': 'audio/aac',
  'ac3': 'audio/ac3',
  'ec3': 'audio/ec3',
  'mp3': 'audio/mpeg'
};

export const VIDEO_EXTENSIONS_TO_MIME_TYPES_: {[key: string]: string} = {
  'mp4': 'video/mp4',
  'mp4v': 'video/mp4',
  'm4s': 'video/mp4',
  'm4i': 'video/mp4',
  'm4v': 'video/mp4',
  'm4f': 'video/mp4',
  'cmfv': 'video/mp4',
  'ts': 'video/mp2t'
};

export const TEXT_EXTENSIONS_TO_MIME_TYPES_: {[key: string]: string} = {
  'mp4': 'application/mp4',
  'm4s': 'application/mp4',
  'm4i': 'application/mp4',
  'm4f': 'application/mp4',
  'cmft': 'application/mp4',
  'vtt': 'text/vtt',
  'ttml': 'application/ttml+xml'
};

export const IMAGE_EXTENSIONS_TO_MIME_TYPES_: {[key: string]: string} = {
  'jpg': 'image/jpeg',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'avif': 'image/avif'
};

export const EXTENSION_MAP_BY_CONTENT_TYPE_:
    {[key: string]: {[key: string]: string}} = {
      'audio': AUDIO_EXTENSIONS_TO_MIME_TYPES_,
      'video': VIDEO_EXTENSIONS_TO_MIME_TYPES_,
      'text': TEXT_EXTENSIONS_TO_MIME_TYPES_,
      'image': IMAGE_EXTENSIONS_TO_MIME_TYPES_
    };
type DrmParser_ = (p1: Tag, p2: string) => shaka.extern.DrmInfo|null;

export {DrmParser_};

export const KEYFORMATS_TO_DRM_PARSERS_: {[key: string]: DrmParser_} = {
  'com.apple.streamingkeydelivery': HlsParser.fairplayDrmParser_,
  'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': HlsParser.widevineDrmParser_,
  'com.microsoft.playready': HlsParser.playreadyDrmParser_,
  'identity': HlsParser.identityDrmParser_
};

export enum PresentationType_ {
  VOD = 'VOD',
  EVENT = 'EVENT',
  LIVE = 'LIVE'
}
if (!Platform.isTizen3() && !Platform.isTizen2() && !Platform.isWebOS3()) {
  ManifestParser.registerParserByExtension('m3u8', () => new HlsParser());
  ManifestParser.registerParserByMime(
      'application/x-mpegurl', () => new HlsParser());
  ManifestParser.registerParserByMime(
      'application/vnd.apple.mpegurl', () => new HlsParser());
}
