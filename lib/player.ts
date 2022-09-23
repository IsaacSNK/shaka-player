/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {AutoShowText} from './config/auto_show_text';
import * as assertsExports from './debug/asserts';
import {asserts} from './debug/asserts';
import * as logExports from './debug/log';
import {log} from './debug/log';
import * as DeprecateExports from './deprecate/deprecate';
import {Deprecate} from './deprecate/deprecate';
import {AdaptationSetCriteria, ExampleBasedCriteria, PreferenceBasedCriteria} from './media/adaptation_set_criteria';
import * as BufferingObserverExports from './media/buffering_observer';
import {BufferingObserver} from './media/buffering_observer';
import {ClosedCaptionParser, IClosedCaptionParser} from './media/closed_caption_parser';
import * as DrmEngineExports from './media/drm_engine';
import {DrmEngine} from './media/drm_engine';
import * as ManifestParserExports from './media/manifest_parser';
import {ManifestParser} from './media/manifest_parser';
import * as MediaSourceEngineExports from './media/media_source_engine';
import {MediaSourceEngine} from './media/media_source_engine';
import * as PlayRateControllerExports from './media/play_rate_controller';
import {PlayRateController} from './media/play_rate_controller';
import {MediaSourcePlayhead, Playhead, SrcEqualsPlayhead} from './media/playhead';
import {PlayheadObserverManager} from './media/playhead_observer';
import {PresentationTimeline} from './media/presentation_timeline';
import * as QualityObserverExports from './media/quality_observer';
import {QualityObserver} from './media/quality_observer';
import * as RegionObserverExports from './media/region_observer';
import {RegionObserver} from './media/region_observer';
import * as RegionTimelineExports from './media/region_timeline';
import {RegionTimeline} from './media/region_timeline';
import {MetaSegmentIndex, SegmentIndex} from './media/segment_index';
import * as StreamingEngineExports from './media/streaming_engine';
import {StreamingEngine} from './media/streaming_engine';
import {TimeRangesUtils} from './media/time_ranges_utils';
import * as NetworkingEngineExports from './net/networking_engine';
import {NetworkingEngine} from './net/networking_engine';
import {Node} from './routing/node';
import {Payload} from './routing/payload';
import * as WalkerExports from './routing/walker';
import {Walker} from './routing/walker';
import {SimpleTextDisplayer} from './text/simple_text_displayer';
import * as TextEngineExports from './text/text_engine';
import {TextEngine} from './text/text_engine';
import {UITextDisplayer} from './text/ui_text_displayer';
import {WebVttGenerator} from './text/web_vtt_generator';
import {AbortableOperation} from './util/abortable_operation';
import {BufferUtils} from './util/buffer_utils';
import * as CmcdManagerExports from './util/cmcd_manager';
import {CmcdManager} from './util/cmcd_manager';
import {ConfigUtils} from './util/config_utils';
import * as ErrorExports from './util/error';
import {Error} from './util/error';
import * as EventManagerExports from './util/event_manager';
import {EventManager} from './util/event_manager';
import * as FakeEventExports from './util/fake_event';
import {FakeEvent} from './util/fake_event';
import * as FakeEventTargetExports from './util/fake_event_target';
import {FakeEventTarget} from './util/fake_event_target';
import {IDestroyable} from './util/i_destroyable';
import * as LanguageUtilsExports from './util/language_utils';
import {LanguageUtils} from './util/language_utils';
import * as ManifestParserUtilsExports from './util/manifest_parser_utils';
import {ManifestParserUtils} from './util/manifest_parser_utils';
import * as MediaReadyStateExports from './util/media_ready_state_utils';
import {MediaReadyState} from './util/media_ready_state_utils';
import * as MimeUtilsExports from './util/mime_utils';
import {MimeUtils} from './util/mime_utils';
import {ObjectUtils} from './util/object_utils';
import * as PlatformExports from './util/platform';
import {Platform} from './util/platform';
import {PlayerConfiguration} from './util/player_configuration';
import {PublicPromise} from './util/public_promise';
import {Stats} from './util/stats';
import * as StreamUtilsExports from './util/stream_utils';
import {StreamUtils} from './util/stream_utils';
import {Timer} from './util/timer';
import { AbrManager, Factory } from '../externs/shaka/abr_manager';
import { Manifest } from '../externs/shaka/manifest';
import { IAdManager } from '../externs/shaka/ads';
import { IPlayerConfiguration } from '../externs/shaka/player';

/**
 * @event shaka.Player.ErrorEvent
 * @description Fired when a playback error occurs.
 * @property {string} type
 *   'error'
 * @property {!ShakaError} detail
 *   An object which contains details on the error.  The error's
 *   <code>category</code> and <code>code</code> properties will identify the
 *   specific error that occurred.  In an uncompiled build, you can also use the
 *   <code>message</code> and <code>stack</code> properties to debug.
 * @exportDoc
 */

/**
 * @event shaka.Player.StateChangeEvent
 * @description Fired when the player changes load states.
 * @property {string} type
 *    'onstatechange'
 * @property {string} state
 *    The name of the state that the player just entered.
 * @exportDoc
 */

/**
 * @event shaka.Player.StateIdleEvent
 * @description Fired when the player has stopped changing states and will
 *    remain idle until a new state change request (e.g. <code>load</code>,
 *    <code>attach</code>, etc.) is made.
 * @property {string} type
 *    'onstateidle'
 * @property {string} state
 *    The name of the state that the player stopped in.
 * @exportDoc
 */

/**
 * @event shaka.Player.EmsgEvent
 * @description Fired when a non-typical emsg is found in a segment.
 * @property {string} type
 *   'emsg'
 * @property {shaka.extern.EmsgInfo} detail
 *   An object which contains the content of the emsg box.
 * @exportDoc
 */

/**
 * @event shaka.Player.DownloadFailed
 * @description Fired when a download has failed, for any reason.
 *   'downloadfailed'
 * @property {!shaka.extern.Request} request
 * @property {?ShakaError} error
 * @exportDoc
 */

/**
 * @event shaka.Player.DownloadHeadersReceived
 * @description Fired when the networking engine has received the headers for
 *    a download, but before the body has been downloaded.
 *    If the HTTP plugin being used does not track this information, this event
 *    will default to being fired when the body is received, instead.
 * @property {!Object.<string, string>} headers
 * @property {!shaka.extern.Request} request
 * @property {!shaka.net.NetworkingEngine.RequestType} type
 *   'downloadheadersreceived'
 * @exportDoc
 */

/**
 * @event shaka.Player.DrmSessionUpdateEvent
 * @description Fired when the CDM has accepted the license response.
 * @property {string} type
 *   'drmsessionupdate'
 * @exportDoc
 */

/**
 * @event shaka.Player.TimelineRegionAddedEvent
 * @description Fired when a media timeline region is added.
 * @property {string} type
 *   'timelineregionadded'
 * @property {shaka.extern.TimelineRegionInfo} detail
 *   An object which contains a description of the region.
 * @exportDoc
 */

/**
 * @event shaka.Player.TimelineRegionEnterEvent
 * @description Fired when the playhead enters a timeline region.
 * @property {string} type
 *   'timelineregionenter'
 * @property {shaka.extern.TimelineRegionInfo} detail
 *   An object which contains a description of the region.
 * @exportDoc
 */

/**
 * @event shaka.Player.TimelineRegionExitEvent
 * @description Fired when the playhead exits a timeline region.
 * @property {string} type
 *   'timelineregionexit'
 * @property {shaka.extern.TimelineRegionInfo} detail
 *   An object which contains a description of the region.
 * @exportDoc
 */

/**
 * @event shaka.Player.MediaQualityChangedEvent
 * @description Fired when the media quality changes at the playhead.
 * That may be caused by an adaptation change or a DASH period transition.
 * Separate events are emitted for audio and video contentTypes.
 * This is supported for only DASH streams at this time.
 * @property {string} type
 *   'mediaqualitychanged'
 * @property {shaka.extern.MediaQualityInfo} mediaQuality
 *   Information about media quality at the playhead position.
 * @property {number} position
 *   The playhead position.
 * @exportDoc
 */

/**
 * @event shaka.Player.BufferingEvent
 * @description Fired when the player's buffering state changes.
 * @property {string} type
 *   'buffering'
 * @property {boolean} buffering
 *   True when the Player enters the buffering state.
 *   False when the Player leaves the buffering state.
 * @exportDoc
 */

/**
 * @event shaka.Player.LoadingEvent
 * @description Fired when the player begins loading. The start of loading is
 *   defined as when the user has communicated intent to load content (i.e.
 *   <code>Player.load</code> has been called).
 * @property {string} type
 *   'loading'
 * @exportDoc
 */

/**
 * @event shaka.Player.LoadedEvent
 * @description Fired when the player ends the load.
 * @property {string} type
 *   'loaded'
 * @exportDoc
 */

/**
 * @event shaka.Player.UnloadingEvent
 * @description Fired when the player unloads or fails to load.
 *   Used by the Cast receiver to determine idle state.
 * @property {string} type
 *   'unloading'
 * @exportDoc
 */

/**
 * @event shaka.Player.TextTrackVisibilityEvent
 * @description Fired when text track visibility changes.
 * @property {string} type
 *   'texttrackvisibility'
 * @exportDoc
 */

/**
 * @event shaka.Player.TracksChangedEvent
 * @description Fired when the list of tracks changes.  For example, this will
 *   happen when new tracks are added/removed or when track restrictions change.
 * @property {string} type
 *   'trackschanged'
 * @exportDoc
 */

/**
 * @event shaka.Player.AdaptationEvent
 * @description Fired when an automatic adaptation causes the active tracks
 *   to change.  Does not fire when the application calls
 *   <code>selectVariantTrack()</code>, <code>selectTextTrack()</code>,
 *   <code>selectAudioLanguage()</code>, or <code>selectTextLanguage()</code>.
 * @property {string} type
 *   'adaptation'
 * @property {shaka.extern.Track} oldTrack
 * @property {shaka.extern.Track} newTrack
 * @exportDoc
 */

/**
 * @event shaka.Player.VariantChangedEvent
 * @description Fired when a call from the application caused a variant change.
 *  Can be triggered by calls to <code>selectVariantTrack()</code> or
 *  <code>selectAudioLanguage()</code>. Does not fire when an automatic
 *  adaptation causes a variant change.
 * @property {string} type
 *   'variantchanged'
 * @property {shaka.extern.Track} oldTrack
 * @property {shaka.extern.Track} newTrack
 * @exportDoc
 */

/**
 * @event shaka.Player.TextChangedEvent
 * @description Fired when a call from the application caused a text stream
 *  change. Can be triggered by calls to <code>selectTextTrack()</code> or
 *  <code>selectTextLanguage()</code>.
 * @property {string} type
 *   'textchanged'
 * @exportDoc
 */

/**
 * @event shaka.Player.ExpirationUpdatedEvent
 * @description Fired when there is a change in the expiration times of an
 *   EME session.
 * @property {string} type
 *   'expirationupdated'
 * @exportDoc
 */

/**
 * @event shaka.Player.ManifestParsedEvent
 * @description Fired after the manifest has been parsed, but before anything
 *   else happens. The manifest may contain streams that will be filtered out,
 *   at this stage of the loading process.
 * @property {string} type
 *   'manifestparsed'
 * @exportDoc
 */

/**
 * @event shaka.Player.MetadataEvent
 * @description Triggers after metadata associated with the stream is found.
 *   Usually they are metadata of type ID3.
 * @property {string} type
 *   'metadata'
 * @property {number} startTime
 *   The time that describes the beginning of the range of the metadata to
 *   which the cue applies.
 * @property {?number} endTime
 *   The time that describes the end of the range of the metadata to which
 *   the cue applies.
 * @property {string} metadataType
 *   Type of metadata. Eg: org.id3 or org.mp4ra
 * @property {shaka.extern.ID3Metadata} payload
 *   The metadata itself
 * @exportDoc
 */

/**
 * @event shaka.Player.StreamingEvent
 * @description Fired after the manifest has been parsed and track information
 *   is available, but before streams have been chosen and before any segments
 *   have been fetched.  You may use this event to configure the player based on
 *   information found in the manifest.
 * @property {string} type
 *   'streaming'
 * @exportDoc
 */

/**
 * @event shaka.Player.AbrStatusChangedEvent
 * @description Fired when the state of abr has been changed.
 *    (Enabled or disabled).
 * @property {string} type
 *   'abrstatuschanged'
 * @property {boolean} newStatus
 *  The new status of the application. True for 'is enabled' and
 *  false otherwise.
 * @exportDoc
 */

/**
 * @event shaka.Player.RateChangeEvent
 * @description Fired when the video's playback rate changes.
 *    This allows the PlayRateController to update it's internal rate field,
 *    before the UI updates playback button with the newest playback rate.
 * @property {string} type
 *    'ratechange'
 * @exportDoc
 */

/**
 * @event shaka.Player.SegmentAppended
 * @description Fired when a segment is appended to the media element.
 * @property {string} type
 *   'segmentappended'
 * @property {number} start
 *   The start time of the segment.
 * @property {number} end
 *   The end time of the segment.
 * @property {string} contentType
 *   The content type of the segment. E.g. 'video', 'audio', or 'text'.
 * @exportDoc
 */

/**
 * @event shaka.Player.SessionDataEvent
 * @description Fired when the manifest parser find info about session data.
 *    Specification: https://tools.ietf.org/html/rfc8216#section-4.3.4.4
 * @property {string} type
 *   'sessiondata'
 * @property {string} id
 *   The id of the session data.
 * @property {string} uri
 *   The uri with the session data info.
 * @property {string} language
 *   The language of the session data.
 * @property {string} value
 *   The value of the session data.
 * @exportDoc
 */

/**
 * @event shaka.Player.StallDetectedEvent
 * @description Fired when a stall in playback is detected by the StallDetector.
 *     Not all stalls are caused by gaps in the buffered ranges.
 * @property {string} type
 *   'stalldetected'
 * @exportDoc
 */

/**
 * @event shaka.Player.GapJumpedEvent
 * @description Fired when the GapJumpingController jumps over a gap in the
 *     buffered ranges.
 * @property {string} type
 *   'gapjumped'
 * @exportDoc
 */

/**
 * @summary The main player object for Shaka Player.
 *
 * @export
 */
export class Player extends FakeEventTarget implements IDestroyable {
  private loadMode_: LoadMode;
  private video_: HTMLMediaElement | null= null;
  private videoContainer_: HTMLElement  | null = null;

  /**
   * Since we may not always have a text displayer created (e.g. before |load|
   * is called), we need to track what text visibility SHOULD be so that we
   * can ensure that when we create the text displayer. When we create our
   * text displayer, we will use this to show (or not show) text as per the
   * user's requests.
   *
   */
  private isTextVisible_: boolean = false;

  /**
   * For listeners scoped to the lifetime of the Player instance.
   */
  private globalEventManager_: EventManager | null;

  /**
   * For listeners scoped to the lifetime of the media element attachment.
   */
  private attachEventManager_: EventManager  | null;

  /**
   * For listeners scoped to the lifetime of the loaded content.
   */
  private loadEventManager_: EventManager  | null;
  private networkingEngine_: NetworkingEngine  | null = null;
  private drmEngine_: DrmEngine  | null = null;
  private mediaSourceEngine_: MediaSourceEngine  | null= null;
  private playhead_: Playhead  | null = null;

  /**
   * The playhead observers are used to monitor the position of the playhead
   * and some other source of data (e.g. buffered content), and raise events.
   *
   */
  private playheadObservers_: PlayheadObserverManager  | null = null;

  /**
   * This is our control over the playback rate of the media element. This
   * provides the missing functionality that we need to provide trick play,
   * for example a negative playback rate.
   *
   */
  private playRateController_: PlayRateController  | null = null;

  // We use the buffering observer and timer to track when we move from having
  // enough buffered content to not enough. They only exist when content has
  // been loaded and are not re-used between loads.
  private bufferPoller_: Timer  | null = null;
  private bufferObserver_: BufferingObserver  | null = null;
  private regionTimeline_: RegionTimeline  | null = null;
  private cmcdManager_: CmcdManager  | null = null;
  private qualityObserver_: QualityObserver  | null = null;
  private streamingEngine_: StreamingEngine  | null= null;
  private parser_: ManifestParser  | null = null;
  private parserFactory_: Factory|null = null;
  private manifest_: Manifest|null = null;
  private assetUri_: string|null = null;
  private abrManager_: AbrManager  | null= null;

  /**
   * The factory that was used to create the abrManager_ instance.
   */
  private abrManagerFactory_: Factory|null = null;

  /**
   * Contains an ID for use with creating streams.  The manifest parser should
   * start with small IDs, so this starts with a large one.
   */
  private nextExternalStreamId_: number = 1e9;
  private config_: IPlayerConfiguration|null;

  /**
   * The TextDisplayerFactory that was last used to make a text displayer.
   * Stored so that we can tell if a new type of text displayer is desired.
   */
  private lastTextFactory_: shaka.extern.TextDisplayer.Factory|null;
  private maxHwRes_:
      {width: number, height: number} = {width: Infinity, height: Infinity};
  private stats_: Stats  | null= null;
  private currentAdaptationSetCriteria_: AdaptationSetCriteria;
  private currentTextLanguage_: string;
  private currentTextRole_: string;
  private currentTextForced_: boolean;
  private cleanupOnUnload_: (() => Promise<any> | undefined)[] = [];

  /**
   * This playback start position will be used when
   * <code>updateStartTime()</code> has been called to provide an updated
   * start position during the media loading process.
   *
   */
  private updatedStartTime_: number|null = null;
  private adManager_: IAdManager | null = null;
  private detachNode_: Node = {name: 'detach'};
  private attachNode_: Node = {name: 'attach'};
  private unloadNode_: Node = {name: 'unload'};
  private parserNode_: Node = {name: 'manifest-parser'};
  private manifestNode_: Node = {name: 'manifest'};
  private mediaSourceNode_: Node = {name: 'media-source'};
  private drmNode_: Node = {name: 'drm-engine'};
  private loadNode_: Node = {name: 'load'};
  private srcEqualsDrmNode_: Node = {name: 'src-equals-drm-engine'};
  private srcEqualsNode_: Node = {name: 'src-equals'};
  private walker_: Walker;
  private checkVariantsTimer_: Timer;

  /**
   *    When provided, the player will attach to <code>mediaElement</code>,
   *    similar to calling <code>attach</code>. When not provided, the player
   *    will remain detached.
   * @param dependencyInjector Optional callback
   *   which is called to inject mocks into the Player.  Used for testing.
   */
  constructor(
      mediaElement?: HTMLMediaElement,
      dependencyInjector?: (p1: Player) => any) {
    super();
    this.loadMode_ = LoadMode.NOT_LOADED;
    this.globalEventManager_ = new EventManager();
    this.attachEventManager_ = new EventManager();
    this.loadEventManager_ = new EventManager();
    this.config_ = this.defaultConfig_();
    this.currentAdaptationSetCriteria_ = new PreferenceBasedCriteria(
        this.config_.preferredAudioLanguage, this.config_.preferredVariantRole,
        this.config_.preferredAudioChannelCount);
    this.currentTextLanguage_ = this.config_.preferredTextLanguage;
    this.currentTextRole_ = this.config_.preferredTextRole;
    this.currentTextForced_ = this.config_.preferForcedSubs;
    if (dependencyInjector) {
      dependencyInjector(this);
    }
    this.networkingEngine_ = this.createNetworkingEngine();
    this.networkingEngine_.setForceHTTPS(this.config_.streaming.forceHTTPS);
    if (adManagerFactory_) {
      this.adManager_ = adManagerFactory_();
    }

    // If the browser comes back online after being offline, then try to play
    // again.
    this.globalEventManager_.listen(window, 'online', () => {
      this.retryStreaming();
    });
    //const AbortableOperation = AbortableOperation;
    const actions = new Map();
    actions.set(this.attachNode_, (has, wants) => {
      return AbortableOperation.notAbortable(this.onAttach_(has, wants));
    });
    actions.set(this.detachNode_, (has, wants) => {
      return AbortableOperation.notAbortable(this.onDetach_(has, wants));
    });
    actions.set(this.unloadNode_, (has, wants) => {
      return AbortableOperation.notAbortable(this.onUnload_(has, wants));
    });
    actions.set(this.mediaSourceNode_, (has, wants) => {
      const p = this.onInitializeMediaSourceEngine_(has, wants);
      return AbortableOperation.notAbortable(p);
    });
    actions.set(this.parserNode_, (has, wants) => {
      const p = this.onInitializeParser_(has, wants);
      return AbortableOperation.notAbortable(p);
    });
    actions.set(this.manifestNode_, (has, wants) => {
      // This action is actually abortable, so unlike the other callbacks, this
      // one will return an abortable operation.
      return this.onParseManifest_(has, wants);
    });
    actions.set(this.drmNode_, (has, wants) => {
      const p = this.onInitializeDrm_(has, wants);
      return AbortableOperation.notAbortable(p);
    });
    actions.set(this.loadNode_, (has, wants) => {
      return AbortableOperation.notAbortable(this.onLoad_(has, wants));
    });
    actions.set(this.srcEqualsDrmNode_, (has, wants) => {
      const p = this.onInitializeSrcEqualsDrm_(has, wants);
      return AbortableOperation.notAbortable(p);
    });
    actions.set(this.srcEqualsNode_, (has, wants) => {
      return this.onSrcEquals_(has, wants);
    });
    const walkerImplementation: WalkerExports.Implementation = {
      getNext: (at, has, goingTo, wants) => {
        return this.getNextStep_(at, has, goingTo, wants);
      },
      enterNode: (node, has, wants) => {
        this.dispatchEvent(this.makeEvent_(
            FakeEventExports.EventName.OnStateChange,
            /* name= */
            /* data= */
            (new Map()).set('state', node.name)));
        const action = actions.get(node);
        return action(has, wants);
      },
      handleError: async (has, error:any) => {
        log.warning('The walker saw an error:');
        if (error instanceof Error) {
          log.warning('Error Code:', error.code);
        } else {
          log.warning('Error Message:', error.message);
          log.warning('Error Stack:', error.stack);
        }

        // Regardless of what state we were in, if there is an error, we unload.
        // This ensures that any initialized system will be torn-down and we
        // will go back to a safe foundation. We assume that the media element
        // is always safe to use after an error.
        await this.onUnload_(has, Player.createEmptyPayload_());

        // There are only two nodes that come before we start loading content,
        // attach and detach. If we have a media element, it means we were
        // attached to the element, and we can safely return to the attach state
        // (we assume that the video element is always re-usable). We favor
        // returning to the attach node since it means that the app won't need
        // to re-attach if it saw an error.
        return has.mediaElement ? this.attachNode_ : this.detachNode_;
      },
      onIdle: (node) => {
        this.dispatchEvent(this.makeEvent_(
            FakeEventExports.EventName.OnStateIdle,
            /* name= */
            /* data= */
            (new Map()).set('state', node.name)));
      }
    };
    this.walker_ = new Walker(
        this.detachNode_, Player.createEmptyPayload_(), walkerImplementation);
    this.checkVariantsTimer_ = new Timer(() => this.checkVariants_());

    // Even though |attach| will start in later interpreter cycles, it should be
    // the LAST thing we do in the constructor because conceptually it relies on
    // player having been initialized.
    if (mediaElement) {
      this.attach(
          mediaElement,
          /* initializeMediaSource= */
          true);
    }
  }

  private makeEvent_(
      name: FakeEventExports.EventName, data?: Map<string, Object>): FakeEvent {
    return new FakeEvent(name, data);
  }

  /**
   * After destruction, a Player object cannot be used again.
   *
   * @override
   * @export
   */
  async destroy() {
    // Make sure we only execute the destroy logic once.
    if (this.loadMode_ == LoadMode.DESTROYED) {
      return;
    }

    // Mark as "dead". This should stop external-facing calls from changing our
    // internal state any more. This will stop calls to |attach|, |detach|, etc.
    // from interrupting our final move to the detached state.
    this.loadMode_ = LoadMode.DESTROYED;

    // Because we have set |loadMode_| to |DESTROYED| we can't call |detach|. We
    // must talk to |this.walker_| directly.
    const events = this.walker_.startNewRoute((currentPayload) => {
      return {
        node: this.detachNode_,
        payload: Player.createEmptyPayload_(),
        interruptible: false
      };
    });

    // Wait until the detach has finished so that we don't interrupt it by
    // calling |destroy| on |this.walker_|. To avoid failing here, we always
    // resolve the promise.
    await new Promise((resolve:any) => {
      events.onStart = () => {
        log.info('Preparing to destroy walker...');
      };
      events.onEnd = () => {
        resolve();
      };
      events.onCancel = () => {
        asserts.assert(
            false, 'Our final detach call should never be cancelled.');
        resolve();
      };
      events.onError = () => {
        asserts.assert(
            false, 'Our final detach call should never see an error');
        resolve();
      };
      events.onSkip = () => {
        asserts.assert(false, 'Our final detach call should never be skipped');
        resolve();
      };
    });
    await this.walker_.destroy();

    // Tear-down the event managers to ensure handlers stop firing.
    if (this.globalEventManager_) {
      this.globalEventManager_.release();
      this.globalEventManager_ = null;
    }
    if (this.attachEventManager_) {
      this.attachEventManager_.release();
      this.attachEventManager_ = null;
    }
    if (this.loadEventManager_) {
      this.loadEventManager_.release();
      this.loadEventManager_ = null;
    }
    this.abrManagerFactory_ = null;
    this.abrManager_ = null;
    this.config_ = null;
    this.stats_ = null;
    this.videoContainer_ = null;
    this.cmcdManager_ = null;
    if (this.networkingEngine_) {
      await this.networkingEngine_.destroy();
      this.networkingEngine_ = null;
    }

    // FakeEventTarget implements IReleasable
    super.release();
  }

  /**
   * Registers a plugin callback that will be called with
   * <code>support()</code>.  The callback will return the value that will be
   * stored in the return value from <code>support()</code>.
   *
   * @export
   */
  static registerSupportPlugin(name: string, callback: () => any) {
    supportPlugins_[name] = callback;
  }

  /**
   * Set a factory to create an ad manager during player construction time.
   * This method needs to be called bafore instantiating the Player class.
   *
   * @export
   */
  static setAdManagerFactory(factory: shaka.extern.IAdManager.Factory) {
    adManagerFactory_ = factory;
  }

  /**
   * Return whether the browser provides basic support.  If this returns false,
   * Shaka Player cannot be used at all.  In this case, do not construct a
   * Player instance and do not use the library.
   *
   * @export
   */
  static isBrowserSupported(): boolean {
    if (!window.Promise) {
      log.alwaysWarn('A Promise implementation or polyfill is required');
    }

    // Basic features needed for the library to be usable.
    const basicSupport = !!window.Promise && !!window.Uint8Array &&
        // eslint-disable-next-line no-restricted-syntax
        !!Array.prototype.forEach;
    if (!basicSupport) {
      return false;
    }

    // We do not support IE
    if (Platform.isIE()) {
      return false;
    }

    // We do not support iOS 9, 10, 11 or 12, nor those same versions of
    // desktop Safari.
    const safariVersion = Platform.safariVersion();
    if (safariVersion && safariVersion < 13) {
      return false;
    }

    // DRM support is not strictly necessary, but the APIs at least need to be
    // there.  Our no-op DRM polyfill should handle that.
    // TODO(#1017): Consider making even DrmEngine optional.
    const drmSupport = DrmEngine.isBrowserSupported();
    if (!drmSupport) {
      return false;
    }

    // If we have MediaSource (MSE) support, we should be able to use Shaka.
    if (Platform.supportsMediaSource()) {
      return true;
    }

    // If we don't have MSE, we _may_ be able to use Shaka.  Look for native HLS
    // support, and call this platform usable if we have it.
    return Platform.supportsMediaType('application/x-mpegurl');
  }

  /**
   * Probes the browser to determine what features are supported.  This makes a
   * number of requests to EME/MSE/etc which may result in user prompts.  This
   * should only be used for diagnostics.
   *
   * <p>
   * NOTE: This may show a request to the user for permission.
   *
   * @see https://bit.ly/2ywccmH
   * @export
   */
  static async probeSupport(promptsOkay: boolean = true):
      Promise<shaka.extern.SupportType> {
    asserts.assert(Player.isBrowserSupported(), 'Must have basic support');
    let drm = {};
    if (promptsOkay) {
      drm = await DrmEngine.probeSupport();
    }
    const manifest = ManifestParser.probeSupport();
    const media = MediaSourceEngine.probeSupport();
    const ret = {manifest: manifest, media: media, drm: drm};
    const plugins = supportPlugins_;
    for (const name in plugins) {
      ret[name] = plugins[name]();
    }
    return ret;
  }

  /**
   * Tell the player to use <code>mediaElement</code> for all <code>load</code>
   * requests until <code>detach</code> or <code>destroy</code> are called.
   *
   * <p>
   * Calling <code>attach</code> with <code>initializedMediaSource=true</code>
   * will tell the player to take the initial load step and initialize media
   * source.
   *
   * <p>
   * Calls to <code>attach</code> will interrupt any in-progress calls to
   * <code>load</code> but cannot interrupt calls to <code>attach</code>,
   * <code>detach</code>, or <code>unload</code>.
   *
   * @export
   */
  attach(mediaElement: HTMLMediaElement, initializeMediaSource: boolean = true):
      Promise {
    // Do not allow the player to be used after |destroy| is called.
    if (this.loadMode_ == LoadMode.DESTROYED) {
      return Promise.reject(this.createAbortLoadError_());
    }
    const payload = Player.createEmptyPayload_();
    payload.mediaElement = mediaElement;

    // If the platform does not support media source, we will never want to
    // initialize media source.
    if (!Platform.supportsMediaSource()) {
      initializeMediaSource = false;
    }
    const destination =
        initializeMediaSource ? this.mediaSourceNode_ : this.attachNode_;

    // Do not allow this route to be interrupted because calls after this attach
    // call will depend on the media element being attached.
    const events = this.walker_.startNewRoute((currentPayload) => {
      return {node: destination, payload: payload, interruptible: false};
    });

    // List to the events that can occur with our request.
    events.onStart = () => log.info('Starting attach...');
    return this.wrapWalkerListenersWithPromise_(events);
  }

  /**
   * Tell the player to stop using its current media element. If the player is:
   * <ul>
   *  <li>detached, this will do nothing,
   *  <li>attached, this will release the media element,
   *  <li>loading, this will abort loading, unload, and release the media
   *      element,
   *  <li>playing content, this will stop playback, unload, and release the
   *      media element.
   * </ul>
   *
   * <p>
   * Calls to <code>detach</code> will interrupt any in-progress calls to
   * <code>load</code> but cannot interrupt calls to <code>attach</code>,
   * <code>detach</code>, or <code>unload</code>.
   *
   * @export
   */
  detach(): Promise {
    // Do not allow the player to be used after |destroy| is called.
    if (this.loadMode_ == LoadMode.DESTROYED) {
      return Promise.reject(this.createAbortLoadError_());
    }

    // Tell the walker to go "detached", but do not allow it to be interrupted.
    // If it could be interrupted it means that our media element could fall out
    // of sync.
    const events = this.walker_.startNewRoute((currentPayload) => {
      return {
        node: this.detachNode_,
        payload: Player.createEmptyPayload_(),
        interruptible: false
      };
    });
    events.onStart = () => log.info('Starting detach...');
    return this.wrapWalkerListenersWithPromise_(events);
  }

  /**
   * Tell the player to either return to:
   * <ul>
   *   <li>detached (when it does not have a media element),
   *   <li>attached (when it has a media element and
   *     <code>initializedMediaSource=false</code>)
   *   <li>media source initialized (when it has a media element and
   *     <code>initializedMediaSource=true</code>)
   * </ul>
   *
   * <p>
   * Calls to <code>unload</code> will interrupt any in-progress calls to
   * <code>load</code> but cannot interrupt calls to <code>attach</code>,
   * <code>detach</code>, or <code>unload</code>.
   *
   * @export
   */
  unload(initializeMediaSource: boolean = true): Promise {
    // Do not allow the player to be used after |destroy| is called.
    if (this.loadMode_ == LoadMode.DESTROYED) {
      return Promise.reject(this.createAbortLoadError_());
    }

    // If the platform does not support media source, we will never want to
    // initialize media source.
    if (!Platform.supportsMediaSource()) {
      initializeMediaSource = false;
    }

    // Since we are going either to attached or detached (through unloaded), we
    // can't allow it to be interrupted or else we could lose track of what
    // media element we are suppose to use.
    // Using the current payload, we can determine which node we want to go to.
    // If we have a media element, we want to go back to attached. If we have no
    // media element, we want to go back to detached.
    const payload = Player.createEmptyPayload_();
    const events = this.walker_.startNewRoute((currentPayload) => {
      // When someone calls |unload| we can either be before attached or
      // detached (there is nothing stopping someone from calling |detach| when
      // we are already detached).
      // If we are attached to the correct element, we can tear down the
      // previous playback components and go to the attached media source node
      // depending on whether or not the caller wants to pre-init media source.
      // If we don't have a media element, we assume that we are already at the
      // detached node - but only the walker knows that. To ensure we are
      // actually there, we tell the walker to go to detach. While this is
      // technically unnecessary, it ensures that we are in the state we want
      // to be in and ready for the next request.
      let destination = null;
      if (currentPayload.mediaElement && initializeMediaSource) {
        destination = this.mediaSourceNode_;
      } else {
        if (currentPayload.mediaElement) {
          destination = this.attachNode_;
        } else {
          destination = this.detachNode_;
        }
      }
      asserts.assert(destination, 'We should have picked a destination.');

      // Copy over the media element because we want to keep using the same
      // element - the other values don't matter.
      payload.mediaElement = currentPayload.mediaElement;
      return {node: destination, payload: payload, interruptible: false};
    });
    events.onStart = () => log.info('Starting unload...');
    return this.wrapWalkerListenersWithPromise_(events);
  }

  /**
   * Provides a way to update the stream start position during the media loading
   * process. Can for example be called from the <code>manifestparsed</code>
   * event handler to update the start position based on information in the
   * manifest.
   *
   * @export
   */
  updateStartTime(startTime: number) {
    this.updatedStartTime_ = startTime;
  }

  /**
   * Tell the player to load the content at <code>assetUri</code> and start
   * playback at <code>startTime</code>. Before calling <code>load</code>,
   * a call to <code>attach</code> must have succeeded.
   *
   * <p>
   * Calls to <code>load</code> will interrupt any in-progress calls to
   * <code>load</code> but cannot interrupt calls to <code>attach</code>,
   * <code>detach</code>, or <code>unload</code>.
   *
   *    When <code>startTime</code> is <code>null</code> or
   *    <code>undefined</code>, playback will start at the default start time (0
   *    for VOD and liveEdge for LIVE).
   * @export
   */
  load(assetUri: string, startTime?: number|null, mimeType?: string): Promise {
    this.updatedStartTime_ = null;

    // Do not allow the player to be used after |destroy| is called.
    if (this.loadMode_ == LoadMode.DESTROYED) {
      return Promise.reject(this.createAbortLoadError_());
    }

    // We dispatch the loading event when someone calls |load| because we want
    // to surface the user intent.
    this.dispatchEvent(this.makeEvent_(FakeEventExports.EventName.Loading));

    // Right away we know what the asset uri and start-of-load time are. We will
    // fill-in the rest of the information later.
    const payload = Player.createEmptyPayload_();
    payload.uri = assetUri;
    payload.startTimeOfLoad = Date.now() / 1000;
    if (mimeType) {
      payload.mimeType = mimeType;
    }

    // Because we allow |startTime| to be optional, it means that it will be
    // |undefined| when not provided. This means that we need to re-map
    // |undefined| to |null| while preserving |0| as a meaningful value.
    if (startTime !== undefined) {
      payload.startTime = startTime;
    }

    // TODO: Refactor to determine whether it's a manifest or not, and whether
    // or not we can play it.  Then we could return a better error than
    // UNABLE_TO_GUESS_MANIFEST_TYPE for WebM in Safari.
    const useSrcEquals = this.shouldUseSrcEquals_(payload);
    const destination = useSrcEquals ? this.srcEqualsNode_ : this.loadNode_;

    // Allow this request to be interrupted, this will allow other requests to
    // cancel a load and quickly start a new load.
    const events = this.walker_.startNewRoute((currentPayload) => {
      if (currentPayload.mediaElement == null) {
        // Because we return null, this "new route" will not be used.
        return null;
      }

      // Keep using whatever media element we have right now.
      payload.mediaElement = currentPayload.mediaElement;
      return {node: destination, payload: payload, interruptible: true};
    });

    // Stats are for a single playback/load session. Stats must be initialized
    // before we allow calls to |updateStateHistory|.
    this.stats_ = new Stats();

    // Create the CMCD manager so client data can be attached to all requests
    this.cmcdManager_ = this.createCmcd_();

    // Load's request is a little different, so we can't use our normal
    // listeners-to-promise method. It is the only request where we may skip the
    // request, so we need to set the on skip callback to reject with a specific
    // error.
    events.onStart = () => log.info('Starting load of ' + assetUri + '...');
    return new Promise((resolve, reject) => {
      events.onSkip = () => reject(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
          ErrorExports.Code.NO_VIDEO_ELEMENT));
      events.onEnd = () => {
        resolve();

        // We dispatch the loaded event when the load promise is resolved
        this.dispatchEvent(this.makeEvent_(FakeEventExports.EventName.Loaded));
      };
      events.onCancel = () => reject(this.createAbortLoadError_());
      events.onError = (e) => reject(e);
    });
  }

  /**
   * Check if src= should be used to load the asset at |uri|. Assume that media
   * source is the default option, and that src= is for special cases.
   *
   *    |true| if the content should be loaded with src=, |false| if the content
   *    should be loaded with MediaSource.
   */
  private shouldUseSrcEquals_(payload: Payload): boolean {
    const Platform = Platform;

    // If we are using a platform that does not support media source, we will
    // fall back to src= to handle all playback.
    if (!Platform.supportsMediaSource()) {
      return true;
    }

    // The most accurate way to tell the player how to load the content is via
    // MIME type.  We can fall back to features of the URI if needed.
    let mimeType = payload.mimeType;
    const uri = payload.uri || '';

    // If we don't have a MIME type, try to guess based on the file extension.
    // TODO: Too generic to belong to ManifestParser now.  Refactor.
    if (!mimeType) {
      // Try using the uri extension.
      const extension = ManifestParser.getExtension(uri);
      mimeType = SRC_EQUAL_EXTENSIONS_TO_MIME_TYPES_[extension];
    }

    // TODO: The load graph system has a design limitation that requires routing
    // destination to be chosen synchronously.  This means we can only make the
    // right choice about src= consistently if we have a well-known file
    // extension or API-provided MIME type.  Detection of MIME type from a HEAD
    // request (as is done for manifest types) can't be done yet.
    if (mimeType) {
      // If we have a MIME type, check if the browser can play it natively.
      // This will cover both single files and native HLS.
      const mediaElement = payload.mediaElement || Platform.anyMediaElement();
      const canPlayNatively = mediaElement.canPlayType(mimeType) != '';

      // If we can't play natively, then src= isn't an option.
      if (!canPlayNatively) {
        return false;
      }
      const canPlayMediaSource = ManifestParser.isSupported(uri, mimeType);

      // If MediaSource isn't an option, the native option is our only chance.
      if (!canPlayMediaSource) {
        return true;
      }

      // If we land here, both are feasible.
      asserts.assert(
          canPlayNatively && canPlayMediaSource,
          'Both native and MSE playback should be possible!');

      // We would prefer MediaSource in some cases, and src= in others.  For
      // example, Android has native HLS, but we'd prefer our own MediaSource
      // version there.

      // Native HLS can be preferred on any platform via this flag:
      if (this.config_.streaming.preferNativeHls) {
        return true;
      }

      // For Safari, we have an older flag which only applies to this one
      // browser:
      if (Platform.isApple()) {
        return this.config_.streaming.useNativeHlsOnSafari;
      }

      // In all other cases, we prefer MediaSource.
      return false;
    }

    // Unless there are good reasons to use src= (single-file playback or native
    // HLS), we prefer MediaSource.  So the final return value for choosing src=
    // is false.
    return false;
  }

  /**
   * This should only be called by the load graph when it is time to attach to
   * a media element. The only times this may be called are when we are being
   * asked to re-attach to the current media element, or attach to a new media
   * element while not attached to a media element.
   *
   * This method assumes that it is safe for it to execute, the load-graph is
   * responsible for ensuring all assumptions are true.
   *
   * Attaching to a media element is defined as:
   *  - Registering error listeners to the media element.
   *  - Caching the video element for use outside of the load graph.
   *
   */
  private onAttach_(has: Payload, wants: Payload): Promise {
    // If we don't have a media element yet, it means we are entering
    // "attach" from another node.
    // If we have a media element, it should match |wants.mediaElement|
    // because it means we are going from "attach" to "attach".
    // These constraints should be maintained and guaranteed by the routing
    // logic in |getNextStep_|.
    asserts.assert(
        has.mediaElement == null || has.mediaElement == wants.mediaElement,
        'The routing logic failed. MediaElement requirement failed.');
    if (has.mediaElement == null) {
      has.mediaElement = wants.mediaElement;
      const onError = (error) => this.onVideoError_(error);
      this.attachEventManager_.listen(has.mediaElement, 'error', onError);
    }
    this.video_ = has.mediaElement;
    return Promise.resolve();
  }

  /**
   * This should only be called by the load graph when it is time to detach from
   * a media element. The only times this may be called are when we are being
   * asked to detach from the current media element, or detach when we are
   * already detached.
   *
   * This method assumes that it is safe for it to execute, the load-graph is
   * responsible for ensuring all assumptions are true.
   *
   * Detaching from a media element is defined as:
   *  - Removing error listeners from the media element.
   *  - Dropping the cached reference to the video element.
   *
   */
  private onDetach_(has: Payload, wants: Payload): Promise {
    // If we were going from "detached" to "detached" we wouldn't have
    // a media element to detach from.
    if (has.mediaElement) {
      this.attachEventManager_.removeAll();
      has.mediaElement = null;
    }
    if (this.adManager_) {
      // The ad manager is specific to the video, so detach it too.
      this.adManager_.release();
    }

    // Clear our cached copy of the media element.
    this.video_ = null;
    return Promise.resolve();
  }

  /**
   * This should only be called by the load graph when it is time to unload all
   * currently initialized playback components. Unlike the other load actions,
   * this action is built to be more general. We need to do this because we
   * don't know what state the player will be in before unloading (including
   * after an error occurred in the middle of a transition).
   *
   * This method assumes that any component could be |null| and should be safe
   * to call from any point in the load graph.
   *
   */
  private async onUnload_(has: Payload, wants: Payload): Promise {
    // Set the load mode to unload right away so that all the public methods
    // will stop using the internal components. We need to make sure that we
    // are not overriding the destroyed state because we will unload when we are
    // destroying the player.
    if (this.loadMode_ != LoadMode.DESTROYED) {
      this.loadMode_ = LoadMode.NOT_LOADED;
    }

    // Run any general cleanup tasks now.  This should be here at the top, right
    // after setting loadMode_, so that internal components still exist as they
    // did when the cleanup tasks were registered in the array.
    const cleanupTasks = this.cleanupOnUnload_.map((cb) => cb());
    this.cleanupOnUnload_ = [];
    await Promise.all(cleanupTasks);

    // Dispatch the unloading event.
    this.dispatchEvent(this.makeEvent_(FakeEventExports.EventName.Unloading));

    // Remove everything that has to do with loading content from our payload
    // since we are releasing everything that depended on it.
    has.mimeType = null;
    has.startTime = null;
    has.uri = null;

    // In most cases we should have a media element. The one exception would
    // be if there was an error and we, by chance, did not have a media element.
    if (has.mediaElement) {
      this.loadEventManager_.removeAll();
    }

    // Stop the variant checker timer
    this.checkVariantsTimer_.stop();

    // Some observers use some playback components, shutting down the observers
    // first ensures that they don't try to use the playback components
    // mid-destroy.
    if (this.playheadObservers_) {
      this.playheadObservers_.release();
      this.playheadObservers_ = null;
    }
    if (this.bufferPoller_) {
      this.bufferPoller_.stop();
      this.bufferPoller_ = null;
    }

    // Stop the parser early. Since it is at the start of the pipeline, it
    // should be start early to avoid is pushing new data downstream.
    if (this.parser_) {
      await this.parser_.stop();
      this.parser_ = null;
      this.parserFactory_ = null;
    }

    // Abr Manager will tell streaming engine what to do, so we need to stop
    // it before we destroy streaming engine. Unlike with the other components,
    // we do not release the instance, we will reuse it in later loads.
    if (this.abrManager_) {
      await this.abrManager_.stop();
    }

    // Streaming engine will push new data to media source engine, so we need
    // to shut it down before destroy media source engine.
    if (this.streamingEngine_) {
      await this.streamingEngine_.destroy();
      this.streamingEngine_ = null;
    }
    if (this.playRateController_) {
      this.playRateController_.release();
      this.playRateController_ = null;
    }

    // Playhead is used by StreamingEngine, so we can't destroy this until after
    // StreamingEngine has stopped.
    if (this.playhead_) {
      this.playhead_.release();
      this.playhead_ = null;
    }

    // Media source engine holds onto the media element, and in order to detach
    // the media keys (with drm engine), we need to break the connection between
    // media source engine and the media element.
    if (this.mediaSourceEngine_) {
      await this.mediaSourceEngine_.destroy();
      this.mediaSourceEngine_ = null;
    }
    if (this.adManager_) {
      this.adManager_.onAssetUnload();
    }

    // In order to unload a media element, we need to remove the src attribute
    // and then load again. When we destroy media source engine, this will be
    // done for us, but for src=, we need to do it here.
    // DrmEngine requires this to be done before we destroy DrmEngine itself.
    if (has.mediaElement && has.mediaElement.src) {
      // TODO: Investigate this more.  Only reproduces on Firefox 69.
      // Introduce a delay before detaching the video source.  We are seeing
      // spurious Promise rejections involving an AbortError in our tests
      // otherwise.
      await new Promise((resolve) => (new Timer(resolve)).tickAfter(0.1));
      has.mediaElement.removeAttribute('src');
      has.mediaElement.load();

      // Remove all track nodes
      while (has.mediaElement.lastChild) {
        has.mediaElement.removeChild(has.mediaElement.firstChild);
      }
    }
    if (this.drmEngine_) {
      await this.drmEngine_.destroy();
      this.drmEngine_ = null;
    }
    this.assetUri_ = null;
    this.bufferObserver_ = null;
    if (this.manifest_) {
      for (const variant of this.manifest_.variants) {
        for (const stream of [variant.audio, variant.video]) {
          if (stream && stream.segmentIndex) {
            stream.segmentIndex.release();
          }
        }
      }
      for (const stream of this.manifest_.textStreams) {
        if (stream.segmentIndex) {
          stream.segmentIndex.release();
        }
      }
    }
    this.manifest_ = null;
    this.stats_ = new Stats();

    // Replace with a clean stats object.
    this.lastTextFactory_ = null;

    // Make sure that the app knows of the new buffering state.
    this.updateBufferState_();
  }

  /**
   * This should only be called by the load graph when it is time to initialize
   * media source engine. The only time this may be called is when we are
   * attached to the same media element as in the request.
   *
   * This method assumes that it is safe for it to execute. The load-graph is
   * responsible for ensuring all assumptions are true.
   *
   *
   */
  private async onInitializeMediaSourceEngine_(has: Payload, wants: Payload):
      Promise {
    asserts.assert(
        Platform.supportsMediaSource(),
        'We should not be initializing media source on a platform that does ' +
            'not support media source.');
    asserts.assert(
        has.mediaElement,
        'We should have a media element when initializing media source.');
    asserts.assert(
        has.mediaElement == wants.mediaElement,
        '|has| and |wants| should have the same media element when ' +
            'initializing media source.');
    asserts.assert(
        this.mediaSourceEngine_ == null,
        'We should not have a media source engine yet.');
    const closedCaptionsParser = new ClosedCaptionParser();

    // When changing text visibility we need to update both the text displayer
    // and streaming engine because we don't always stream text. To ensure that
    // text displayer and streaming engine are always in sync, wait until they
    // are both initialized before setting the initial value.
    const textDisplayerFactory = this.config_.textDisplayFactory;
    const textDisplayer = textDisplayerFactory();
    this.lastTextFactory_ = textDisplayerFactory;
    const mediaSourceEngine = this.createMediaSourceEngine(
        has.mediaElement, closedCaptionsParser, textDisplayer,
        (metadata, offset, endTime) => {
          this.processTimedMetadataMediaSrc_(metadata, offset, endTime);
        });
    const {segmentRelativeVttTiming} = this.config_.manifest;
    mediaSourceEngine.setSegmentRelativeVttTiming(segmentRelativeVttTiming);

    // Wait for media source engine to finish opening. This promise should
    // NEVER be rejected as per the media source engine implementation.
    await mediaSourceEngine.open();

    // Wait until it is ready to actually store the reference.
    this.mediaSourceEngine_ = mediaSourceEngine;
  }

  /**
   * Create the parser for the asset located at |wants.uri|. This should only be
   * called as part of the load graph.
   *
   * This method assumes that it is safe for it to execute, the load-graph is
   * responsible for ensuring all assumptions are true.
   *
   */
  private async onInitializeParser_(has: Payload, wants: Payload): Promise {
    asserts.assert(
        has.mediaElement,
        'We should have a media element when initializing the parser.');
    asserts.assert(
        has.mediaElement == wants.mediaElement,
        '|has| and |wants| should have the same media element when ' +
            'initializing the parser.');
    asserts.assert(
        this.networkingEngine_,
        'Need networking engine when initializing the parser.');
    asserts.assert(
        this.config_, 'Need player config when initializing the parser.');

    // We are going to "lock-in" the mime type and uri since they are
    // what we are going to use to create our parser and parse the manifest.
    has.mimeType = wants.mimeType;
    has.uri = wants.uri;
    asserts.assert(
        has.uri, 'We should have an asset uri when initializing the parsing.');

    // Store references to things we asserted so that we don't need to reassert
    // them again later.
    const assetUri = has.uri;
    const networkingEngine = this.networkingEngine_;

    // Save the uri so that it can be used outside of the load-graph.
    this.assetUri_ = assetUri;

    // Create the parser that we will use to parse the manifest.
    this.parserFactory_ = await ManifestParser.getFactory(
        assetUri, networkingEngine, this.config_.manifest.retryParameters,
        has.mimeType);
    asserts.assert(this.parserFactory_, 'Must have manifest parser');
    this.parser_ = this.parserFactory_();
    const manifestConfig = ObjectUtils.cloneObject(this.config_.manifest);

    // Don't read video segments if the player is attached to an audio element
    if (wants.mediaElement && wants.mediaElement.nodeName === 'AUDIO') {
      manifestConfig.disableVideo = true;
    }
    this.parser_.configure(manifestConfig);
  }

  /**
   * Parse the manifest at |has.uri| using the parser that should have already
   * been created. This should only be called as part of the load graph.
   *
   * This method assumes that it is safe for it to execute, the load-graph is
   * responsible for ensuring all assumptions are true.
   *
   */
  private onParseManifest_(has: Payload, wants: Payload): AbortableOperation {
    asserts.assert(
        has.mimeType == wants.mimeType,
        '|has| and |wants| should have the same mime type when parsing.');
    asserts.assert(
        has.uri == wants.uri,
        '|has| and |wants| should have the same uri when parsing.');
    asserts.assert(has.uri, '|has| should have a valid uri when parsing.');
    asserts.assert(
        has.uri == this.assetUri_,
        '|has.uri| should match the cached asset uri.');
    asserts.assert(
        this.networkingEngine_, 'Need networking engine to parse manifest.');
    asserts.assert(
        this.cmcdManager_,
        'Need CMCD manager to populate manifest request data.');
    asserts.assert(this.config_, 'Need player config to parse manifest.');
    asserts.assert(
        this.parser_,
        '|this.parser_| should have been set in an earlier step.');

    // Store references to things we asserted so that we don't need to reassert
    // them again later.
    const assetUri = has.uri;
    const networkingEngine = this.networkingEngine_;

    // This will be needed by the parser once it starts parsing, so we will
    // initialize it now even through it appears a little out-of-place.
    this.regionTimeline_ = new RegionTimeline(() => this.seekRange());
    this.regionTimeline_.addEventListener('regionadd', (event) => {
      const region: shaka.extern.TimelineRegionInfo = event['region'];
      this.onRegionEvent_(
          FakeEventExports.EventName.TimelineRegionAdded, region);
      if (this.adManager_) {
        this.adManager_.onDashTimedMetadata(region);
      }
    });
    this.qualityObserver_ = null;
    if (this.config_.streaming.observeQualityChanges) {
      this.qualityObserver_ = new QualityObserver(() => this.getBufferedInfo());
      this.qualityObserver_.addEventListener('qualitychange', (event) => {
        const mediaQualityInfo: shaka.extern.MediaQualityInfo =
            event['quality'];
        const position: number = event['position'];
        this.onMediaQualityChange_(mediaQualityInfo, position);
      });
    }
    const playerInterface = {
      networkingEngine: networkingEngine,
      modifyManifestRequest: (request, manifestInfo) => {
        this.cmcdManager_.applyManifestData(request, manifestInfo);
      },
      modifySegmentRequest: (request, segmentInfo) => {
        this.cmcdManager_.applySegmentData(request, segmentInfo);
      },
      filter: (manifest) => this.filterManifest_(manifest),
      makeTextStreamsForClosedCaptions: (manifest) => {
        return this.makeTextStreamsForClosedCaptions_(manifest);
      },
      // Called when the parser finds a timeline region. This can be called
      // before we start playback or during playback (live/in-progress
      // manifest).
      onTimelineRegionAdded: (region) => this.regionTimeline_.addRegion(region),
      onEvent: (event) => this.dispatchEvent(event),
      onError: (error) => this.onError_(error),
      isLowLatencyMode: () => this.isLowLatencyMode_(),
      isAutoLowLatencyMode: () => this.isAutoLowLatencyMode_(),
      enableLowLatencyMode: () => {
        this.configure('streaming.lowLatencyMode', true);
      },
      updateDuration: () => {
        if (this.streamingEngine_) {
          this.streamingEngine_.updateDuration();
        }
      }
    };
    const startTime = Date.now() / 1000;
    return new AbortableOperation(
        /* promise= */
        (async () => {
          this.manifest_ = await this.parser_.start(assetUri, playerInterface);

          // This event is fired after the manifest is parsed, but before any
          // filtering takes place.
          const event =
              this.makeEvent_(FakeEventExports.EventName.ManifestParsed);
          this.dispatchEvent(event);

          // We require all manifests to have at least one variant.
          if (this.manifest_.variants.length == 0) {
            throw new Error(
                ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
                ErrorExports.Code.NO_VARIANTS);
          }

          // Make sure that all variants are either: audio-only, video-only, or
          // audio-video.
          Player.filterForAVVariants_(this.manifest_);
          const now = Date.now() / 1000;
          const delta = now - startTime;
          this.stats_.setManifestTime(delta);
        })(),
        /* onAbort= */
        () => {
          log.info('Aborting parser step...');
          return this.parser_.stop();
        });
  }

  /**
   * This should only be called by the load graph when it is time to initialize
   * drmEngine. The only time this may be called is when we are attached a
   * media element and have parsed a manifest.
   *
   * The load-graph is responsible for ensuring all assumptions made by this
   * method are valid before executing it.
   *
   */
  private async onInitializeDrm_(has: Payload, wants: Payload): Promise {
    asserts.assert(
        has.mimeType == wants.mimeType,
        'The load graph should have ensured the mime types matched.');
    asserts.assert(
        has.uri == wants.uri,
        'The load graph should have ensured the uris matched');
    asserts.assert(
        this.networkingEngine_,
        '|onInitializeDrm_| should never be called after |destroy|');
    asserts.assert(
        this.config_,
        '|onInitializeDrm_| should never be called after |destroy|');
    asserts.assert(
        this.manifest_,
        '|this.manifest_| should have been set in an earlier step.');
    asserts.assert(
        has.mediaElement,
        'We should have a media element when initializing the DRM Engine.');
    const startTime = Date.now() / 1000;
    let firstEvent = true;
    this.drmEngine_ = this.createDrmEngine({
      netEngine: this.networkingEngine_,
      onError: (e) => {
        this.onError_(e);
      },
      onKeyStatus: (map) => {
        this.onKeyStatus_(map);
      },
      onExpirationUpdated: (id, expiration) => {
        this.onExpirationUpdated_(id, expiration);
      },
      onEvent: (e) => {
        this.dispatchEvent(e);
        if (e.type == FakeEventExports.EventName.DrmSessionUpdate &&
            firstEvent) {
          firstEvent = false;
          const now = Date.now() / 1000;
          const delta = now - startTime;
          this.stats_.setDrmTime(delta);
        }
      }
    });
    this.drmEngine_.configure(this.config_.drm);
    await this.drmEngine_.initForPlayback(
        this.manifest_.variants, this.manifest_.offlineSessionIds);
    await this.drmEngine_.attach(has.mediaElement);

    // Now that we have drm information, filter the manifest (again) so that we
    // can ensure we only use variants with the selected key system.
    await this.filterManifest_(this.manifest_);
  }

  /**
   * This should only be called by the load graph when it is time to load all
   * playback components needed for playback. The only times this may be called
   * is when we are attached to the same media element as in the request.
   *
   * This method assumes that it is safe for it to execute, the load-graph is
   * responsible for ensuring all assumptions are true.
   *
   * Loading is defined as:
   *  - Attaching all playback-related listeners to the media element
   *  - Initializing playback and observers
   *  - Initializing ABR Manager
   *  - Initializing Streaming Engine
   *  - Starting playback at |wants.startTime|
   *
   */
  private async onLoad_(has: Payload, wants: Payload) {
    asserts.assert(
        has.mimeType == wants.mimeType,
        '|has| and |wants| should have the same mime type when loading.');
    asserts.assert(
        has.uri == wants.uri,
        '|has| and |wants| should have the same uri when loading.');
    asserts.assert(
        has.mediaElement, 'We should have a media element when loading.');
    asserts.assert(
        !isNaN(wants.startTimeOfLoad),
        '|wants| should tell us when the load was originally requested');

    // Since we are about to start playback, we will lock in the start time as
    // something we are now depending on.
    has.startTime = wants.startTime;

    // If updateStartTime() has been called since load() was invoked use the
    // requested startTime
    if (this.updatedStartTime_ != null) {
      has.startTime = this.updatedStartTime_;
      this.updatedStartTime_ = null;
    }

    // Store a reference to values in |has| after asserting so that closure will
    // know that they will still be non-null between calls to await.
    const mediaElement = has.mediaElement;
    const assetUri = has.uri;

    // Save the uri so that it can be used outside of the load-graph.
    this.assetUri_ = assetUri;
    this.playRateController_ = new PlayRateController({
      getRate: () => mediaElement.playbackRate,
      getDefaultRate: () => mediaElement.defaultPlaybackRate,
      setRate: (rate) => {
        mediaElement.playbackRate = rate;
      },
      movePlayhead: (delta) => {
        mediaElement.currentTime += delta;
      }
    });
    const updateStateHistory = () => this.updateStateHistory_();
    const onRateChange = () => this.onRateChange_();
    this.loadEventManager_.listen(mediaElement, 'playing', updateStateHistory);
    this.loadEventManager_.listen(mediaElement, 'pause', updateStateHistory);
    this.loadEventManager_.listen(mediaElement, 'ended', updateStateHistory);
    this.loadEventManager_.listen(mediaElement, 'ratechange', onRateChange);
    const abrFactory = this.config_.abrFactory;
    if (!this.abrManager_ || this.abrManagerFactory_ != abrFactory) {
      this.abrManagerFactory_ = abrFactory;
      this.abrManager_ = abrFactory();
      if (typeof this.abrManager_.setMediaElement != 'function') {
        Deprecate.deprecateFeature(
            5, 'AbrManager',
            'Please use an AbrManager with setMediaElement function.');
        this.abrManager_.setMediaElement = () => {};
      }
      this.abrManager_.configure(this.config_.abr);
    }

    // Copy preferred languages from the config again, in case the config was
    // changed between construction and playback.
    this.currentAdaptationSetCriteria_ = new PreferenceBasedCriteria(
        this.config_.preferredAudioLanguage, this.config_.preferredVariantRole,
        this.config_.preferredAudioChannelCount);
    this.currentTextLanguage_ = this.config_.preferredTextLanguage;
    this.currentTextRole_ = this.config_.preferredTextRole;
    this.currentTextForced_ = this.config_.preferForcedSubs;
    Player.applyPlayRange_(
        this.manifest_.presentationTimeline, this.config_.playRangeStart,
        this.config_.playRangeEnd);
    this.abrManager_.init((variant, clearBuffer, safeMargin) => {
      return this.switch_(variant, clearBuffer, safeMargin);
    });
    this.abrManager_.setMediaElement(mediaElement);
    this.playhead_ = this.createPlayhead(has.startTime);
    this.playheadObservers_ = this.createPlayheadObserversForMSE_();

    // We need to start the buffer management code near the end because it will
    // set the initial buffering state and that depends on other components
    // being initialized.
    const rebufferThreshold = Math.max(
        this.manifest_.minBufferTime, this.config_.streaming.rebufferingGoal);
    this.startBufferManagement_(rebufferThreshold);

    // If the content is multi-codec and the browser can play more than one of
    // them, choose codecs now before we initialize streaming.
    StreamUtils.chooseCodecsAndFilterManifest(
        this.manifest_, this.config_.preferredVideoCodecs,
        this.config_.preferredAudioCodecs,
        this.config_.preferredAudioChannelCount,
        this.config_.preferredDecodingAttributes);
    this.streamingEngine_ = this.createStreamingEngine();
    this.streamingEngine_.configure(this.config_.streaming);

    // Set the load mode to "loaded with media source" as late as possible so
    // that public methods won't try to access internal components until
    // they're all initialized. We MUST switch to loaded before calling
    // "streaming" so that they can access internal information.
    this.loadMode_ = LoadMode.MEDIA_SOURCE;
    if (mediaElement.textTracks) {
      this.loadEventManager_.listen(
          mediaElement.textTracks, 'addtrack', (e) => {
            const trackEvent = (e as TrackEvent);
            if (trackEvent.track) {
              const track = trackEvent.track;
              asserts.assert(track instanceof TextTrack, 'Wrong track type!');
              switch (track.kind) {
                case 'chapters':
                  this.activateChaptersTrack_(track);
                  break;
              }
            }
          });
    }

    // The event must be fired after we filter by restrictions but before the
    // active stream is picked to allow those listening for the "streaming"
    // event to make changes before streaming starts.
    this.dispatchEvent(this.makeEvent_(FakeEventExports.EventName.Streaming));

    // Pick the initial streams to play.
    // however, we would skip switch to initial variant
    // if user already pick variant track (via selectVariantTrack api)
    let initialVariant = null;
    const activeVariantTrack = this.getVariantTracks().find((t) => t.active);
    if (!activeVariantTrack) {
      initialVariant = this.chooseVariant_();
      asserts.assert(initialVariant, 'Must choose an initial variant!');
      this.switchVariant_(
          initialVariant,
          /* fromAdaptation= */
          true,
          /* clearBuffer= */
          false,
          /* safeMargin= */
          0);

      // Now that we have initial streams, we may adjust the start time to align
      // to a segment boundary.
      if (this.config_.streaming.startAtSegmentBoundary) {
        const startTime = this.playhead_.getTime();
        const adjustedTime =
            await this.adjustStartTime_(initialVariant, startTime);
        this.playhead_.setStartTime(adjustedTime);
      }

      // Since the first streams just became active, send an adaptation event.
      this.onAdaptation_(null, StreamUtils.variantToTrack(initialVariant));
    }

    // Decide if text should be shown automatically.
    // similar to video/audio track, we would skip switch initial text track
    // if user already pick text track (via selectTextTrack api)
    const activeTextTrack = this.getTextTracks().find((t) => t.active);
    if (!activeTextTrack) {
      const initialTextStream = this.chooseTextStream_();
      if (initialTextStream) {
        this.addTextStreamToSwitchHistory_(
            initialTextStream,
            /* fromAdaptation= */
            true);
      }
      if (initialVariant) {
        this.setInitialTextState_(initialVariant, initialTextStream);
      }

      // Don't initialize with a text stream unless we should be streaming text.
      if (initialTextStream && this.shouldStreamText_()) {
        this.streamingEngine_.switchTextStream(initialTextStream);
      }
    }

    // Start streaming content. This will start the flow of content down to
    // media source.
    await this.streamingEngine_.start();
    if (this.config_.abr.enabled) {
      this.abrManager_.enable();
      this.onAbrStatusChanged_();
    }

    // Re-filter the manifest after streams have been chosen.
    this.filterManifestByCurrentVariant_();

    // Dispatch a 'trackschanged' event now that all initial filtering is done.
    this.onTracksChanged_();

    // Now that we've filtered out variants that aren't compatible with the
    // active one, update abr manager with filtered variants.
    // NOTE: This may be unnecessary.  We've already chosen one codec in
    // chooseCodecsAndFilterManifest_ before we started streaming.  But it
    // doesn't hurt, and this will all change when we start using
    // MediaCapabilities and codec switching.
    // TODO(#1391): Re-evaluate with MediaCapabilities and codec switching.
    this.updateAbrManagerVariants_();
    const hasPrimary = this.manifest_.variants.some((v) => v.primary);
    if (!this.config_.preferredAudioLanguage && !hasPrimary) {
      log.warning(
          'No preferred audio language set.  We have chosen an ' +
          'arbitrary language initially');
    }

    // Wait for the 'loadedmetadata' event to measure load() latency.
    this.loadEventManager_.listenOnce(mediaElement, 'loadedmetadata', () => {
      const now = Date.now() / 1000;
      const delta = now - wants.startTimeOfLoad;
      this.stats_.setLoadLatency(delta);
    });
  }

  /**
   * This should only be called by the load graph when it is time to initialize
   * drmEngine for src= playbacks.
   *
   * The load-graph is responsible for ensuring all assumptions made by this
   * method are valid before executing it.
   *
   */
  private async onInitializeSrcEqualsDrm_(has: Payload, wants: Payload):
      Promise {
    const ContentType = ManifestParserUtilsExports.ContentType;
    asserts.assert(
        this.networkingEngine_,
        '|onInitializeSrcEqualsDrm_| should never be called after |destroy|');
    asserts.assert(
        this.config_,
        '|onInitializeSrcEqualsDrm_| should never be called after |destroy|');
    const startTime = Date.now() / 1000;
    let firstEvent = true;
    this.drmEngine_ = this.createDrmEngine({
      netEngine: this.networkingEngine_,
      onError: (e) => {
        this.onError_(e);
      },
      onKeyStatus: (map) => {
        this.onKeyStatus_(map);
      },
      onExpirationUpdated: (id, expiration) => {
        this.onExpirationUpdated_(id, expiration);
      },
      onEvent: (e) => {
        this.dispatchEvent(e);
        if (e.type == FakeEventExports.EventName.DrmSessionUpdate &&
            firstEvent) {
          firstEvent = false;
          const now = Date.now() / 1000;
          const delta = now - startTime;
          this.stats_.setDrmTime(delta);
        }
      }
    });
    this.drmEngine_.configure(this.config_.drm);
    const uri = wants.uri || '';
    const extension = ManifestParser.getExtension(uri);
    let mimeType = SRC_EQUAL_EXTENSIONS_TO_MIME_TYPES_[extension];
    if (mimeType == 'application/x-mpegurl' && Platform.isApple()) {
      mimeType = 'application/vnd.apple.mpegurl';
    }
    if (!mimeType) {
      mimeType = 'video/mp4';
    }

    // TODO: Instead of feeding DrmEngine with Variants, we should refactor
    // DrmEngine so that it takes a minimal config derived from Variants.  In
    // cases like this one or in removal of stored content, the details are
    // largely unimportant.  We should have a saner way to initialize DrmEngine.
    // That would also insulate DrmEngine from manifest changes in the future.
    // For now, that is time-consuming and this synthetic Variant is easy, so
    // I'm putting it off.  Since this is only expected to be used for native
    // HLS in Safari, this should be safe. -JCP
    const variant: shaka.extern.Variant = {
      id: 0,
      language: 'und',
      disabledUntilTime: 0,
      primary: false,
      audio: null,
      video: {
        id: 0,
        originalId: null,
        createSegmentIndex: () => Promise.resolve(),
        segmentIndex: null,
        mimeType: wants.mimeType ? MimeUtils.getBasicType(wants.mimeType) :
                                   mimeType,
        codecs: wants.mimeType ? MimeUtils.getCodecs(wants.mimeType) : '',
        encrypted: true,
        drmInfos: [],
        // Filled in by DrmEngine config.
        keyIds: new Set(),
        language: 'und',
        label: null,
        type: ContentType.VIDEO,
        primary: false,
        trickModeVideo: null,
        emsgSchemeIdUris: null,
        roles: [],
        forced: false,
        channelsCount: null,
        audioSamplingRate: null,
        spatialAudio: false,
        closedCaptions: null
      },
      bandwidth: 100,
      allowedByApplication: true,
      allowedByKeySystem: true,
      decodingInfos: []
    };
    this.drmEngine_.setSrcEquals(
        /* srcEquals= */
        true);
    await this.drmEngine_.initForPlayback(
        [variant],
        /* offlineSessionIds= */
        []);
    await this.drmEngine_.attach(has.mediaElement);
  }

  /**
   * This should only be called by the load graph when it is time to set-up the
   * media element to play content using src=. The only times this may be called
   * is when we are attached to the same media element as in the request.
   *
   * This method assumes that it is safe for it to execute, the load-graph is
   * responsible for ensuring all assumptions are true.
   *
   *
   */
  private onSrcEquals_(has: Payload, wants: Payload): AbortableOperation {
    asserts.assert(
        has.mediaElement, 'We should have a media element when loading.');
    asserts.assert(wants.uri, '|has| should have a valid uri when loading.');
    asserts.assert(
        !isNaN(wants.startTimeOfLoad),
        '|wants| should tell us when the load was originally requested');
    asserts.assert(
        this.video_ == has.mediaElement,
        'The video element should match our media element');

    // Lock-in the values that we are using so that the routing logic knows what
    // we have.
    has.uri = wants.uri;
    has.startTime = wants.startTime;

    // Save the uri so that it can be used outside of the load-graph.
    this.assetUri_ = has.uri;
    const mediaElement = has.mediaElement;
    this.playhead_ = new SrcEqualsPlayhead(mediaElement);

    // This flag is used below in the language preference setup to check if
    // this load was canceled before the necessary awaits completed.
    let unloaded = false;
    this.cleanupOnUnload_.push(() => {
      unloaded = true;
    });
    if (has.startTime != null) {
      this.playhead_.setStartTime(has.startTime);
    }
    this.playRateController_ = new PlayRateController({
      getRate: () => mediaElement.playbackRate,
      getDefaultRate: () => mediaElement.defaultPlaybackRate,
      setRate: (rate) => {
        mediaElement.playbackRate = rate;
      },
      movePlayhead: (delta) => {
        mediaElement.currentTime += delta;
      }
    });

    // We need to start the buffer management code near the end because it will
    // set the initial buffering state and that depends on other components
    // being initialized.
    const rebufferThreshold = this.config_.streaming.rebufferingGoal;
    this.startBufferManagement_(rebufferThreshold);

    // Add all media element listeners.
    const updateStateHistory = () => this.updateStateHistory_();
    const onRateChange = () => this.onRateChange_();
    this.loadEventManager_.listen(mediaElement, 'playing', updateStateHistory);
    this.loadEventManager_.listen(mediaElement, 'pause', updateStateHistory);
    this.loadEventManager_.listen(mediaElement, 'ended', updateStateHistory);
    this.loadEventManager_.listen(mediaElement, 'ratechange', onRateChange);

    // Wait for the 'loadedmetadata' event to measure load() latency, but only
    // if preload is set in a way that would result in this event firing
    // automatically.
    // See https://github.com/shaka-project/shaka-player/issues/2483
    if (mediaElement.preload != 'none') {
      this.loadEventManager_.listenOnce(mediaElement, 'loadedmetadata', () => {
        const now = Date.now() / 1000;
        const delta = now - wants.startTimeOfLoad;
        this.stats_.setLoadLatency(delta);
      });
    }

    // The audio tracks are only available on Safari at the moment, but this
    // drives the tracks API for Safari's native HLS. So when they change,
    // fire the corresponding Shaka Player event.
    if (mediaElement.audioTracks) {
      this.loadEventManager_.listen(
          mediaElement.audioTracks, 'addtrack', () => this.onTracksChanged_());
      this.loadEventManager_.listen(
          mediaElement.audioTracks, 'removetrack',
          () => this.onTracksChanged_());
      this.loadEventManager_.listen(
          mediaElement.audioTracks, 'change', () => this.onTracksChanged_());
    }
    if (mediaElement.textTracks) {
      this.loadEventManager_.listen(
          mediaElement.textTracks, 'addtrack', (e) => {
            const trackEvent = (e as TrackEvent);
            if (trackEvent.track) {
              const track = trackEvent.track;
              asserts.assert(track instanceof TextTrack, 'Wrong track type!');
              switch (track.kind) {
                case 'metadata':
                  this.processTimedMetadataSrcEqls_(track);
                  break;
                case 'chapters':
                  this.activateChaptersTrack_(track);
                  break;
                default:
                  this.onTracksChanged_();
                  break;
              }
            }
          });
      this.loadEventManager_.listen(
          mediaElement.textTracks, 'removetrack',
          () => this.onTracksChanged_());
      this.loadEventManager_.listen(
          mediaElement.textTracks, 'change', () => this.onTracksChanged_());
    }
    const extension = ManifestParser.getExtension(has.uri);
    const mimeType = SRC_EQUAL_EXTENSIONS_TO_MIME_TYPES_[extension];

    // By setting |src| we are done "loading" with src=. We don't need to set
    // the current time because |playhead| will do that for us.
    mediaElement.src = this.cmcdManager_.appendSrcData(has.uri, mimeType);

    // Tizen 3 / WebOS won't load anything unless you call load() explicitly,
    // no matter the value of the preload attribute.  This is harmful on some
    // other platforms by triggering unbounded loading of media data, but is
    // necessary here.
    if (Platform.isTizen() || Platform.isWebOS()) {
      mediaElement.load();
    }

    // Set the load mode last so that we know that all our components are
    // initialized.
    this.loadMode_ = LoadMode.SRC_EQUALS;

    // The event doesn't mean as much for src= playback, since we don't control
    // streaming.  But we should fire it in this path anyway since some
    // applications may be expecting it as a life-cycle event.
    this.dispatchEvent(this.makeEvent_(FakeEventExports.EventName.Streaming));

    // The "load" Promise is resolved when we have loaded the metadata.  If we
    // wait for the full data, that won't happen on Safari until the play button
    // is hit.
    const fullyLoaded = new PublicPromise();
    MediaReadyState.waitForReadyState(
        mediaElement, HTMLMediaElement.HAVE_METADATA, this.loadEventManager_,
        () => {
          fullyLoaded.resolve();
        });

    // We can't switch to preferred languages, though, until the data is loaded.
    MediaReadyState.waitForReadyState(
        mediaElement, HTMLMediaElement.HAVE_CURRENT_DATA,
        this.loadEventManager_, async () => {
          this.setupPreferredAudioOnSrc_();

          // Applying the text preference too soon can result in it being
          // reverted.  Wait for native HLS to pick something first.
          const textTracks = this.getFilteredTextTracks_();
          if (!textTracks.find((t) => t.mode != 'disabled')) {
            await new Promise((resolve) => {
              this.loadEventManager_.listenOnce(
                  mediaElement.textTracks, 'change', resolve);

              // We expect the event to fire because it does on Safari.
              // But in case it doesn't on some other platform or future
              // version, move on in 1 second no matter what.  This keeps the
              // language settings from being completely ignored if something
              // goes wrong.
              (new Timer(resolve)).tickAfter(1);
            });
          }

          // If we have moved on to another piece of content while waiting for
          // the above event/timer, we should not change tracks here.
          if (unloaded) {
            return;
          }
          this.setupPreferredTextOnSrc_();
        });
    if (mediaElement.error) {
      // Already failed!
      fullyLoaded.reject(this.videoErrorToShakaError_());
    } else {
      if (mediaElement.preload == 'none') {
        log.alwaysWarn(
            'With <video preload="none">, the browser will not load anything ' +
            'until play() is called. We are unable to measure load latency in ' +
            'a meaningful way, and we cannot provide track info yet. Please do ' +
            'not use preload="none" with Shaka Player.');

        // We can't wait for an event load loadedmetadata, since that will be
        // blocked until a user interaction.  So resolve the Promise now.
        fullyLoaded.resolve();
      }
    }
    this.loadEventManager_.listenOnce(mediaElement, 'error', () => {
      fullyLoaded.reject(this.videoErrorToShakaError_());
    });
    return new AbortableOperation(
        fullyLoaded,
        /* onAbort= */
        () => {
          const abortedError = new Error(
              ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
              ErrorExports.Code.OPERATION_ABORTED);
          fullyLoaded.reject(abortedError);
          return
              // Abort complete.
              Promise.resolve();
        });
  }

  /**
   * This method setup the preferred audio using src=..
   *
   */
  private setupPreferredAudioOnSrc_() {
    const preferredAudioLanguage = this.config_.preferredAudioLanguage;

    // If the user has not selected a preference, the browser preference is
    // left.
    if (preferredAudioLanguage == '') {
      return;
    }
    this.selectAudioLanguage(preferredAudioLanguage);
    const preferredVariantRole = this.config_.preferredVariantRole;

    // If the user has not selected a role preference, the previous match is
    // selected.
    if (preferredVariantRole == '') {
      return;
    }
    this.selectAudioLanguage(preferredAudioLanguage, preferredVariantRole);
  }

  /**
   * This method setup the preferred text using src=.
   *
   */
  private setupPreferredTextOnSrc_() {
    const preferredTextLanguage = this.config_.preferredTextLanguage;
    const preferForcedSubs = this.config_.preferForcedSubs;

    // If the user has not selected a preference, the browser preference is
    // left.
    if (preferredTextLanguage == '') {
      return;
    }
    this.selectTextLanguage(preferredTextLanguage, '', preferForcedSubs);
    const preferredTextRole = this.config_.preferredTextRole;

    // If the user has not selected a role preference, the previous match is
    // selected.
    if (preferredTextRole == '') {
      return;
    }
    this.selectTextLanguage(
        preferredTextLanguage, preferredTextRole, preferForcedSubs);
  }

  /**
   * We're looking for metadata tracks to process id3 tags. One of the uses is
   * for ad info on LIVE streams
   *
   */
  private processTimedMetadataSrcEqls_(track: TextTrack) {
    if (track.kind != 'metadata') {
      return;
    }

    // Hidden mode is required for the cuechange event to launch correctly
    track.mode = 'hidden';
    this.loadEventManager_.listen(track, 'cuechange', () => {
      if (!track.activeCues) {
        return;
      }
      for (const cue of track.activeCues) {
        this.dispatchMetadataEvent_(
            cue.startTime, cue.endTime, cue.type, cue.value);
        if (this.adManager_) {
          this.adManager_.onCueMetadataChange(cue.value);
        }
      }
    });

    // In Safari the initial assignment does not always work, so we schedule
    // this process to be repeated several times to ensure that it has been put
    // in the correct mode.
    const timer = (new Timer(() => {
                    const textTracks = this.getMetadataTracks_();
                    for (const textTrack of textTracks) {
                      textTrack.mode = 'hidden';
                    }
                  }))
                      .tickNow()
                      .tickAfter(0.5);
    this.cleanupOnUnload_.push(() => {
      timer.stop();
    });
  }

  private processTimedMetadataMediaSrc_(
      metadata: shaka.extern.ID3Metadata[], offset: number,
      segmentEndTime: number|null) {
    for (const sample of metadata) {
      if (sample['data'] && sample['cueTime'] && sample['frames']) {
        const start = sample['cueTime'] + offset;
        const end = segmentEndTime;
        const metadataType = 'ID3';
        for (const frame of sample['frames']) {
          const payload = frame;
          this.dispatchMetadataEvent_(start, end, metadataType, payload);
        }
        if (this.adManager_) {
          this.adManager_.onHlsTimedMetadata(sample, start);
        }
      }
    }
  }

  /**
   * Construct and fire a Player.Metadata event
   *
   */
  private dispatchMetadataEvent_(
      startTime: number, endTime: number|null, metadataType: string,
      payload: shaka.extern.ID3Metadata) {
    asserts.assert(
        !endTime || startTime <= endTime,
        'Metadata start time should be less or equal to the end time!');
    const eventName = FakeEventExports.EventName.Metadata;
    const data = (new Map())
                     .set('startTime', startTime)
                     .set('endTime', endTime)
                     .set('metadataType', metadataType)
                     .set('payload', payload);
    this.dispatchEvent(this.makeEvent_(eventName, data));
  }

  /**
   * Set the mode on a chapters track so that it loads.
   *
   */
  private activateChaptersTrack_(track: TextTrack|null) {
    if (!track || track.kind != 'chapters') {
      return;
    }

    // Hidden mode is required for the cuechange event to launch correctly and
    // get the cues and the activeCues
    track.mode = 'hidden';

    // In Safari the initial assignment does not always work, so we schedule
    // this process to be repeated several times to ensure that it has been put
    // in the correct mode.
    const timer = (new Timer(() => {
                    track.mode = 'hidden';
                  }))
                      .tickNow()
                      .tickAfter(0.5);
    this.cleanupOnUnload_.push(() => {
      timer.stop();
    });
  }

  /**
   * Take a series of variants and ensure that they only contain one type of
   * variant. The different options are:
   *  1. Audio-Video
   *  2. Audio-Only
   *  3. Video-Only
   *
   * A manifest can only contain a single type because once we initialize media
   * source to expect specific streams, it must always have content for those
   * streams. If we were to start with audio+video and switch to an audio-only
   * variant, media source would block waiting for video content.
   *
   */
  private static filterForAVVariants_(manifest: shaka.extern.Manifest) {
    const isAVVariant = (variant) => {
      // Audio-video variants may include both streams separately or may be
      // single multiplexed streams with multiple codecs.
      return variant.video && variant.audio ||
          variant.video && variant.video.codecs.includes(',');
    };
    if (manifest.variants.some(isAVVariant)) {
      log.debug(
          'Found variant with audio and video content, ' +
          'so filtering out audio-only content.');
      manifest.variants = manifest.variants.filter(isAVVariant);
    }
  }

  /**
   * Create a new DrmEngine instance. This may be replaced by tests to create
   * fake instances. Configuration and initialization will be handled after
   * |createDrmEngine|.
   *
   */
  createDrmEngine(playerInterface: DrmEngineExports.PlayerInterface):
      DrmEngine {
    const updateExpirationTime = this.config_.drm.updateExpirationTime;
    return new DrmEngine(playerInterface, updateExpirationTime);
  }

  /**
   * Creates a new instance of NetworkingEngine.  This can be replaced by tests
   * to create fake instances instead.
   *
   */
  createNetworkingEngine(): NetworkingEngine {
    const onProgressUpdated_: (p1: number, p2: number) => any =
        (deltaTimeMs, bytesDownloaded) => {
          // In some situations, such as during offline storage, the abr manager
          // might not yet exist. Therefore, we need to check if abr manager has
          // been initialized before using it.
          if (this.abrManager_) {
            this.abrManager_.segmentDownloaded(deltaTimeMs, bytesDownloaded);
          }
        };
    const onHeadersReceived_: NetworkingEngineExports.OnHeadersReceived =
        (headers, request, requestType) => {
          // Release a 'downloadheadersreceived' event.
          const name = FakeEventExports.EventName.DownloadHeadersReceived;
          const data = (new Map())
                           .set('headers', headers)
                           .set('request', request)
                           .set('requestType', requestType);
          this.dispatchEvent(this.makeEvent_(name, data));
        };
    const onDownloadFailed_: NetworkingEngineExports.OnDownloadFailed =
        (request, error, httpResponseCode, aborted) => {
          // Release a 'downloadfailed' event.
          const name = FakeEventExports.EventName.DownloadFailed;
          const data = (new Map())
                           .set('request', request)
                           .set('error', error)
                           .set('httpResponseCode', httpResponseCode)
                           .set('aborted', aborted);
          this.dispatchEvent(this.makeEvent_(name, data));
        };
    return new NetworkingEngine(
        onProgressUpdated_, onHeadersReceived_, onDownloadFailed_);
  }

  /**
   * Creates a new instance of Playhead.  This can be replaced by tests to
   * create fake instances instead.
   *
   */
  createPlayhead(startTime: number|null): Playhead {
    asserts.assert(this.manifest_, 'Must have manifest');
    asserts.assert(this.video_, 'Must have video');
    return new MediaSourcePlayhead(
        this.video_, this.manifest_, this.config_.streaming, startTime,
        () => this.onSeek_(), (event) => this.dispatchEvent(event));
  }

  /**
   * Create the observers for MSE playback. These observers are responsible for
   * notifying the app and player of specific events during MSE playback.
   *
   */
  private createPlayheadObserversForMSE_(): PlayheadObserverManager {
    asserts.assert(this.manifest_, 'Must have manifest');
    asserts.assert(this.regionTimeline_, 'Must have region timeline');
    asserts.assert(this.video_, 'Must have video element');

    // Create the region observer. This will allow us to notify the app when we
    // move in and out of timeline regions.
    const regionObserver = new RegionObserver(this.regionTimeline_);
    regionObserver.addEventListener('enter', (event) => {
      const region: shaka.extern.TimelineRegionInfo = event['region'];
      this.onRegionEvent_(
          FakeEventExports.EventName.TimelineRegionEnter, region);
    });
    regionObserver.addEventListener('exit', (event) => {
      const region: shaka.extern.TimelineRegionInfo = event['region'];
      this.onRegionEvent_(
          FakeEventExports.EventName.TimelineRegionExit, region);
    });
    regionObserver.addEventListener('skip', (event) => {
      const region: shaka.extern.TimelineRegionInfo = event['region'];
      const seeking: boolean = event['seeking'];

      // If we are seeking, we don't want to surface the enter/exit events since
      // they didn't play through them.
      if (!seeking) {
        this.onRegionEvent_(
            FakeEventExports.EventName.TimelineRegionEnter, region);
        this.onRegionEvent_(
            FakeEventExports.EventName.TimelineRegionExit, region);
      }
    });

    // Now that we have all our observers, create a manager for them.
    const manager = new PlayheadObserverManager(this.video_);
    manager.manage(regionObserver);
    if (this.qualityObserver_) {
      manager.manage(this.qualityObserver_);
    }
    return manager;
  }

  /**
   * Initialize and start the buffering system (observer and timer) so that we
   * can monitor our buffer lead during playback.
   *
   */
  private startBufferManagement_(rebufferingGoal: number) {
    asserts.assert(
        !this.bufferObserver_,
        'No buffering observer should exist before initialization.');
    asserts.assert(
        !this.bufferPoller_,
        'No buffer timer should exist before initialization.');

    // Give dummy values, will be updated below.
    this.bufferObserver_ = new BufferingObserver(1, 2);

    // Force us back to a buffering state. This ensure everything is starting in
    // the same state.
    this.bufferObserver_.setState(BufferingObserverExports.State.STARVING);
    this.updateBufferingSettings_(rebufferingGoal);
    this.updateBufferState_();

    // TODO: We should take some time to look into the effects of our
    //       quarter-second refresh practice. We often use a quarter-second
    //       but we have no documentation about why.
    this.bufferPoller_ = (new Timer(() => {
                           this.pollBufferState_();
                         }))
                             .tickEvery(
                                 /* seconds= */
                                 0.25);
  }

  /**
   * Updates the buffering thresholds based on the new rebuffering goal.
   *
   */
  private updateBufferingSettings_(rebufferingGoal: number) {
    // The threshold to transition back to satisfied when starving.
    const starvingThreshold = rebufferingGoal;

    // The threshold to transition into starving when satisfied.
    // We use a "typical" threshold, unless the rebufferingGoal is unusually
    // low.
    // Then we force the value down to half the rebufferingGoal, since
    // starvingThreshold must be strictly larger than satisfiedThreshold for the
    // logic in BufferingObserver to work correctly.
    const satisfiedThreshold =
        Math.min(TYPICAL_BUFFERING_THRESHOLD_, rebufferingGoal / 2);
    this.bufferObserver_.setThresholds(starvingThreshold, satisfiedThreshold);
  }

  /**
   * This method is called periodically to check what the buffering observer
   * says so that we can update the rest of the buffering behaviours.
   *
   */
  private pollBufferState_() {
    asserts.assert(
        this.video_, 'Need a media element to update the buffering observer');
    asserts.assert(this.bufferObserver_, 'Need a buffering observer to update');
    let bufferedToEnd;
    switch (this.loadMode_) {
      case LoadMode.SRC_EQUALS:
        bufferedToEnd = this.isBufferedToEndSrc_();
        break;
      case LoadMode.MEDIA_SOURCE:
        bufferedToEnd = this.isBufferedToEndMS_();
        break;
      default:
        bufferedToEnd = false;
        break;
    }
    const bufferLead = TimeRangesUtils.bufferedAheadOf(
        this.video_.buffered, this.video_.currentTime);
    const stateChanged = this.bufferObserver_.update(bufferLead, bufferedToEnd);

    // If the state changed, we need to surface the event.
    if (stateChanged) {
      this.updateBufferState_();
    }
  }

  /**
   * Create a new media source engine. This will ONLY be replaced by tests as a
   * way to inject fake media source engine instances.
   *
   * @param
   *  onMetadata
   *
   */
  createMediaSourceEngine(
      mediaElement: HTMLMediaElement,
      closedCaptionsParser: IClosedCaptionParser,
      textDisplayer: shaka.extern.TextDisplayer,
      onMetadata:
          (p1: shaka.extern.ID3Metadata[], p2: number, p3: number|null) => any):
      MediaSourceEngine {
    return new MediaSourceEngine(
        mediaElement, closedCaptionsParser, textDisplayer, onMetadata);
  }

  /**
   * Create a new CMCD manager.
   *
   */
  private createCmcd_() {
    const playerInterface: CmcdManagerExports.PlayerInterface = {
      getBandwidthEstimate: () =>
          this.abrManager_ ? this.abrManager_.getBandwidthEstimate() : NaN,
      getBufferedInfo: () => this.getBufferedInfo(),
      getCurrentTime: () => this.video_ ? this.video_.currentTime : 0,
      getVariantTracks: () => this.getVariantTracks(),
      getPlaybackRate: () => this.getPlaybackRate(),
      isLive: () => this.isLive()
    };
    return new CmcdManager(playerInterface, this.config_.cmcd);
  }

  /**
   * Creates a new instance of StreamingEngine.  This can be replaced by tests
   * to create fake instances instead.
   *
   */
  createStreamingEngine(): StreamingEngine {
    asserts.assert(
        this.playhead_ && this.abrManager_ && this.mediaSourceEngine_ &&
            this.cmcdManager_ && this.manifest_,
        'Must not be destroyed');
    const playerInterface: StreamingEngineExports.PlayerInterface = {
      getPresentationTime: () => this.playhead_.getTime(),
      getBandwidthEstimate: () => this.abrManager_.getBandwidthEstimate(),
      modifySegmentRequest: (request, segmentInfo) => {
        this.cmcdManager_.applySegmentData(request, segmentInfo);
      },
      mediaSourceEngine: this.mediaSourceEngine_,
      netEngine: this.networkingEngine_,
      onError: (error) => this.onError_(error),
      onEvent: (event) => this.dispatchEvent(event),
      onManifestUpdate: () => this.onManifestUpdate_(),
      onSegmentAppended: (start, end, contentType) => {
        this.onSegmentAppended_(start, end, contentType);
      },
      onInitSegmentAppended: (position, initSegment) => {
        const mediaQuality = initSegment.getMediaQuality();
        if (mediaQuality && this.qualityObserver_) {
          this.qualityObserver_.addMediaQualityChange(mediaQuality, position);
        }
      }
    };
    return new StreamingEngine(this.manifest_, playerInterface);
  }

  /**
   * Changes configuration settings on the Player.  This checks the names of
   * keys and the types of values to avoid coding errors.  If there are errors,
   * this logs them to the console and returns false.  Correct fields are still
   * applied even if there are other errors.  You can pass an explicit
   * <code>undefined</code> value to restore the default value.  This has two
   * modes of operation:
   *
   * <p>
   * First, this can be passed a single "plain" object.  This object should
   * follow the {@link shaka.extern.PlayerConfiguration} object.  Not all fields
   * need to be set; unset fields retain their old values.
   *
   * <p>
   * Second, this can be passed two arguments.  The first is the name of the key
   * to set.  This should be a '.' separated path to the key.  For example,
   * <code>'streaming.alwaysStreamText'</code>.  The second argument is the
   * value to set.
   *
   * @param config This should either be a field name or an
   *   object.
   * @param value In the second mode, this is the value to set.
   * @return True if the passed config object was valid, false if
   *   there were invalid entries.
   * @export
   */
  configure(config: string|Object, value?: any): boolean {
    asserts.assert(this.config_, 'Config must not be null!');
    asserts.assert(
        typeof config == 'object' || arguments.length == 2,
        'String configs should have values!');

    // ('fieldName', value) format
    if (arguments.length == 2 && typeof config == 'string') {
      config = ConfigUtils.convertToConfigObject(config, value);
    }
    asserts.assert(typeof config == 'object', 'Should be an object!');

    // If lowLatencyMode is enabled, and inaccurateManifestTolerance and
    // rebufferingGoal are not specified, set inaccurateManifestTolerance to 0
    // and rebufferingGoal to 0.01 by default for low latency streaming.
    if (config['streaming'] && config['streaming']['lowLatencyMode']) {
      if (config['streaming']['inaccurateManifestTolerance'] == undefined) {
        config['streaming']['inaccurateManifestTolerance'] = 0;
      }
      if (config['streaming']['rebufferingGoal'] == undefined) {
        config['streaming']['rebufferingGoal'] = 0.01;
      }
    }
    const ret = PlayerConfiguration.mergeConfigObjects(
        this.config_, config, this.defaultConfig_());
    this.applyConfig_();
    return ret;
  }

  /**
   * Apply config changes.
   */
  private applyConfig_() {
    if (this.parser_) {
      const manifestConfig = ObjectUtils.cloneObject(this.config_.manifest);

      // Don't read video segments if the player is attached to an audio element
      if (this.video_ && this.video_.nodeName === 'AUDIO') {
        manifestConfig.disableVideo = true;
      }
      this.parser_.configure(manifestConfig);
    }
    if (this.drmEngine_) {
      this.drmEngine_.configure(this.config_.drm);
    }
    if (this.streamingEngine_) {
      this.streamingEngine_.configure(this.config_.streaming);

      // Need to apply the restrictions.
      try {
        // this.filterManifestWithRestrictions_() may throw.
        this.filterManifestWithRestrictions_(this.manifest_);
      } catch (error) {
        this.onError_(error);
      }
      if (this.abrManager_) {
        // Update AbrManager variants to match these new settings.
        this.updateAbrManagerVariants_();
      }

      // If the streams we are playing are restricted, we need to switch.
      const activeVariant = this.streamingEngine_.getCurrentVariant();
      if (activeVariant) {
        if (!activeVariant.allowedByApplication ||
            !activeVariant.allowedByKeySystem) {
          log.debug('Choosing new variant after changing configuration');
          this.chooseVariantAndSwitch_();
        }
      }
    }
    if (this.networkingEngine_) {
      this.networkingEngine_.setForceHTTPS(this.config_.streaming.forceHTTPS);
    }
    if (this.mediaSourceEngine_) {
      const {segmentRelativeVttTiming} = this.config_.manifest;
      this.mediaSourceEngine_.setSegmentRelativeVttTiming(
          segmentRelativeVttTiming);
      const textDisplayerFactory = this.config_.textDisplayFactory;
      if (this.lastTextFactory_ != textDisplayerFactory) {
        const displayer = textDisplayerFactory();
        this.mediaSourceEngine_.setTextDisplayer(displayer);
        this.lastTextFactory_ = textDisplayerFactory;
        if (this.streamingEngine_) {
          // Reload the text stream, so the cues will load again.
          this.streamingEngine_.reloadTextStream();
        }
      }
    }
    if (this.abrManager_) {
      this.abrManager_.configure(this.config_.abr);

      // Simply enable/disable ABR with each call, since multiple calls to these
      // methods have no effect.
      if (this.config_.abr.enabled) {
        this.abrManager_.enable();
      } else {
        this.abrManager_.disable();
      }
      this.onAbrStatusChanged_();
    }
    if (this.bufferObserver_) {
      let rebufferThreshold = this.config_.streaming.rebufferingGoal;
      if (this.manifest_) {
        rebufferThreshold =
            Math.max(rebufferThreshold, this.manifest_.minBufferTime);
      }
      this.updateBufferingSettings_(rebufferThreshold);
    }
    if (this.manifest_) {
      Player.applyPlayRange_(
          this.manifest_.presentationTimeline, this.config_.playRangeStart,
          this.config_.playRangeEnd);
    }
  }

  /**
   * Return a copy of the current configuration.  Modifications of the returned
   * value will not affect the Player's active configuration.  You must call
   * <code>player.configure()</code> to make changes.
   *
   * @export
   */
  getConfiguration(): IPlayerConfiguration{
    asserts.assert(this.config_, 'Config must not be null!');
    const ret = this.defaultConfig_();
    PlayerConfiguration.mergeConfigObjects(
        ret, this.config_, this.defaultConfig_());
    return ret;
  }

  /**
   * Return a reference to the current configuration. Modifications to the
   * returned value will affect the Player's active configuration. This method
   * is not exported as sharing configuration with external objects is not
   * supported.
   *
   */
  getSharedConfiguration(): IPlayerConfiguration{
    asserts.assert(
        this.config_, 'Cannot call getSharedConfiguration after call destroy!');
    return this.config_;
  }

  /**
   * Returns the ratio of video length buffered compared to buffering Goal
   * @export
   */
  getBufferFullness(): number {
    if (this.video_) {
      const bufferedLength = this.video_.buffered.length;
      const bufferedEnd =
          bufferedLength ? this.video_.buffered.end(bufferedLength - 1) : 0;
      const bufferingGoal = this.getConfiguration().streaming.bufferingGoal;
      const lengthToBeBuffered = Math.min(
          this.video_.currentTime + bufferingGoal, this.seekRange().end);
      if (bufferedEnd >= lengthToBeBuffered) {
        return 1;
      } else {
        if (bufferedEnd <= this.video_.currentTime) {
          return 0;
        } else {
          if (bufferedEnd < lengthToBeBuffered) {
            return (bufferedEnd - this.video_.currentTime) /
                (lengthToBeBuffered - this.video_.currentTime);
          }
        }
      }
    }
    return 0;
  }

  /**
   * Reset configuration to default.
   * @export
   */
  resetConfiguration() {
    asserts.assert(this.config_, 'Cannot be destroyed');

    // Remove the old keys so we remove open-ended dictionaries like drm.servers
    // but keeps the same object reference.
    for (const key in this.config_) {
      delete this.config_[key];
    }
    PlayerConfiguration.mergeConfigObjects(
        this.config_, this.defaultConfig_(), this.defaultConfig_());
    this.applyConfig_();
  }

  /**
   * Get the current load mode.
   *
   * @export
   */
  getLoadMode(): LoadMode {
    return this.loadMode_;
  }

  /**
   * Get the media element that the player is currently using to play loaded
   * content. If the player has not loaded content, this will return
   * <code>null</code>.
   *
   * @export
   */
  getMediaElement(): HTMLMediaElement {
    return this.video_;
  }

  /**
   * @return A reference to the Player's networking
   *     engine.  Applications may use this to make requests through Shaka's
   *     networking plugins.
   * @export
   */
  getNetworkingEngine(): NetworkingEngine {
    return this.networkingEngine_;
  }

  /**
   * Get the uri to the asset that the player has loaded. If the player has not
   * loaded content, this will return <code>null</code>.
   *
   * @export
   */
  getAssetUri(): string|null {
    return this.assetUri_;
  }

  /**
   * Returns a shaka.ads.AdManager instance, responsible for Dynamic
   * Ad Insertion functionality.
   *
   * @export
   */
  getAdManager(): shaka.extern.IAdManager {
    // NOTE: this clause is redundant, but it keeps the compiler from
    // inlining this function. Inlining leads to setting the adManager
    // not taking effect in the compiled build.
    // Closure has a @noinline flag, but apparently not all cases are
    // supported by it, and ours isn't.
    // If they expand support, we might be able to get rid of this
    // clause.
    if (!this.adManager_) {
      return null;
    }
    return this.adManager_;
  }

  /**
   * Get if the player is playing live content. If the player has not loaded
   * content, this will return <code>false</code>.
   *
   * @export
   */
  isLive(): boolean {
    if (this.manifest_) {
      return this.manifest_.presentationTimeline.isLive();
    }

    // For native HLS, the duration for live streams seems to be Infinity.
    if (this.video_ && this.video_.src) {
      return this.video_.duration == Infinity;
    }
    return false;
  }

  /**
   * Get if the player is playing in-progress content. If the player has not
   * loaded content, this will return <code>false</code>.
   *
   * @export
   */
  isInProgress(): boolean {
    return this.manifest_ ? this.manifest_.presentationTimeline.isInProgress() :
                            false;
  }

  /**
   * Check if the manifest contains only audio-only content. If the player has
   * not loaded content, this will return <code>false</code>.
   *
   * <p>
   * The player does not support content that contain more than one type of
   * variants (i.e. mixing audio-only, video-only, audio-video). Content will be
   * filtered to only contain one type of variant.
   *
   * @export
   */
  isAudioOnly(): boolean {
    if (this.manifest_) {
      const variants = this.manifest_.variants;
      if (!variants.length) {
        return false;
      }

      // Note that if there are some audio-only variants and some audio-video
      // variants, the audio-only variants are removed during filtering.
      // Therefore if the first variant has no video, that's sufficient to say
      // it is audio-only content.
      return !variants[0].video;
    } else {
      if (this.video_ && this.video_.src) {
        // If we have video track info, use that.  It will be the least
        // error-prone way with native HLS.  In contrast, videoHeight might be
        // unset until the first frame is loaded.  Since isAudioOnly is queried
        // by the UI on the 'trackschanged' event, the videoTracks info should
        // be up-to-date.
        if (this.video_.videoTracks) {
          return this.video_.videoTracks.length == 0;
        }

        // We cast to the more specific HTMLVideoElement to access videoHeight.
        // This might be an audio element, though, in which case videoHeight
        // will be undefined at runtime.  For audio elements, this will always
        // return true.
        const video = (this.video_ as HTMLVideoElement);
        return video.videoHeight == 0;
      } else {
        return false;
      }
    }
  }

  /**
   * Return the value of lowLatencyMode configuration.
   */
  private isLowLatencyMode_(): boolean {
    return this.config_.streaming.lowLatencyMode;
  }

  /**
   * Return the value of autoLowLatencyMode configuration.
   */
  private isAutoLowLatencyMode_(): boolean {
    return this.config_.streaming.autoLowLatencyMode;
  }

  /**
   * Get the range of time (in seconds) that seeking is allowed. If the player
   * has not loaded content, this will return a range from 0 to 0.
   *
   * @export
   */
  seekRange(): {start: number, end: number} {
    if (this.manifest_) {
      const timeline = this.manifest_.presentationTimeline;
      return {
        'start': timeline.getSeekRangeStart(),
        'end': timeline.getSeekRangeEnd()
      };
    }

    // If we have loaded content with src=, we ask the video element for its
    // seekable range.  This covers both plain mp4s and native HLS playbacks.
    if (this.video_ && this.video_.src) {
      const seekable = this.video_.seekable;
      if (seekable.length) {
        return {
          'start': seekable.start(0),
          'end': seekable.end(seekable.length - 1)
        };
      }
    }
    return {'start': 0, 'end': 0};
  }

  /**
   * Go to live in a live stream.
   *
   * @export
   */
  goToLive() {
    if (this.isLive()) {
      this.video_.currentTime = this.seekRange().end;
    } else {
      log.warning('goToLive is for live streams!');
    }
  }

  /**
   * Get the key system currently used by EME. If EME is not being used, this
   * will return an empty string. If the player has not loaded content, this
   * will return an empty string.
   *
   * @export
   */
  keySystem(): string {
    return DrmEngine.keySystem(this.drmInfo());
  }

  /**
   * Get the drm info used to initialize EME. If EME is not being used, this
   * will return <code>null</code>. If the player is idle or has not initialized
   * EME yet, this will return <code>null</code>.
   *
   * @export
   */
  drmInfo(): shaka.extern.DrmInfo|null {
    return this.drmEngine_ ? this.drmEngine_.getDrmInfo() : null;
  }

  /**
   * Get the drm engine.
   * This method should only be used for testing. Applications SHOULD NOT
   * use this in production.
   *
   */
  getDrmEngine(): DrmEngine|null {
    return this.drmEngine_;
  }

  /**
   * Get the next known expiration time for any EME session. If the session
   * never expires, this will return <code>Infinity</code>. If there are no EME
   * sessions, this will return <code>Infinity</code>. If the player has not
   * loaded content, this will return <code>Infinity</code>.
   *
   * @export
   */
  getExpiration(): number {
    return this.drmEngine_ ? this.drmEngine_.getExpiration() : Infinity;
  }

  /**
   * Gets a map of EME key ID to the current key status.
   *
   * @export
   */
  getKeyStatuses(): {[key: string]: string} {
    return this.drmEngine_ ? this.drmEngine_.getKeyStatuses() : {};
  }

  /**
   * Check if the player is currently in a buffering state (has too little
   * content to play smoothly). If the player has not loaded content, this will
   * return <code>false</code>.
   *
   * @export
   */
  isBuffering(): boolean {
    const State = BufferingObserverExports.State;
    return this.bufferObserver_ ?
        this.bufferObserver_.getState() == State.STARVING :
        false;
  }

  /**
   * Get the playback rate of what is playing right now. If we are using trick
   * play, this will return the trick play rate.
   * If no content is playing, this will return 0.
   * If content is buffering, this will return the expected playback rate once
   * the video starts playing.
   *
   * <p>
   * If the player has not loaded content, this will return a playback rate of
   * 0.
   *
   * @export
   */
  getPlaybackRate(): number {
    if (!this.video_) {
      return 0;
    }
    return this.playRateController_ ? this.playRateController_.getRealRate() :
                                      1;
  }

  /**
   * Enable trick play to skip through content without playing by repeatedly
   * seeking. For example, a rate of 2.5 would result in 2.5 seconds of content
   * being skipped every second. A negative rate will result in moving
   * backwards.
   *
   * <p>
   * If the player has not loaded content or is still loading content this will
   * be a no-op. Wait until <code>load</code> has completed before calling.
   *
   * <p>
   * Trick play will be canceled automatically if the playhead hits the
   * beginning or end of the seekable range for the content.
   *
   * @export
   */
  trickPlay(rate: number) {
    // A playbackRate of 0 is used internally when we are in a buffering state,
    // and doesn't make sense for trick play.  If you set a rate of 0 for trick
    // play, we will reject it and issue a warning.  If it happens during a
    // test, we will fail the test through this assertion.
    asserts.assert(rate != 0, 'Should never set a trick play rate of 0!');
    if (rate == 0) {
      log.alwaysWarn('A trick play rate of 0 is unsupported!');
      return;
    }
    if (this.video_.paused) {
      // Our fast forward is implemented with playbackRate and needs the video
      // to be playing (to not be paused) to take immediate effect.
      // If the video is paused, "unpause" it.
      this.video_.play();
    }
    this.playRateController_.set(rate);
    if (this.loadMode_ == LoadMode.MEDIA_SOURCE) {
      this.abrManager_.playbackRateChanged(rate);
      this.streamingEngine_.setTrickPlay(Math.abs(rate) > 1);
    }
  }

  /**
   * Cancel trick-play. If the player has not loaded content or is still loading
   * content this will be a no-op.
   *
   * @export
   */
  cancelTrickPlay() {
    const defaultPlaybackRate = this.playRateController_.getDefaultRate();
    if (this.loadMode_ == LoadMode.SRC_EQUALS) {
      this.playRateController_.set(defaultPlaybackRate);
    }
    if (this.loadMode_ == LoadMode.MEDIA_SOURCE) {
      this.playRateController_.set(defaultPlaybackRate);
      this.abrManager_.playbackRateChanged(defaultPlaybackRate);
      this.streamingEngine_.setTrickPlay(false);
    }
  }

  /**
   * Return a list of variant tracks that can be switched to.
   *
   * <p>
   * If the player has not loaded content, this will return an empty list.
   *
   * @export
   */
  getVariantTracks(): shaka.extern.Track[] {
    if (this.manifest_) {
      const currentVariant = this.streamingEngine_ ?
          this.streamingEngine_.getCurrentVariant() :
          null;
      const tracks = [];
      let activeTracks = 0;

      // Convert each variant to a track.
      for (const variant of this.manifest_.variants) {
        if (!StreamUtils.isPlayable(variant)) {
          continue;
        }
        const track = StreamUtils.variantToTrack(variant);
        track.active = variant == currentVariant;
        if (!track.active && activeTracks != 1 && currentVariant != null &&
            variant.video == currentVariant.video &&
            variant.audio == currentVariant.audio) {
          track.active = true;
        }
        if (track.active) {
          activeTracks++;
        }
        tracks.push(track);
      }
      asserts.assert(activeTracks <= 1, 'It should only have one active track');
      return tracks;
    } else {
      if (this.video_ && this.video_.audioTracks) {
        // Safari's native HLS always shows a single element in videoTracks.
        // You can't use that API to change resolutions.  But we can use
        // audioTracks to generate a variant list that is usable for changing
        // languages.
        const audioTracks = Array.from(this.video_.audioTracks);
        return audioTracks.map(
            (audio) => StreamUtils.html5AudioTrackToTrack(audio));
      } else {
        return [];
      }
    }
  }

  /**
   * Return a list of text tracks that can be switched to.
   *
   * <p>
   * If the player has not loaded content, this will return an empty list.
   *
   * @export
   */
  getTextTracks(): shaka.extern.Track[] {
    if (this.manifest_) {
      const currentTextStream = this.streamingEngine_ ?
          this.streamingEngine_.getCurrentTextStream() :
          null;
      const tracks = [];

      // Convert all selectable text streams to tracks.
      for (const text of this.manifest_.textStreams) {
        const track = StreamUtils.textStreamToTrack(text);
        track.active = text == currentTextStream;
        tracks.push(track);
      }
      return tracks;
    } else {
      if (this.video_ && this.video_.src && this.video_.textTracks) {
        const textTracks = this.getFilteredTextTracks_();
        const StreamUtils = StreamUtils;
        return textTracks.map(
            (text) => StreamUtils.html5TextTrackToTrack(text));
      } else {
        return [];
      }
    }
  }

  /**
   * Return a list of image tracks that can be switched to.
   *
   * If the player has not loaded content, this will return an empty list.
   *
   * @export
   */
  getImageTracks(): shaka.extern.Track[] {
    if (this.manifest_) {
      const imageStreams = this.manifest_.imageStreams;
      const StreamUtils = StreamUtils;
      return imageStreams.map((image) => StreamUtils.imageStreamToTrack(image));
    } else {
      return [];
    }
  }

  /**
   * Return a Thumbnail object from a image track Id and time.
   *
   * If the player has not loaded content, this will return a null.
   *
   * @export
   */
  async getThumbnails(trackId: number, time: number):
      Promise<shaka.extern.Thumbnail|null> {
    if (this.manifest_) {
      const imageStream =
          this.manifest_.imageStreams.find((stream) => stream.id == trackId);
      if (!imageStream) {
        return null;
      }
      if (!imageStream.segmentIndex) {
        await imageStream.createSegmentIndex();
      }
      const referencePosition = imageStream.segmentIndex.find(time);
      if (referencePosition == null) {
        return null;
      }
      const reference = imageStream.segmentIndex.get(referencePosition);
      const tilesLayout = reference.getTilesLayout() || imageStream.tilesLayout;

      // This expression is used to detect one or more numbers (0-9) followed
      // by an x and after one or more numbers (0-9)
      const match = /(\d+)x(\d+)/.exec(tilesLayout);
      if (!match) {
        log.warning(
            'Tiles layout does not contain a valid format ' +
            ' (columns x rows)');
        return null;
      }
      const fullImageWidth = imageStream.width || 0;
      const fullImageHeight = imageStream.height || 0;
      const columns = parseInt(match[1], 10);
      const rows = parseInt(match[2], 10);
      const width = fullImageWidth / columns;
      const height = fullImageHeight / rows;
      const totalImages = columns * rows;
      const segmentDuration = reference.trueEndTime - reference.startTime;
      const thumbnailDuration =
          reference.getTileDuration() || segmentDuration / totalImages;
      let thumbnailTime = reference.startTime;
      let positionX = 0;
      let positionY = 0;

      // If the number of images in the segment is greater than 1, we have to
      // find the correct image. For that we will return to the app the
      // coordinates of the position of the correct image.
      // Image search is always from left to right and top to bottom.
      // Note: The time between images within the segment is always
      // equidistant.
      // Eg: Total images 5, tileLayout 5x1, segmentDuration 5, thumbnailTime 2
      // positionX = 0.4 * fullImageWidth
      // positionY = 0
      if (totalImages > 1) {
        const thumbnailPosition =
            Math.floor((time - reference.startTime) / thumbnailDuration);
        thumbnailTime =
            reference.startTime + thumbnailPosition * thumbnailDuration;
        positionX = thumbnailPosition % columns * width;
        positionY = Math.floor(thumbnailPosition / columns) * height;
      }
      return {
        imageHeight: fullImageHeight,
        imageWidth: fullImageWidth,
        height: height,
        positionX: positionX,
        positionY: positionY,
        startTime: thumbnailTime,
        duration: thumbnailDuration,
        uris: reference.getUris(),
        width: width
      };
    }
    return null;
  }

  /**
   * Select a specific text track. <code>track</code> should come from a call to
   * <code>getTextTracks</code>. If the track is not found, this will be a
   * no-op. If the player has not loaded content, this will be a no-op.
   *
   * <p>
   * Note that <code>AdaptationEvents</code> are not fired for manual track
   * selections.
   *
   * @export
   */
  selectTextTrack(track: shaka.extern.Track) {
    if (this.manifest_ && this.streamingEngine_) {
      const stream =
          this.manifest_.textStreams.find((stream) => stream.id == track.id);
      if (!stream) {
        log.error('No stream with id', track.id);
        return;
      }
      if (stream == this.streamingEngine_.getCurrentTextStream()) {
        log.debug('Text track already selected.');
        return;
      }

      // Add entries to the history.
      this.addTextStreamToSwitchHistory_(
          stream,
          /* fromAdaptation= */
          false);
      this.streamingEngine_.switchTextStream(stream);
      this.onTextChanged_();

      // Workaround for
      // https://github.com/shaka-project/shaka-player/issues/1299
      // When track is selected, back-propagate the language to
      // currentTextLanguage_.
      this.currentTextLanguage_ = stream.language;
    } else {
      if (this.video_ && this.video_.src && this.video_.textTracks) {
        const textTracks = this.getFilteredTextTracks_();
        for (const textTrack of textTracks) {
          if (StreamUtils.html5TrackId(textTrack) == track.id) {
            // Leave the track in 'hidden' if it's selected but not showing.
            textTrack.mode = this.isTextVisible_ ? 'showing' : 'hidden';
          } else {
            // Safari allows multiple text tracks to have mode == 'showing', so
            // be explicit in resetting the others.
            textTrack.mode = 'disabled';
          }
        }
        this.onTextChanged_();
      }
    }
  }

  /**
   * Select a specific variant track to play.  <code>track</code> should come
   * from a call to <code>getVariantTracks</code>. If <code>track</code> cannot
   * be found, this will be a no-op. If the player has not loaded content, this
   * will be a no-op.
   *
   * <p>
   * Changing variants will take effect once the currently buffered content has
   * been played. To force the change to happen sooner, use
   * <code>clearBuffer</code> with <code>safeMargin</code>. Setting
   * <code>clearBuffer</code> to <code>true</code> will clear all buffered
   * content after <code>safeMargin</code>, allowing the new variant to start
   * playing sooner.
   *
   * <p>
   * Note that <code>AdaptationEvents</code> are not fired for manual track
   * selections.
   *
   * @param safeMargin Optional amount of buffer (in seconds) to
   *   retain when clearing the buffer. Useful for switching variant quickly
   *   without causing a buffering event. Defaults to 0 if not provided. Ignored
   *   if clearBuffer is false. Can cause hiccups on some browsers if chosen too
   *   small, e.g. The amount of two segments is a fair minimum to consider as
   *   safeMargin value.
   * @export
   */
  selectVariantTrack(
      track: shaka.extern.Track, clearBuffer: boolean = false,
      safeMargin: number = 0) {
    if (this.manifest_ && this.streamingEngine_) {
      if (this.config_.abr.enabled) {
        log.alwaysWarn(
            'Changing tracks while abr manager is enabled ' +
            'will likely result in the selected track ' +
            'being overriden. Consider disabling abr before ' +
            'calling selectVariantTrack().');
      }
      const variant =
          this.manifest_.variants.find((variant) => variant.id == track.id);
      if (!variant) {
        log.error('No variant with id', track.id);
        return;
      }

      // Double check that the track is allowed to be played. The track list
      // should only contain playable variants, but if restrictions change and
      // |selectVariantTrack| is called before the track list is updated, we
      // could get a now-restricted variant.
      if (!StreamUtils.isPlayable(variant)) {
        log.error('Unable to switch to restricted track', track.id);
        return;
      }
      this.switchVariant_(
          variant,
          /* fromAdaptation= */
          false, clearBuffer, safeMargin);

      // Workaround for
      // https://github.com/shaka-project/shaka-player/issues/1299
      // When track is selected, back-propagate the language to
      // currentAudioLanguage_.
      this.currentAdaptationSetCriteria_ = new ExampleBasedCriteria(variant);

      // Update AbrManager variants to match these new settings.
      this.updateAbrManagerVariants_();
    } else {
      if (this.video_ && this.video_.audioTracks) {
        // Safari's native HLS won't let you choose an explicit variant, though
        // you can choose audio languages this way.
        const audioTracks = Array.from(this.video_.audioTracks);
        for (const audioTrack of audioTracks) {
          if (StreamUtils.html5TrackId(audioTrack) == track.id) {
            // This will reset the "enabled" of other tracks to false.
            this.switchHtml5Track_(audioTrack);
            return;
          }
        }
      }
    }
  }

  /**
   * Return a list of audio language-role combinations available.  If the
   * player has not loaded any content, this will return an empty list.
   *
   * @export
   */
  getAudioLanguagesAndRoles(): shaka.extern.LanguageRole[] {
    return Player.getLanguageAndRolesFrom_(this.getVariantTracks());
  }

  /**
   * Return a list of text language-role combinations available.  If the player
   * has not loaded any content, this will be return an empty list.
   *
   * @export
   */
  getTextLanguagesAndRoles(): shaka.extern.LanguageRole[] {
    return Player.getLanguageAndRolesFrom_(this.getTextTracks());
  }

  /**
   * Return a list of audio languages available. If the player has not loaded
   * any content, this will return an empty list.
   *
   * @export
   */
  getAudioLanguages(): string[] {
    return Array.from(Player.getLanguagesFrom_(this.getVariantTracks()));
  }

  /**
   * Return a list of text languages available. If the player has not loaded
   * any content, this will return an empty list.
   *
   * @export
   */
  getTextLanguages(): string[] {
    return Array.from(Player.getLanguagesFrom_(this.getTextTracks()));
  }

  /**
   * Sets the current audio language and current variant role to the selected
   * language and role, and chooses a new variant if need be. If the player has
   * not loaded any content, this will be a no-op.
   *
   * @export
   */
  selectAudioLanguage(language: string, role?: string) {
    const LanguageUtils = LanguageUtils;
    if (this.manifest_ && this.playhead_) {
      this.currentAdaptationSetCriteria_ = new PreferenceBasedCriteria(
          language, role || '',
          /* channelCount= */
          0,
          /* label= */
          '');
      const diff = (a, b) => {
        if (!a.video && !b.video) {
          return 0;
        } else {
          if (!a.video || !b.video) {
            return Infinity;
          } else {
            return Math.abs((a.video.height || 0) - (b.video.height || 0)) +
                Math.abs((a.video.width || 0) - (b.video.width || 0));
          }
        }
      };

      // Find the variant whose size is closest to the active variant.  This
      // ensures we stay at about the same resolution when just changing the
      // language/role.
      const active = this.streamingEngine_.getCurrentVariant();
      const set =
          this.currentAdaptationSetCriteria_.create(this.manifest_.variants);
      let bestVariant = null;
      for (const curVariant of set.values()) {
        if (!bestVariant ||
            diff(bestVariant, active) > diff(curVariant, active)) {
          bestVariant = curVariant;
        }
      }
      if (bestVariant) {
        const track = StreamUtils.variantToTrack(bestVariant);
        this.selectVariantTrack(
            track,
            /* clearBuffer= */
            true);
        return;
      }

      // If we haven't switched yet, just use ABR to find a new track.
      this.chooseVariantAndSwitch_();
    } else {
      if (this.video_ && this.video_.audioTracks) {
        const audioTracks = Array.from(this.video_.audioTracks);
        const selectedLanguage = LanguageUtils.normalize(language);
        let languageMatch = null;
        let languageAndRoleMatch = null;
        for (const audioTrack of audioTracks) {
          const track = StreamUtils.html5AudioTrackToTrack(audioTrack);
          if (LanguageUtils.normalize(track.language) == selectedLanguage) {
            languageMatch = audioTrack;
            if (role) {
              if (track.roles.includes(role)) {
                languageAndRoleMatch = audioTrack;
              }
            } else {
              // no role
              if (track.roles.length == 0) {
                languageAndRoleMatch = audioTrack;
              }
            }
          }
        }
        if (languageAndRoleMatch) {
          this.switchHtml5Track_(languageAndRoleMatch);
        } else {
          if (languageMatch) {
            this.switchHtml5Track_(languageMatch);
          }
        }
      }
    }
  }

  /**
   * Sets the current text language and current text role to the selected
   * language and role, and chooses a new variant if need be. If the player has
   * not loaded any content, this will be a no-op.
   *
   * @export
   */
  selectTextLanguage(language: string, role?: string, forced: boolean = false) {
    const LanguageUtils = LanguageUtils;
    if (this.manifest_ && this.playhead_) {
      this.currentTextLanguage_ = language;
      this.currentTextRole_ = role || '';
      this.currentTextForced_ = forced;
      const chosenText = this.chooseTextStream_();
      if (chosenText) {
        if (chosenText == this.streamingEngine_.getCurrentTextStream()) {
          log.debug('Text track already selected.');
          return;
        }
        this.addTextStreamToSwitchHistory_(
            chosenText,
            /* fromAdaptation= */
            false);
        if (this.shouldStreamText_()) {
          this.streamingEngine_.switchTextStream(chosenText);
          this.onTextChanged_();
        }
      }
    } else {
      const selectedLanguage = LanguageUtils.normalize(language);
      const track = this.getTextTracks().find((t) => {
        return LanguageUtils.normalize(t.language) == selectedLanguage &&
            (!role || t.roles.includes(role)) && t.forced == forced;
      });
      if (track) {
        this.selectTextTrack(track);
      }
    }
  }

  /**
   * Select variant tracks that have a given label. This assumes the
   * label uniquely identifies an audio stream, so all the variants
   * are expected to have the same variant.audio.
   *
   * @export
   */
  selectVariantsByLabel(label: string) {
    if (this.manifest_ && this.playhead_) {
      let firstVariantWithLabel = null;
      for (const variant of this.manifest_.variants) {
        if (variant.audio.label == label) {
          firstVariantWithLabel = variant;
          break;
        }
      }
      if (firstVariantWithLabel == null) {
        log.warning(
            'No variants were found with label: ' + label +
            '. Ignoring the request to switch.');
        return;
      }

      // Label is a unique identifier of a variant's audio stream.
      // Because of that we assume that all the variants with the same
      // label have the same language.
      this.currentAdaptationSetCriteria_ = new PreferenceBasedCriteria(
          firstVariantWithLabel.language, '', 0, label);
      this.chooseVariantAndSwitch_();
    }
  }

  /**
   * Check if the text displayer is enabled.
   *
   * @export
   */
  isTextTrackVisible(): boolean {
    const expected = this.isTextVisible_;
    if (this.mediaSourceEngine_) {
      // Make sure our values are still in-sync.
      const actual = this.mediaSourceEngine_.getTextDisplayer().isTextVisible();
      asserts.assert(
          actual == expected, 'text visibility has fallen out of sync');

      // Always return the actual value so that the app has the most accurate
      // information (in the case that the values come out of sync in prod).
      return actual;
    } else {
      if (this.video_ && this.video_.src && this.video_.textTracks) {
        const textTracks = this.getFilteredTextTracks_();
        return textTracks.some((t) => t.mode == 'showing');
      }
    }
    return expected;
  }

  /**
   * Return a list of chapters tracks.
   *
   * @export
   */
  getChaptersTracks(): shaka.extern.Track[] {
    if (this.video_ && this.video_.src && this.video_.textTracks) {
      const textTracks = this.getChaptersTracks_();
      const StreamUtils = StreamUtils;
      return textTracks.map((text) => StreamUtils.html5TextTrackToTrack(text));
    } else {
      return [];
    }
  }

  /**
   * This returns the list of chapters.
   *
   * @export
   */
  getChapters(language: string): shaka.extern.Chapter[] {
    const LanguageUtils = LanguageUtils;
    const inputlanguage = LanguageUtils.normalize(language);
    const chaptersTracks = this.getChaptersTracks_();
    const chaptersTracksWithLanguage = chaptersTracks.filter(
        (t) => LanguageUtils.normalize(t.language) == inputlanguage);
    if (!chaptersTracksWithLanguage || !chaptersTracksWithLanguage.length) {
      return [];
    }
    const chapters = [];
    for (const chaptersTrack of chaptersTracksWithLanguage) {
      if (chaptersTrack && chaptersTrack.cues) {
        for (const cue of chaptersTrack.cues) {
          let id = cue.id;
          if (!id || id == '') {
            id = cue.startTime + '-' + cue.endTime + '-' + cue.text;
          }
          const chapter: shaka.extern.Chapter = {
            id: id,
            title: cue.text,
            startTime: cue.startTime,
            endTime: cue.endTime
          };
          chapters.push(chapter);
        }
      }
    }
    return chapters;
  }

  /**
   * Ignore the TextTracks with the 'metadata' or 'chapters' kind, or the one
   * generated by the SimpleTextDisplayer.
   *
   */
  private getFilteredTextTracks_(): TextTrack[] {
    asserts.assert(this.video_.textTracks, 'TextTracks should be valid.');
    return Array.from(this.video_.textTracks)
        .filter(
            (t) => t.kind != 'metadata' && t.kind != 'chapters' &&
                t.label != TextTrackLabel);
  }

  /**
   * Get the TextTracks with the 'metadata' kind.
   *
   */
  private getMetadataTracks_(): TextTrack[] {
    asserts.assert(this.video_.textTracks, 'TextTracks should be valid.');
    return Array.from(this.video_.textTracks)
        .filter((t) => t.kind == 'metadata');
  }

  /**
   * Get the TextTracks with the 'chapters' kind.
   *
   */
  private getChaptersTracks_(): TextTrack[] {
    asserts.assert(this.video_.textTracks, 'TextTracks should be valid.');
    return Array.from(this.video_.textTracks)
        .filter((t) => t.kind == 'chapters');
  }

  /**
   * Enable or disable the text displayer.  If the player is in an unloaded
   * state, the request will be applied next time content is loaded.
   *
   * @export
   */
  setTextTrackVisibility(isVisible: boolean) {
    const oldVisibilty = this.isTextVisible_;

    // Convert to boolean in case apps pass 0/1 instead false/true.
    const newVisibility = !!isVisible;
    if (oldVisibilty == newVisibility) {
      return;
    }
    this.isTextVisible_ = newVisibility;

    // Hold of on setting the text visibility until we have all the components
    // we need. This ensures that they stay in-sync.
    if (this.loadMode_ == LoadMode.MEDIA_SOURCE) {
      this.mediaSourceEngine_.getTextDisplayer().setTextVisibility(
          newVisibility);

      // When the user wants to see captions, we stream captions. When the user
      // doesn't want to see captions, we don't stream captions. This is to
      // avoid bandwidth consumption by an unused resource. The app developer
      // can override this and configure us to always stream captions.
      if (!this.config_.streaming.alwaysStreamText) {
        if (newVisibility) {
          // We already have a selected text stream.
          if (this.streamingEngine_.getCurrentTextStream()) {
          } else {
            // Find the text stream that best matches the user's preferences.
            const streams = StreamUtils.filterStreamsByLanguageAndRole(
                this.manifest_.textStreams, this.currentTextLanguage_,
                this.currentTextRole_, this.currentTextForced_);

            // It is possible that there are no streams to play.
            if (streams.length > 0) {
              this.streamingEngine_.switchTextStream(streams[0]);
              this.onTextChanged_();
            }
          }
        } else {
          this.streamingEngine_.unloadTextStream();
        }
      }
    } else {
      if (this.video_ && this.video_.src && this.video_.textTracks) {
        const textTracks = this.getFilteredTextTracks_();

        // Find the active track by looking for one which is not disabled.  This
        // is the only way to identify the track which is currently displayed.
        // Set it to 'showing' or 'hidden' based on newVisibility.
        for (const textTrack of textTracks) {
          if (textTrack.mode != 'disabled') {
            textTrack.mode = newVisibility ? 'showing' : 'hidden';
          }
        }
      }
    }

    // We need to fire the event after we have updated everything so that
    // everything will be in a stable state when the app responds to the
    // event.
    this.onTextTrackVisibility_();
  }

  /**
   * Get the current playhead position as a date. This should only be called
   * when the player has loaded a live stream. If the player has not loaded a
   * live stream, this will return <code>null</code>.
   *
   * @export
   */
  getPlayheadTimeAsDate(): Date {
    if (!this.isLive()) {
      log.warning('getPlayheadTimeAsDate is for live streams!');
      return null;
    }
    const walkerPayload = this.walker_.getCurrentPayload();
    let presentationTime = 0;
    if (this.playhead_) {
      presentationTime = this.playhead_.getTime();
    } else {
      if (walkerPayload) {
        if (walkerPayload.startTime == null) {
          // A live stream with no requested start time and no playhead yet.  We
          // would start at the live edge, but we don't have that yet, so return
          // the current date & time.
          return new Date();
        } else {
          // A specific start time has been requested.  This is what Playhead
          // will use once it is created.
          presentationTime = walkerPayload.startTime;
        }
      }
    }
    if (this.manifest_) {
      const timeline = this.manifest_.presentationTimeline;
      const startTime = timeline.getPresentationStartTime();
      return new Date(
          /* ms= */
          (startTime + presentationTime) * 1000);
    } else {
      if (this.video_ && this.video_.getStartDate) {
        // Apple's native HLS gives us getStartDate(), which is only available
        // if EXT-X-PROGRAM-DATETIME is in the playlist.
        const startDate = this.video_.getStartDate();
        if (isNaN(startDate.getTime())) {
          log.warning(
              'EXT-X-PROGRAM-DATETIME required to get playhead time as Date!');
          return null;
        }
        return new Date(startDate.getTime() + presentationTime * 1000);
      } else {
        log.warning('No way to get playhead time as Date!');
        return null;
      }
    }
  }

  /**
   * Get the presentation start time as a date. This should only be called when
   * the player has loaded a live stream. If the player has not loaded a live
   * stream, this will return <code>null</code>.
   *
   * @export
   */
  getPresentationStartTimeAsDate(): Date {
    if (!this.isLive()) {
      log.warning('getPresentationStartTimeAsDate is for live streams!');
      return null;
    }
    if (this.manifest_) {
      const timeline = this.manifest_.presentationTimeline;
      const startTime = timeline.getPresentationStartTime();
      asserts.assert(
          startTime != null, 'Presentation start time should not be null!');
      return new Date(
          /* ms= */
          startTime * 1000);
    } else {
      if (this.video_ && this.video_.getStartDate) {
        // Apple's native HLS gives us getStartDate(), which is only available
        // if EXT-X-PROGRAM-DATETIME is in the playlist.
        const startDate = this.video_.getStartDate();
        if (isNaN(startDate.getTime())) {
          log.warning(
              'EXT-X-PROGRAM-DATETIME required to get presentation start time ' +
              'as Date!');
          return null;
        }
        return startDate;
      } else {
        log.warning('No way to get presentation start time as Date!');
        return null;
      }
    }
  }

  /**
   * Get information about what the player has buffered. If the player has not
   * loaded content or is currently loading content, the buffered content will
   * be empty.
   *
   * @export
   */
  getBufferedInfo(): shaka.extern.BufferedInfo {
    if (this.loadMode_ == LoadMode.MEDIA_SOURCE) {
      return this.mediaSourceEngine_.getBufferedInfo();
    }
    const info = {total: [], audio: [], video: [], text: []};
    if (this.loadMode_ == LoadMode.SRC_EQUALS) {
      const TimeRangesUtils = TimeRangesUtils;
      info.total = TimeRangesUtils.getBufferedInfo(this.video_.buffered);
    }
    return info;
  }

  /**
   * Get statistics for the current playback session. If the player is not
   * playing content, this will return an empty stats object.
   *
   * @export
   */
  getStats(): shaka.extern.Stats {
    // If the Player is not in a fully-loaded state, then return an empty stats
    // blob so that this call will never fail.
    const loaded = this.loadMode_ == LoadMode.MEDIA_SOURCE ||
        this.loadMode_ == LoadMode.SRC_EQUALS;
    if (!loaded) {
      return Stats.getEmptyBlob();
    }
    this.updateStateHistory_();
    asserts.assert(this.video_, 'If we have stats, we should have video_');
    const element = (this.video_ as HTMLVideoElement);
    const completionRatio = element.currentTime / element.duration;
    if (!isNaN(completionRatio)) {
      this.stats_.setCompletionPercent(Math.round(100 * completionRatio));
    }
    if (this.playhead_) {
      this.stats_.setGapsJumped(this.playhead_.getGapsJumped());
      this.stats_.setStallsDetected(this.playhead_.getStallsDetected());
    }
    if (element.getVideoPlaybackQuality) {
      const info = element.getVideoPlaybackQuality();
      this.stats_.setDroppedFrames(
          Number(info.droppedVideoFrames), Number(info.totalVideoFrames));
      this.stats_.setCorruptedFrames(Number(info.corruptedVideoFrames));
    }
    const licenseSeconds =
        this.drmEngine_ ? this.drmEngine_.getLicenseTime() : NaN;
    this.stats_.setLicenseTime(licenseSeconds);
    if (this.loadMode_ == LoadMode.MEDIA_SOURCE) {
      // Event through we are loaded, it is still possible that we don't have a
      // variant yet because we set the load mode before we select the first
      // variant to stream.
      const variant = this.streamingEngine_.getCurrentVariant();
      if (variant) {
        const rate = this.playRateController_ ?
            this.playRateController_.getRealRate() :
            1;
        const variantBandwidth = rate * variant.bandwidth;

        // TODO: Should include text bandwidth if it enabled.
        const currentStreamBandwidth = variantBandwidth;
        this.stats_.setCurrentStreamBandwidth(currentStreamBandwidth);
      }
      if (variant && variant.video) {
        this.stats_.setResolution(
            variant.video.width || NaN,
            /* width= */
            /* height= */
            variant.video.height || NaN);
      }
      if (this.isLive()) {
        const now = this.getPresentationStartTimeAsDate().valueOf() +
            this.seekRange().end * 1000;
        const latency = (Date.now() - now) / 1000;
        this.stats_.setLiveLatency(latency);
      }
      if (this.manifest_ && this.manifest_.presentationTimeline) {
        const maxSegmentDuration =
            this.manifest_.presentationTimeline.getMaxSegmentDuration();
        this.stats_.setMaxSegmentDuration(maxSegmentDuration);
      }
      const estimate = this.abrManager_.getBandwidthEstimate();
      this.stats_.setBandwidthEstimate(estimate);
    }
    if (this.loadMode_ == LoadMode.SRC_EQUALS) {
      this.stats_.setResolution(
          element.videoWidth || NaN,
          /* width= */
          /* height= */
          element.videoHeight || NaN);
    }
    return this.stats_.getBlob();
  }

  /**
   * Adds the given text track to the loaded manifest.  <code>load()</code> must
   * resolve before calling.  The presentation must have a duration.
   *
   * This returns the created track, which can immediately be selected by the
   * application.  The track will not be automatically selected.
   *
   * @export
   */
  async addTextTrackAsync(
      uri: string, language: string, kind: string, mimeType?: string,
      codec?: string, label?: string,
      forced: boolean = false): Promise<shaka.extern.Track> {
    if (this.loadMode_ != LoadMode.MEDIA_SOURCE &&
        this.loadMode_ != LoadMode.SRC_EQUALS) {
      log.error(
          'Must call load() and wait for it to resolve before adding text ' +
          'tracks.');
      throw new Error(
          ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.PLAYER,
          ErrorExports.Code.CONTENT_NOT_LOADED);
    }
    if (!mimeType) {
      mimeType = await this.getTextMimetype_(uri);
    }
    let adCuePoints = [];
    if (this.adManager_) {
      try {
        adCuePoints = this.adManager_.getServerSideCuePoints();
      } catch (error) {
      }
    }
    if (this.loadMode_ == LoadMode.SRC_EQUALS) {
      if (forced) {
        // See: https://github.com/whatwg/html/issues/4472
        kind = 'forced';
      }
      await this.addSrcTrackElement_(
          uri, language, kind, mimeType, label || '', adCuePoints);
      const textTracks = this.getTextTracks();
      const srcTrack = textTracks.find((t) => {
        return t.language == language && t.label == (label || '') &&
            t.kind == kind;
      });
      if (srcTrack) {
        this.onTracksChanged_();
        return srcTrack;
      }

      // This should not happen, but there are browser implementations that may
      // not support the Track element.
      log.error('Cannot add this text when loaded with src=');
      throw new Error(
          ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.TEXT,
          ErrorExports.Code.CANNOT_ADD_EXTERNAL_TEXT_TO_SRC_EQUALS);
    }
    const ContentType = ManifestParserUtilsExports.ContentType;
    const duration = this.manifest_.presentationTimeline.getDuration();
    if (duration == Infinity) {
      throw new Error(
          ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.CANNOT_ADD_EXTERNAL_TEXT_TO_LIVE_STREAM);
    }
    if (adCuePoints.length) {
      asserts.assert(this.networkingEngine_, 'Need networking engine.');
      const data = await this.getTextData_(
          uri, this.networkingEngine_, this.config_.streaming.retryParameters);
      const vvtText = this.convertToWebVTT_(data, mimeType, adCuePoints);
      const blob = new Blob([vvtText], {type: 'text/vtt'});
      uri = MediaSourceEngineExports.createObjectURL(blob);
      mimeType = 'text/vtt';
    }
    const stream: shaka.extern.Stream = {
      id: this.nextExternalStreamId_++,
      originalId: null,
      createSegmentIndex: () => Promise.resolve(),
      segmentIndex: SegmentIndex.forSingleSegment(
          0,
          /* startTime= */
          duration,
          /* duration= */
          [
            /* uris= */
            uri
          ]),
      mimeType: mimeType || '',
      codecs: codec || '',
      kind: kind,
      encrypted: false,
      drmInfos: [],
      keyIds: new Set(),
      language: language,
      label: label || null,
      type: ContentType.TEXT,
      primary: false,
      trickModeVideo: null,
      emsgSchemeIdUris: null,
      roles: [],
      forced: !!forced,
      channelsCount: null,
      audioSamplingRate: null,
      spatialAudio: false,
      closedCaptions: null
    };
    const fullMimeType = MimeUtils.getFullType(stream.mimeType, stream.codecs);
    const supported = TextEngine.isTypeSupported(fullMimeType);
    if (!supported) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.MISSING_TEXT_PLUGIN, mimeType);
    }
    this.manifest_.textStreams.push(stream);
    this.onTracksChanged_();
    return StreamUtils.textStreamToTrack(stream);
  }

  /**
   * Adds the given chapters track to the loaded manifest.  <code>load()</code>
   * must resolve before calling.  The presentation must have a duration.
   *
   * This returns the created track.
   *
   * @export
   */
  async addChaptersTrack(uri: string, language: string, mimeType?: string):
      Promise<shaka.extern.Track> {
    if (this.loadMode_ != LoadMode.MEDIA_SOURCE &&
        this.loadMode_ != LoadMode.SRC_EQUALS) {
      log.error(
          'Must call load() and wait for it to resolve before adding ' +
          'chapters tracks.');
      throw new Error(
          ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.PLAYER,
          ErrorExports.Code.CONTENT_NOT_LOADED);
    }
    if (!mimeType) {
      mimeType = await this.getTextMimetype_(uri);
    }
    let adCuePoints = [];
    if (this.adManager_) {
      try {
        adCuePoints = this.adManager_.getServerSideCuePoints();
      } catch (error) {
      }
    }
    const trackElement: HTMLTrackElement = await this.addSrcTrackElement_(
        uri, language,
        /* kind= */
        'chapters', mimeType,
        /* label= */
        '', adCuePoints);
    const chaptersTracks = this.getChaptersTracks();
    const chaptersTrack = chaptersTracks.find((t) => {
      return t.language == language;
    });
    if (chaptersTrack) {
      await new Promise((resolve, reject) => {
        // The chapter data isn't available until the 'load' event fires, and
        // that won't happen until the chapters track is activated by the
        // activateChaptersTrack_ method.
        this.loadEventManager_.listenOnce(trackElement, 'load', resolve);
        this.loadEventManager_.listenOnce(trackElement, 'error', (event) => {
          reject(new Error(
              ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.TEXT,
              ErrorExports.Code.CHAPTERS_TRACK_FAILED));
        });
      });
      return chaptersTrack;
    }

    // This should not happen, but there are browser implementations that may
    // not support the Track element.
    log.error('Cannot add this text when loaded with src=');
    throw new Error(
        ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.TEXT,
        ErrorExports.Code.CANNOT_ADD_EXTERNAL_TEXT_TO_SRC_EQUALS);
  }

  private async getTextMimetype_(uri: string): Promise<string> {
    // Try using the uri extension.
    const extension = ManifestParser.getExtension(uri);
    let mimeType = TEXT_EXTENSIONS_TO_MIME_TYPES_[extension];
    if (mimeType) {
      return mimeType;
    }
    try {
      asserts.assert(this.networkingEngine_, 'Need networking engine.');

      // eslint-disable-next-line require-atomic-updates
      mimeType = await ManifestParser.getMimeType(
          uri, this.networkingEngine_, this.config_.streaming.retryParameters);
    } catch (error) {
    }
    if (mimeType) {
      return mimeType;
    }
    log.error(
        'The mimeType has not been provided and it could not be deduced ' +
        'from its extension.');
    throw new Error(
        ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.TEXT,
        ErrorExports.Code.TEXT_COULD_NOT_GUESS_MIME_TYPE, extension);
  }

  private async addSrcTrackElement_(
      uri: string, language: string, kind: string, mimeType: string,
      label: string,
      adCuePoints: shaka.extern.AdCuePoint[]): Promise<HTMLTrackElement> {
    if (mimeType != 'text/vtt' || adCuePoints.length) {
      asserts.assert(this.networkingEngine_, 'Need networking engine.');
      const data = await this.getTextData_(
          uri, this.networkingEngine_, this.config_.streaming.retryParameters);
      const vvtText = this.convertToWebVTT_(data, mimeType, adCuePoints);
      const blob = new Blob([vvtText], {type: 'text/vtt'});
      uri = MediaSourceEngineExports.createObjectURL(blob);
      mimeType = 'text/vtt';
    }
    const trackElement = (document.createElement('track') as HTMLTrackElement);
    trackElement.src = this.cmcdManager_.appendTextTrackData(uri);
    trackElement.label = label;
    trackElement.kind = kind;
    trackElement.srclang = language;

    // Because we're pulling in the text track file via Javascript, the
    // same-origin policy applies. If you'd like to have a player served
    // from one domain, but the text track served from another, you'll
    // need to enable CORS in order to do so. In addition to enabling CORS
    // on the server serving the text tracks, you will need to add the
    // crossorigin attribute to the video element itself.
    if (!this.video_.getAttribute('crossorigin')) {
      this.video_.setAttribute('crossorigin', 'anonymous');
    }
    this.video_.appendChild(trackElement);
    return trackElement;
  }

  private async getTextData_(
      uri: string, netEngine: NetworkingEngine,
      retryParams: shaka.extern.RetryParameters): Promise<BufferSource> {
    const type = NetworkingEngineExports.RequestType.SEGMENT;
    const request = NetworkingEngine.makeRequest([uri], retryParams);
    request.method = 'GET';
    this.cmcdManager_.applyTextData(request);
    const response = await netEngine.request(type, request).promise;
    return response.data;
  }

  /**
   * Converts an input string to a WebVTT format string.
   *
   */
  private convertToWebVTT_(
      buffer: BufferSource, mimeType: string,
      adCuePoints: shaka.extern.AdCuePoint[]): string {
    const factory = TextEngine.findParser(mimeType);
    if (factory) {
      const obj = factory();
      const time = {
        periodStart: 0,
        segmentStart: 0,
        segmentEnd: this.video_.duration,
        vttOffset: 0
      };
      const data = BufferUtils.toUint8(buffer);
      const cues = obj.parseMedia(data, time);
      return WebVttGenerator.convert(cues, adCuePoints);
    }
    throw new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
        ErrorExports.Code.MISSING_TEXT_PLUGIN, mimeType);
  }

  /**
   * Set the maximum resolution that the platform's hardware can handle.
   * This will be called automatically by <code>shaka.cast.CastReceiver</code>
   * to enforce limitations of the Chromecast hardware.
   *
   * @export
   */
  setMaxHardwareResolution(width: number, height: number) {
    this.maxHwRes_.width = width;
    this.maxHwRes_.height = height;
  }

  /**
   * Retry streaming after a streaming failure has occurred. When the player has
   * not loaded content or is loading content, this will be a no-op and will
   * return <code>false</code>.
   *
   * <p>
   * If the player has loaded content, and streaming has not seen an error, this
   * will return <code>false</code>.
   *
   * <p>
   * If the player has loaded content, and streaming seen an error, but the
   * could not resume streaming, this will return <code>false</code>.
   *
   * @export
   */
  retryStreaming(): boolean {
    return this.loadMode_ == LoadMode.MEDIA_SOURCE ?
        this.streamingEngine_.retry() :
        false;
  }

  /**
   * Get the manifest that the player has loaded. If the player has not loaded
   * any content, this will return <code>null</code>.
   *
   * NOTE: This structure is NOT covered by semantic versioning compatibility
   * guarantees.  It may change at any time!
   *
   * This is marked as deprecated to warn Closure Compiler users at compile-time
   * to avoid using this method.
   *
   * @export
   * @deprecated
   */
  getManifest(): shaka.extern.Manifest|null {
    log.alwaysWarn(
        'Shaka Player\'s internal Manifest structure is NOT covered by ' +
        'semantic versioning compatibility guarantees.  It may change at any ' +
        'time!  Please consider filing a feature request for whatever you ' +
        'use getManifest() for.');
    return this.manifest_;
  }

  /**
   * Get the type of manifest parser that the player is using. If the player has
   * not loaded any content, this will return <code>null</code>.
   *
   * @export
   */
  getManifestParserFactory(): shaka.extern.ManifestParser.Factory|null {
    return this.parserFactory_;
  }

  private addVariantToSwitchHistory_(
      variant: shaka.extern.Variant, fromAdaptation: boolean) {
    const switchHistory = this.stats_.getSwitchHistory();
    switchHistory.updateCurrentVariant(variant, fromAdaptation);
  }

  private addTextStreamToSwitchHistory_(
      textStream: shaka.extern.Stream, fromAdaptation: boolean) {
    const switchHistory = this.stats_.getSwitchHistory();
    switchHistory.updateCurrentText(textStream, fromAdaptation);
  }

  private defaultConfig_(): IPlayerConfiguration{
    const config = PlayerConfiguration.createDefault();
    config.streaming.failureCallback = (error) => {
      this.defaultStreamingFailureCallback_(error);
    };

    // Because this.video_ may not be set when the config is built, the default
    // TextDisplay factory must capture a reference to "this".
    config.textDisplayFactory = () => {
      if (this.videoContainer_) {
        return new UITextDisplayer(this.video_, this.videoContainer_);
      } else {
        return new SimpleTextDisplayer(this.video_);
      }
    };
    return config;
  }

  /**
   * Set the videoContainer to construct UITextDisplayer.
   * @export
   */
  setVideoContainer(videoContainer: HTMLElement) {
    this.videoContainer_ = videoContainer;
  }

  private defaultStreamingFailureCallback_(error: Error) {
    const retryErrorCodes = [
      ErrorExports.Code.BAD_HTTP_STATUS, ErrorExports.Code.HTTP_ERROR,
      ErrorExports.Code.TIMEOUT
    ];
    if (this.isLive() && retryErrorCodes.includes(error.code)) {
      error.severity = ErrorExports.Severity.RECOVERABLE;
      log.warning('Live streaming error.  Retrying automatically...');
      this.retryStreaming();
    }
  }

  /**
   * For CEA closed captions embedded in the video streams, create dummy text
   * stream.  This can be safely called again on existing manifests, for
   * manifest updates.
   */
  private makeTextStreamsForClosedCaptions_(manifest: shaka.extern.Manifest) {
    const ContentType = ManifestParserUtilsExports.ContentType;
    const TextStreamKind = ManifestParserUtilsExports.TextStreamKind;
    const CEA608_MIME = MimeUtilsExports.CEA608_CLOSED_CAPTION_MIMETYPE;
    const CEA708_MIME = MimeUtilsExports.CEA708_CLOSED_CAPTION_MIMETYPE;

    // A set, to make sure we don't create two text streams for the same video.
    const closedCaptionsSet = new Set();
    for (const textStream of manifest.textStreams) {
      if (textStream.mimeType == CEA608_MIME ||
          textStream.mimeType == CEA708_MIME) {
        // This function might be called on a manifest update, so don't make a
        // new text stream for closed caption streams we have seen before.
        closedCaptionsSet.add(textStream.originalId);
      }
    }
    for (const variant of manifest.variants) {
      const video = variant.video;
      if (video && video.closedCaptions) {
        for (const id of video.closedCaptions.keys()) {
          if (!closedCaptionsSet.has(id)) {
            const mimeType = id.startsWith('CC') ? CEA608_MIME : CEA708_MIME;

            // Add an empty segmentIndex, for the benefit of the period combiner
            // in our builtin DASH parser.
            const segmentIndex = new MetaSegmentIndex();
            const textStream = {
              id: this.nextExternalStreamId_++,
              // A globally unique ID.
              originalId: id,
              // The CC ID string, like 'CC1', 'CC3', etc.
              createSegmentIndex: () => Promise.resolve(),
              segmentIndex,
              mimeType,
              codecs: '',
              kind: TextStreamKind.CLOSED_CAPTION,
              encrypted: false,
              drmInfos: [],
              keyIds: new Set(),
              language: video.closedCaptions.get(id),
              label: null,
              type: ContentType.TEXT,
              primary: false,
              trickModeVideo: null,
              emsgSchemeIdUris: null,
              roles: video.roles,
              forced: false,
              channelsCount: null,
              audioSamplingRate: null,
              spatialAudio: false,
              closedCaptions: null
            };
            manifest.textStreams.push(textStream);
            closedCaptionsSet.add(id);
          }
        }
      }
    }
  }

  /**
   * Filters a manifest, removing unplayable streams/variants.
   *
   */
  private async filterManifest_(manifest: shaka.extern.Manifest|null) {
    await this.filterManifestWithStreamUtils_(manifest);
    this.filterManifestWithRestrictions_(manifest);
  }

  /**
   * Filters a manifest, removing unplayable streams/variants.
   *
   */
  private async filterManifestWithStreamUtils_(manifest: shaka.extern.Manifest|
                                               null) {
    asserts.assert(manifest, 'Manifest should exist!');
    asserts.assert(this.video_, 'Must not be destroyed');
    const currentVariant: shaka.extern.Variant|null = this.streamingEngine_ ?
        this.streamingEngine_.getCurrentVariant() :
        null;
    await StreamUtils.filterManifest(this.drmEngine_, currentVariant, manifest);
    this.checkPlayableVariants_(manifest);
  }

  /**
   * Apply the restrictions configuration to the manifest, and check if there's
   * a variant that meets the restrictions.
   *
   */
  private filterManifestWithRestrictions_(manifest: shaka.extern.Manifest|
                                          null) {
    // Return if |destroy| is called.
    if (this.loadMode_ == LoadMode.DESTROYED) {
      return;
    }
    const tracksChanged = StreamUtils.applyRestrictions(
        manifest.variants, this.config_.restrictions, this.maxHwRes_);
    if (tracksChanged && this.streamingEngine_) {
      this.onTracksChanged_();
    }

    // We may need to create new sessions for any new init data.
    const curDrmInfo = this.drmEngine_ ? this.drmEngine_.getDrmInfo() : null;

    // DrmEngine.newInitData() requires mediaKeys to be available.
    if (curDrmInfo && this.drmEngine_.getMediaKeys()) {
      for (const variant of manifest.variants) {
        const videoDrmInfos = variant.video ? variant.video.drmInfos : [];
        const audioDrmInfos = variant.audio ? variant.audio.drmInfos : [];
        const drmInfos = videoDrmInfos.concat(audioDrmInfos);
        for (const drmInfo of drmInfos) {
          // Ignore any data for different key systems.
          if (drmInfo.keySystem == curDrmInfo.keySystem) {
            for (const initData of drmInfo.initData || []) {
              this.drmEngine_.newInitData(
                  initData.initDataType, initData.initData);
            }
          }
        }
      }
    }
    this.checkRestrictedVariants_(manifest);
  }

  private filterManifestByCurrentVariant_() {
    asserts.assert(this.manifest_, 'Manifest should be valid');
    asserts.assert(this.streamingEngine_, 'StreamingEngine should be valid');
    const currentVariant = this.streamingEngine_ ?
        this.streamingEngine_.getCurrentVariant() :
        null;
    StreamUtils.filterManifestByCurrentVariant(currentVariant, this.manifest_);
    this.checkPlayableVariants_(this.manifest_);
  }

  private async adjustStartTime_(
      initialVariant: shaka.extern.Variant, time: number): Promise<number> {
    const activeAudio: shaka.extern.Stream|null = initialVariant.audio;
    const activeVideo: shaka.extern.Stream|null = initialVariant.video;
    const getAdjustedTime =
        async(stream: shaka.extern.Stream|null, time: number):
            Promise<number|null> => {
              if (!stream) {
                return null;
              }
              await stream.createSegmentIndex();
              const iter = stream.segmentIndex.getIteratorForTime(time);
              const ref = iter ? iter.next().value : null;
              if (!ref) {
                return null;
              }
              const refTime = ref.startTime;
              asserts.assert(
                  refTime <= time, 'Segment should start before target time!');
              return refTime;
            };
    const audioStartTime = await getAdjustedTime(activeAudio, time);
    const videoStartTime = await getAdjustedTime(activeVideo, time);

    // If we have both video and audio times, pick the larger one.  If we picked
    // the smaller one, that one will download an entire segment to buffer the
    // difference.
    if (videoStartTime != null && audioStartTime != null) {
      return Math.max(videoStartTime, audioStartTime);
    } else {
      if (videoStartTime != null) {
        return videoStartTime;
      } else {
        if (audioStartTime != null) {
          return audioStartTime;
        } else {
          return time;
        }
      }
    }
  }

  /**
   * Update the buffering state to be either "we are buffering" or "we are not
   * buffering", firing events to the app as needed.
   *
   */
  private updateBufferState_() {
    const isBuffering = this.isBuffering();
    log.v2('Player changing buffering state to', isBuffering);

    // Make sure we have all the components we need before we consider ourselves
    // as being loaded.
    // TODO: Make the check for "loaded" simpler.
    const loaded = this.stats_ && this.bufferObserver_ && this.playhead_;
    if (loaded) {
      this.playRateController_.setBuffering(isBuffering);
      if (this.cmcdManager_) {
        this.cmcdManager_.setBuffering(isBuffering);
      }
      this.updateStateHistory_();
    }

    // Surface the buffering event so that the app knows if/when we are
    // buffering.
    const eventName = FakeEventExports.EventName.Buffering;
    const data = (new Map()).set('buffering', isBuffering);
    this.dispatchEvent(this.makeEvent_(eventName, data));
  }

  /**
   * A callback for when the playback rate changes. We need to watch the
   * playback rate so that if the playback rate on the media element changes
   * (that was not caused by our play rate controller) we can notify the
   * controller so that it can stay in-sync with the change.
   *
   */
  private onRateChange_() {
    const newRate: number = this.video_.playbackRate;

    // On Edge, when someone seeks using the native controls, it will set the
    // playback rate to zero until they finish seeking, after which it will
    // return the playback rate.
    // If the playback rate changes while seeking, Edge will cache the playback
    // rate and use it after seeking.
    // https://github.com/shaka-project/shaka-player/issues/951
    if (newRate == 0) {
      return;
    }
    if (this.playRateController_) {
      // The playback rate has changed. This could be us or someone else.
      // If this was us, setting the rate again will be a no-op.
      this.playRateController_.set(newRate);
    }
    const event = this.makeEvent_(FakeEventExports.EventName.RateChange);
    this.dispatchEvent(event);
  }

  /**
   * Try updating the state history. If the player has not finished
   * initializing, this will be a no-op.
   *
   */
  private updateStateHistory_() {
    // If we have not finish initializing, this will be a no-op.
    if (!this.stats_) {
      return;
    }
    if (!this.bufferObserver_) {
      return;
    }
    const State = BufferingObserverExports.State;
    const history = this.stats_.getStateHistory();
    if (this.bufferObserver_.getState() == State.STARVING) {
      history.update('buffering');
    } else {
      if (this.video_.paused) {
        history.update('paused');
      } else {
        if (this.video_.ended) {
          history.update('ended');
        } else {
          history.update('playing');
        }
      }
    }
  }

  /**
   * Callback from Playhead.
   *
   */
  private onSeek_() {
    if (this.playheadObservers_) {
      this.playheadObservers_.notifyOfSeek();
    }
    if (this.streamingEngine_) {
      this.streamingEngine_.seeked();
    }
    if (this.bufferObserver_) {
      // If we seek into an unbuffered range, we should fire a 'buffering' event
      // immediately.  If StreamingEngine can buffer fast enough, we may not
      // update our buffering tracking otherwise.
      this.pollBufferState_();
    }
  }

  /**
   * Update AbrManager with variants while taking into account restrictions,
   * preferences, and ABR.
   *
   * On error, this dispatches an error event and returns false.
   *
   * @return True if successful.
   */
  private updateAbrManagerVariants_(): boolean {
    try {
      asserts.assert(this.manifest_, 'Manifest should exist by now!');
      this.checkRestrictedVariants_(this.manifest_);
    } catch (e) {
      this.onError_(e);
      return false;
    }
    const playableVariants = this.manifest_.variants.filter((variant) => {
      return StreamUtils.isPlayable(variant);
    });

    // Update the abr manager with newly filtered variants.
    const adaptationSet =
        this.currentAdaptationSetCriteria_.create(playableVariants);
    this.abrManager_.setVariants(Array.from(adaptationSet.values()));
    return true;
  }

  /**
   * Chooses a variant from all possible variants while taking into account
   * restrictions, preferences, and ABR.
   *
   * On error, this dispatches an error event and returns null.
   *
   */
  private chooseVariant_(): shaka.extern.Variant|null {
    if (this.updateAbrManagerVariants_()) {
      return this.abrManager_.chooseVariant();
    } else {
      return null;
    }
  }

  /**
   * Re-apply restrictions to the variants, to re-enable variants that were
   * temporarily disabled due to network errors.
   * If any variants are enabled this way, a new variant might be chosen for
   * playback.
   */
  private checkVariants_() {
    const tracksChanged = StreamUtils.applyRestrictions(
        this.manifest_.variants, this.config_.restrictions, this.maxHwRes_);
    if (tracksChanged) {
      this.chooseVariant_();
    }
  }

  /**
   * Choose a text stream from all possible text streams while taking into
   * account user preference.
   *
   */
  private chooseTextStream_(): shaka.extern.Stream|null {
    const subset = StreamUtils.filterStreamsByLanguageAndRole(
        this.manifest_.textStreams, this.currentTextLanguage_,
        this.currentTextRole_, this.currentTextForced_);
    return subset[0] || null;
  }

  /**
   * Chooses a new Variant.  If the new variant differs from the old one, it
   * adds the new one to the switch history and switches to it.
   *
   * Called after a config change, a key status event, or an explicit language
   * change.
   *
   */
  private chooseVariantAndSwitch_() {
    asserts.assert(this.config_, 'Must not be destroyed');

    // Because we're running this after a config change (manual language
    // change) or a key status event, it is always okay to clear the buffer
    // here.
    const chosenVariant = this.chooseVariant_();
    if (chosenVariant) {
      this.switchVariant_(
          chosenVariant,
          /* fromAdaptation= */
          true,
          /* clearBuffers= */
          true,
          /* safeMargin= */
          0);
    }
  }

  private switchVariant_(
      variant: shaka.extern.Variant, fromAdaptation: boolean,
      clearBuffer: boolean, safeMargin: number) {
    const currentVariant = this.streamingEngine_.getCurrentVariant();
    if (variant == currentVariant) {
      log.debug('Variant already selected.');

      // If you want to clear the buffer, we force to reselect the same variant
      if (clearBuffer) {
        this.streamingEngine_.switchVariant(
            variant, clearBuffer, safeMargin,
            /* force= */
            true);
      }
      return;
    }

    // Add entries to the history.
    this.addVariantToSwitchHistory_(variant, fromAdaptation);
    this.streamingEngine_.switchVariant(variant, clearBuffer, safeMargin);
    let oldTrack = null;
    if (currentVariant) {
      oldTrack = StreamUtils.variantToTrack(currentVariant);
    }
    const newTrack = StreamUtils.variantToTrack(variant);
    if (fromAdaptation) {
      // Dispatch an 'adaptation' event
      this.onAdaptation_(oldTrack, newTrack);
    } else {
      // Dispatch a 'variantchanged' event
      this.onVariantChanged_(oldTrack, newTrack);
    }
  }

  private switchHtml5Track_(track: AudioTrack) {
    asserts.assert(
        this.video_ && this.video_.audioTracks,
        'Video and video.audioTracks should not be null!');
    const audioTracks = Array.from(this.video_.audioTracks);
    const currentTrack = audioTracks.find((t) => t.enabled);

    // This will reset the "enabled" of other tracks to false.
    track.enabled = true;

    // AirPlay does not reset the "enabled" of other tracks to false, so
    // it must be changed by hand.
    if (track.id !== currentTrack.id) {
      currentTrack.enabled = false;
    }
    const oldTrack = StreamUtils.html5AudioTrackToTrack(currentTrack);
    const newTrack = StreamUtils.html5AudioTrackToTrack(track);
    this.onVariantChanged_(oldTrack, newTrack);
  }

  /**
   * Decide during startup if text should be streamed/shown.
   */
  private setInitialTextState_(initialVariant, initialTextStream) {
    // Check if we should show text (based on difference between audio and text
    // languages).
    if (initialTextStream) {
      if (initialVariant.audio &&
          this.shouldInitiallyShowText_(
              initialVariant.audio, initialTextStream)) {
        this.isTextVisible_ = true;
      }
      if (this.isTextVisible_) {
        // If the cached value says to show text, then update the text displayer
        // since it defaults to not shown.
        this.mediaSourceEngine_.getTextDisplayer().setTextVisibility(true);
        asserts.assert(this.shouldStreamText_(), 'Should be streaming text');
      }
      this.onTextTrackVisibility_();
    } else {
      this.isTextVisible_ = false;
    }
  }

  /**
   * Check if we should show text on screen automatically.
   *
   */
  private shouldInitiallyShowText_(
      audioStream: shaka.extern.Stream,
      textStream: shaka.extern.Stream): boolean {
    const AutoShowText = AutoShowText;
    if (this.config_.autoShowText == AutoShowText.NEVER) {
      return false;
    }
    if (this.config_.autoShowText == AutoShowText.ALWAYS) {
      return true;
    }
    const LanguageUtils = LanguageUtils;
    const preferredTextLocale: string =
        LanguageUtils.normalize(this.config_.preferredTextLanguage);
    const textLocale: string = LanguageUtils.normalize(textStream.language);
    if (this.config_.autoShowText == AutoShowText.IF_PREFERRED_TEXT_LANGUAGE) {
      // Only the text language match matters.
      return LanguageUtils.areLanguageCompatible(
          textLocale, preferredTextLocale);
    }
    if (this.config_.autoShowText == AutoShowText.IF_SUBTITLES_MAY_BE_NEEDED) {
      /* The text should automatically be shown if the text is
       * language-compatible with the user's text language preference, but not
       * compatible with the audio.  These are cases where we deduce that
       * subtitles may be needed.
       *
       * For example:
       *   preferred | chosen | chosen |
       *   text      | text   | audio  | show
       *   -----------------------------------
       *   en-CA     | en     | jp     | true
       *   en        | en-US  | fr     | true
       *   fr-CA     | en-US  | jp     | false
       *   en-CA     | en-US  | en-US  | false
       *
       */
      const audioLocale: string = LanguageUtils.normalize(audioStream.language);
      return LanguageUtils.areLanguageCompatible(
                 textLocale, preferredTextLocale) &&
          !LanguageUtils.areLanguageCompatible(audioLocale, textLocale);
    }
    log.alwaysWarn('Invalid autoShowText setting!');
    return false;
  }

  /**
   * Callback from StreamingEngine.
   *
   */
  private onManifestUpdate_() {
    if (this.parser_ && this.parser_.update) {
      this.parser_.update();
    }
  }

  /**
   * Callback from StreamingEngine.
   *
   */
  private onSegmentAppended_(start, end, contentType) {
    // When we append a segment to media source (via streaming engine) we are
    // changing what data we have buffered, so notify the playhead of the
    // change.
    if (this.playhead_) {
      this.playhead_.notifyOfBufferingChange();
    }
    this.pollBufferState_();

    // Dispatch an event for users to consume, too.
    const data = (new Map())
                     .set('start', start)
                     .set('end', end)
                     .set('contentType', contentType);
    this.dispatchEvent(
        this.makeEvent_(FakeEventExports.EventName.SegmentAppended, data));
  }

  /**
   * Callback from AbrManager.
   *
   * @param safeMargin Optional amount of buffer (in seconds) to
   *   retain when clearing the buffer.
   *   Defaults to 0 if not provided. Ignored if clearBuffer is false.
   */
  private switch_(
      variant: shaka.extern.Variant, clearBuffer: boolean = false,
      safeMargin: number = 0) {
    log.debug('switch_');
    asserts.assert(
        this.config_.abr.enabled,
        'AbrManager should not call switch while disabled!');
    asserts.assert(
        this.manifest_,
        'We need a manifest to switch ' +
            'variants.');
    if (!this.streamingEngine_) {
      // There's no way to change it.
      return;
    }
    if (variant == this.streamingEngine_.getCurrentVariant()) {
      // This isn't a change.
      return;
    }
    this.switchVariant_(
        variant,
        /* fromAdaptation= */
        true, clearBuffer, safeMargin);
  }

  /**
   * Dispatches an 'adaptation' event.
   */
  private onAdaptation_(from: shaka.extern.Track|null, to: shaka.extern.Track) {
    // Delay the 'adaptation' event so that StreamingEngine has time to absorb
    // the changes before the user tries to query it.
    const data = (new Map()).set('oldTrack', from).set('newTrack', to);
    const event = this.makeEvent_(FakeEventExports.EventName.Adaptation, data);
    this.delayDispatchEvent_(event);
  }

  /**
   * Dispatches a 'trackschanged' event.
   */
  private onTracksChanged_() {
    // Delay the 'trackschanged' event so StreamingEngine has time to absorb the
    // changes before the user tries to query it.
    const event = this.makeEvent_(FakeEventExports.EventName.TracksChanged);
    this.delayDispatchEvent_(event);
  }

  /**
   * Dispatches a 'variantchanged' event.
   */
  private onVariantChanged_(
      from: shaka.extern.Track|null, to: shaka.extern.Track) {
    // Delay the 'variantchanged' event so StreamingEngine has time to absorb
    // the changes before the user tries to query it.
    const data = (new Map()).set('oldTrack', from).set('newTrack', to);
    const event =
        this.makeEvent_(FakeEventExports.EventName.VariantChanged, data);
    this.delayDispatchEvent_(event);
  }

  /**
   * Dispatches a 'textchanged' event.
   */
  private onTextChanged_() {
    // Delay the 'textchanged' event so StreamingEngine time to absorb the
    // changes before the user tries to query it.
    const event = this.makeEvent_(FakeEventExports.EventName.TextChanged);
    this.delayDispatchEvent_(event);
  }

  private onTextTrackVisibility_() {
    const event =
        this.makeEvent_(FakeEventExports.EventName.TextTrackVisibility);
    this.delayDispatchEvent_(event);
  }

  private onAbrStatusChanged_() {
    const data = (new Map()).set('newStatus', this.config_.abr.enabled);
    this.delayDispatchEvent_(
        this.makeEvent_(FakeEventExports.EventName.AbrStatusChanged, data));
  }

  /**
   * Tries to recover from NETWORK HTTP_ERROR, temporary disabling the current
   * problematic variant.
   */
  private tryToRecoverFromError_(error: Error): boolean {
    if (error.code != ErrorExports.Code.HTTP_ERROR &&
            error.code != ErrorExports.Code.SEGMENT_MISSING ||
        error.category != ErrorExports.Category.NETWORK) {
      return false;
    }
    if (!navigator.onLine) {
      // Don't restrict variants if we're completely offline, or else we end up
      // rapidly restricting all of them.
      return false;
    }
    let maxDisabledTime = this.config_.streaming.maxDisabledTime;
    if (maxDisabledTime == 0) {
      if (error.code == ErrorExports.Code.SEGMENT_MISSING) {
        // Spec:
        // https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis#section-6.3.3
        // The client SHOULD NOT attempt to load Media Segments that have been
        // marked with an EXT-X-GAP tag, or to load Partial Segments with a
        // GAP=YES attribute. Instead, clients are encouraged to look for
        // another Variant Stream of the same Rendition which does not have the
        // same gap, and play that instead.
        maxDisabledTime = 1;
      } else {
        return false;
      }
    }
    if (error.code == ErrorExports.Code.HTTP_ERROR) {
      log.debug('Recoverable NETWORK HTTP_ERROR, trying to recover...');
    }

    // Obtain the active variant and disable it from manifest variants
    const activeVariantTrack = this.getVariantTracks().find((t) => t.active);
    asserts.assert(activeVariantTrack, 'Active variant should be found');
    const manifest = this.manifest_;
    for (const variant of manifest.variants) {
      if (variant.id === activeVariantTrack.id) {
        variant.disabledUntilTime = Date.now() / 1000 + maxDisabledTime;
      }
    }

    // Apply restrictions in order to disable variants
    StreamUtils.applyRestrictions(
        manifest.variants, this.config_.restrictions, this.maxHwRes_);

    // Select for a new variant
    const chosenVariant = this.chooseVariant_();
    if (!chosenVariant) {
      log.warning('Not enough variants to recover from error');
      return false;
    }

    // Get the safeMargin to ensure a seamless playback
    const {video} = this.getBufferedInfo();
    const safeMargin =
        video.reduce((size, {start, end}) => size + end - start, 0);
    this.switchVariant_(
        chosenVariant,
        /* fromAdaptation= */
        false,
        /* clearBuffers= */
        true,
        /* safeMargin= */
        safeMargin);
    this.checkVariantsTimer_.tickAfter(maxDisabledTime);
    return true;
  }

  private onError_(error: Error) {
    asserts.assert(error instanceof Error, 'Wrong error type!');

    // Errors dispatched after |destroy| is called are not meaningful and should
    // be safe to ignore.
    if (this.loadMode_ == LoadMode.DESTROYED) {
      return;
    }
    if (this.tryToRecoverFromError_(error)) {
      error.handled = true;
      return;
    }
    const eventName = FakeEventExports.EventName.Error;
    const event = this.makeEvent_(eventName, (new Map()).set('detail', error));
    this.dispatchEvent(event);
    if (event.defaultPrevented) {
      error.handled = true;
    }
  }

  /**
   * When we fire region events, we need to copy the information out of the
   * region to break the connection with the player's internal data. We do the
   * copy here because this is the transition point between the player and the
   * app.
   *
   *
   */
  private onRegionEvent_(
      eventName: FakeEventExports.EventName,
      region: shaka.extern.TimelineRegionInfo) {
    // Always make a copy to avoid exposing our internal data to the app.
    const clone = {
      schemeIdUri: region.schemeIdUri,
      value: region.value,
      startTime: region.startTime,
      endTime: region.endTime,
      id: region.id,
      eventElement: region.eventElement
    };
    const data = (new Map()).set('detail', clone);
    this.dispatchEvent(this.makeEvent_(eventName, data));
  }

  /**
   * When notified of a media quality change we need to emit a
   * MediaQualityChange event to the app.
   *
   *
   */
  private onMediaQualityChange_(
      mediaQuality: shaka.extern.MediaQualityInfo, position: number) {
    // Always make a copy to avoid exposing our internal data to the app.
    const clone = {
      bandwidth: mediaQuality.bandwidth,
      audioSamplingRate: mediaQuality.audioSamplingRate,
      codecs: mediaQuality.codecs,
      contentType: mediaQuality.contentType,
      frameRate: mediaQuality.frameRate,
      height: mediaQuality.height,
      mimeType: mediaQuality.mimeType,
      channelsCount: mediaQuality.channelsCount,
      pixelAspectRatio: mediaQuality.pixelAspectRatio,
      width: mediaQuality.width
    };
    const data =
        (new Map()).set('mediaQuality', clone).set('position', position);
    this.dispatchEvent(
        this.makeEvent_(FakeEventExports.EventName.MediaQualityChanged, data));
  }

  /**
   * Turn the media element's error object into a Shaka Player error object.
   *
   */
  private videoErrorToShakaError_(): Error {
    asserts.assert(this.video_.error, 'Video error expected, but missing!');
    if (!this.video_.error) {
      return null;
    }
    const code = this.video_.error.code;

    /* MEDIA_ERR_ABORTED */
    if (code == 1) {
      // Ignore this error code, which should only occur when navigating away or
      // deliberately stopping playback of HTTP content.
      return null;
    }

    // Extra error information from MS Edge:
    let extended = this.video_.error.msExtendedCode;
    if (extended) {
      // Convert to unsigned:
      if (extended < 0) {
        extended += Math.pow(2, 32);
      }

      // Format as hex:
      extended = extended.toString(16);
    }

    // Extra error information from Chrome:
    const message = this.video_.error.message;
    return new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
        ErrorExports.Code.VIDEO_ERROR, code, extended, message);
  }

  private onVideoError_(event: Event) {
    const error = this.videoErrorToShakaError_();
    if (!error) {
      return;
    }
    this.onError_(error);
  }

  /**
   * @param keyStatusMap A map of hex key IDs to
   *   statuses.
   */
  private onKeyStatus_(keyStatusMap: {[key: string]: string}) {
    if (!this.streamingEngine_) {
      // We can't use this info to manage restrictions in src= mode, so ignore
      // it.
      return;
    }
    const keyIds = Object.keys(keyStatusMap);
    if (keyIds.length == 0) {
      log.warning(
          'Got a key status event without any key statuses, so we don\'t ' +
          'know the real key statuses. If we don\'t have all the keys, ' +
          'you\'ll need to set restrictions so we don\'t select those tracks.');
    }

    // If EME is using a synthetic key ID, the only key ID is '00' (a single 0
    // byte).  In this case, it is only used to report global success/failure.
    // See note about old platforms in: https://bit.ly/2tpez5Z
    const isGlobalStatus = keyIds.length == 1 && keyIds[0] == '00';
    if (isGlobalStatus) {
      log.warning(
          'Got a synthetic key status event, so we don\'t know the real key ' +
          'statuses. If we don\'t have all the keys, you\'ll need to set ' +
          'restrictions so we don\'t select those tracks.');
    }
    const restrictedStatuses = restrictedStatuses_;
    let tracksChanged = false;

    // Only filter tracks for keys if we have some key statuses to look at.
    if (keyIds.length) {
      for (const variant of this.manifest_.variants) {
        const streams = StreamUtils.getVariantStreams(variant);
        for (const stream of streams) {
          const originalAllowed = variant.allowedByKeySystem;

          // Only update if we have key IDs for the stream.  If the keys aren't
          // all present, then the track should be restricted.
          if (stream.keyIds.size) {
            variant.allowedByKeySystem = true;
            for (const keyId of stream.keyIds) {
              const keyStatus = keyStatusMap[isGlobalStatus ? '00' : keyId];
              variant.allowedByKeySystem = variant.allowedByKeySystem &&
                  !!keyStatus && !restrictedStatuses.includes(keyStatus);
            }
          }
          if (originalAllowed != variant.allowedByKeySystem) {
            tracksChanged = true;
          }
        }
      }
    }

    // for (const stream of streams)
    // for (const variant of this.manifest_.variants)
    // if (keyIds.size)
    if (tracksChanged) {
      const variantsUpdated = this.updateAbrManagerVariants_();
      if (!variantsUpdated) {
        return;
      }
    }
    const currentVariant = this.streamingEngine_.getCurrentVariant();
    if (currentVariant && !currentVariant.allowedByKeySystem) {
      log.debug('Choosing new streams after key status changed');
      this.chooseVariantAndSwitch_();
    }
    if (tracksChanged) {
      this.onTracksChanged_();
    }
  }

  /**
   * Callback from DrmEngine
   */
  private onExpirationUpdated_(keyId: string, expiration: number) {
    if (this.parser_ && this.parser_.onExpirationUpdated) {
      this.parser_.onExpirationUpdated(keyId, expiration);
    }
    const event = this.makeEvent_(FakeEventExports.EventName.ExpirationUpdated);
    this.dispatchEvent(event);
  }

  /**
   * @return true if we should stream text right now.
   */
  private shouldStreamText_(): boolean {
    return this.config_.streaming.alwaysStreamText || this.isTextTrackVisible();
  }

  /**
   * Applies playRangeStart and playRangeEnd to the given timeline. This will
   * only affect non-live content.
   *
   *
   */
  private static applyPlayRange_(
      timeline: PresentationTimeline, playRangeStart: number,
      playRangeEnd: number) {
    if (playRangeStart > 0) {
      if (timeline.isLive()) {
        log.warning(
            '|playRangeStart| has been configured for live content. ' +
            'Ignoring the setting.');
      } else {
        timeline.setUserSeekStart(playRangeStart);
      }
    }

    // If the playback has been configured to end before the end of the
    // presentation, update the duration unless it's live content.
    const fullDuration = timeline.getDuration();
    if (playRangeEnd < fullDuration) {
      if (timeline.isLive()) {
        log.warning(
            '|playRangeEnd| has been configured for live content. ' +
            'Ignoring the setting.');
      } else {
        timeline.setDuration(playRangeEnd);
      }
    }
  }

  /**
   * Checks if the variants are all restricted, and throw an appropriate
   * exception if so.
   *
   *
   */
  private checkRestrictedVariants_(manifest: shaka.extern.Manifest) {
    const restrictedStatuses = restrictedStatuses_;
    const keyStatusMap =
        this.drmEngine_ ? this.drmEngine_.getKeyStatuses() : {};
    const keyIds = Object.keys(keyStatusMap);
    const isGlobalStatus = keyIds.length && keyIds[0] == '00';
    let hasPlayable = false;
    let hasAppRestrictions = false;
    const missingKeys: Set<string> = new Set();
    const badKeyStatuses: Set<string> = new Set();
    for (const variant of manifest.variants) {
      // TODO: Combine with onKeyStatus_.
      const streams = [];
      if (variant.audio) {
        streams.push(variant.audio);
      }
      if (variant.video) {
        streams.push(variant.video);
      }
      for (const stream of streams) {
        if (stream.keyIds.size) {
          for (const keyId of stream.keyIds) {
            const keyStatus = keyStatusMap[isGlobalStatus ? '00' : keyId];
            if (!keyStatus) {
              missingKeys.add(keyId);
            } else {
              if (restrictedStatuses.includes(keyStatus)) {
                badKeyStatuses.add(keyStatus);
              }
            }
          }
        }
      }

      // if (stream.keyIds.size)
      if (!variant.allowedByApplication) {
        hasAppRestrictions = true;
      } else {
        if (variant.allowedByKeySystem) {
          hasPlayable = true;
        }
      }
    }
    if (!hasPlayable) {
      const data: shaka.extern.RestrictionInfo = {
        hasAppRestrictions,
        missingKeys: Array.from(missingKeys),
        restrictedKeyStatuses: Array.from(badKeyStatuses)
      };
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.RESTRICTIONS_CANNOT_BE_MET, data);
    }
  }

  /**
   * Confirm some variants are playable. Otherwise, throw an exception.
   */
  private checkPlayableVariants_(manifest: shaka.extern.Manifest) {
    const valid = manifest.variants.some(StreamUtils.isPlayable);

    // If none of the variants are playable, throw
    // CONTENT_UNSUPPORTED_BY_BROWSER.
    if (!valid) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.CONTENT_UNSUPPORTED_BY_BROWSER);
    }
  }

  /**
   * Fire an event, but wait a little bit so that the immediate execution can
   * complete before the event is handled.
   *
   */
  private async delayDispatchEvent_(event: FakeEvent) {
    // Wait until the next interpreter cycle.
    await Promise.resolve();

    // Only dispatch the event if we are still alive.
    if (this.loadMode_ != LoadMode.DESTROYED) {
      this.dispatchEvent(event);
    }
  }

  /**
   * Get the normalized languages for a group of tracks.
   *
   */
  private static getLanguagesFrom_(tracks: (shaka.extern.Track|null)[]):
      Set<string> {
    const languages = new Set();
    for (const track of tracks) {
      if (track.language) {
        languages.add(LanguageUtils.normalize(track.language));
      } else {
        languages.add('und');
      }
    }
    return languages;
  }

  /**
   * Get all permutations of normalized languages and role for a group of
   * tracks.
   *
   */
  private static getLanguageAndRolesFrom_(tracks: (shaka.extern.Track|null)[]):
      shaka.extern.LanguageRole[] {
    const languageToRoles: Map<string, Set> = new Map();
    const languageRoleToLabel: Map<string, Map<string, string>> = new Map();
    for (const track of tracks) {
      let language = 'und';
      let roles = [];
      if (track.language) {
        language = LanguageUtils.normalize(track.language);
      }
      if (track.type == 'variant') {
        roles = track.audioRoles;
      } else {
        roles = track.roles;
      }
      if (!roles || !roles.length) {
        // We must have an empty role so that we will still get a language-role
        // entry from our Map.
        roles = [''];
      }
      if (!languageToRoles.has(language)) {
        languageToRoles.set(language, new Set());
      }
      for (const role of roles) {
        languageToRoles.get(language).add(role);
        if (track.label) {
          if (!languageRoleToLabel.has(language)) {
            languageRoleToLabel.set(language, new Map());
          }
          languageRoleToLabel.get(language).set(role, track.label);
        }
      }
    }

    // Flatten our map to an array of language-role pairs.
    const pairings = [];
    languageToRoles.forEach((roles, language) => {
      for (const role of roles) {
        let label = null;
        if (languageRoleToLabel.has(language) &&
            languageRoleToLabel.get(language).has(role)) {
          label = languageRoleToLabel.get(language).get(role);
        }
        pairings.push({language, role, label});
      }
    });
    return pairings;
  }

  /**
   * Assuming the player is playing content with media source, check if the
   * player has buffered enough content to make it to the end of the
   * presentation.
   *
   */
  private isBufferedToEndMS_(): boolean {
    asserts.assert(
        this.video_, 'We need a video element to get buffering information');
    asserts.assert(
        this.mediaSourceEngine_,
        'We need a media source engine to get buffering information');
    asserts.assert(
        this.manifest_, 'We need a manifest to get buffering information');

    // This is a strong guarantee that we are buffered to the end, because it
    // means the playhead is already at that end.
    if (this.video_.ended) {
      return true;
    }

    // This means that MediaSource has buffered the final segment in all
    // SourceBuffers and is no longer accepting additional segments.
    if (this.mediaSourceEngine_.ended()) {
      return true;
    }

    // Live streams are "buffered to the end" when they have buffered to the
    // live edge or beyond (into the region covered by the presentation delay).
    if (this.manifest_.presentationTimeline.isLive()) {
      const liveEdge =
          this.manifest_.presentationTimeline.getSegmentAvailabilityEnd();
      const bufferEnd = TimeRangesUtils.bufferEnd(this.video_.buffered);
      if (bufferEnd != null && bufferEnd >= liveEdge) {
        return true;
      }
    }
    return false;
  }

  /**
   * Assuming the player is playing content with src=, check if the player has
   * buffered enough content to make it to the end of the presentation.
   *
   */
  private isBufferedToEndSrc_(): boolean {
    asserts.assert(
        this.video_, 'We need a video element to get buffering information');

    // This is a strong guarantee that we are buffered to the end, because it
    // means the playhead is already at that end.
    if (this.video_.ended) {
      return true;
    }

    // If we have buffered to the duration of the content, it means we will have
    // enough content to buffer to the end of the presentation.
    const bufferEnd = TimeRangesUtils.bufferEnd(this.video_.buffered);

    // Because Safari's native HLS reports slightly inaccurate values for
    // bufferEnd here, we use a fudge factor.  Without this, we can end up in a
    // buffering state at the end of the stream.  See issue #2117.
    // TODO: Try to remove the fudge here once we no longer manage buffering
    // state above the browser with playbackRate=0.
    const fudge = 1;

    // 1000 ms
    return bufferEnd != null && bufferEnd >= this.video_.duration - fudge;
  }

  /**
   * Create an error for when we purposely interrupt a load operation.
   *
   */
  private createAbortLoadError_(): Error {
    return new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
        ErrorExports.Code.LOAD_INTERRUPTED);
  }

  /**
   * Key
   * ----------------------
   * D   : Detach Node
   * A   : Attach Node
   * MS  : Media Source Node
   * P   : Manifest Parser Node
   * M   : Manifest Node
   * DRM : Drm Engine Node
   * L   : Load Node
   * U   : Unloading Node
   * SRC : Src Equals Node
   *
   * Graph Topology
   * ----------------------
   *
   *        [SRC]-----+
   *         ^        |
   *         |        v
   * [D]<-->[A]<-----[U]
   *         |        ^
   *         v        |
   *        [MS]------+
   *         |        |
   *         v        |
   *        [P]-------+
   *         |        |
   *         v        |
   *        [M]-------+
   *         |        |
   *         v        |
   *        [DRM]-----+
   *         |        |
   *         v        |
   *        [L]-------+
   *
   */
  private getNextStep_(
      currentlyAt: Node, currentlyWith: Payload, wantsToBeAt: Node,
      wantsToHave: Payload): Node|null {
    let next = null;

    // Detach is very simple, either stay in detach (because |detach| was called
    // while in detached) or go somewhere that requires us to attach to an
    // element.
    if (currentlyAt == this.detachNode_) {
      next =
          wantsToBeAt == this.detachNode_ ? this.detachNode_ : this.attachNode_;
    }
    if (currentlyAt == this.attachNode_) {
      next = this.getNextAfterAttach_(wantsToBeAt, currentlyWith, wantsToHave);
    }
    if (currentlyAt == this.mediaSourceNode_) {
      next = this.getNextAfterMediaSource_(
          wantsToBeAt, currentlyWith, wantsToHave);
    }
    if (currentlyAt == this.parserNode_) {
      next = this.getNextMatchingAllDependencies_(
          /* destination= */
          this.loadNode_, this.manifestNode_,
          /* next= */
          this.unloadNode_,
          /* reset= */
          wantsToBeAt,
          /* goingTo= */
          currentlyWith,
          /* has= */
          wantsToHave);
    }

    /* wants= */
    if (currentlyAt == this.manifestNode_) {
      next = this.getNextMatchingAllDependencies_(
          /* destination= */
          this.loadNode_, this.drmNode_,
          /* next= */
          this.unloadNode_,
          /* reset= */
          wantsToBeAt,
          /* goingTo= */
          currentlyWith,
          /* has= */
          wantsToHave);
    }

    /* wants= */

    // For DRM, we have two options "load" or "unload". If all our constraints
    // are met, we can go to "load". If anything is off, we must go back to
    // "unload" to reset.
    if (currentlyAt == this.drmNode_) {
      next = this.getNextMatchingAllDependencies_(
          /* destination= */
          this.loadNode_, this.loadNode_,
          /* next= */
          this.unloadNode_,
          /* reset= */
          wantsToBeAt,
          /* goingTo= */
          currentlyWith,
          /* has= */
          wantsToHave);
    }

    /* wants= */

    // For DRM w/ src= playback, we only care about destination and media
    // element.
    if (currentlyAt == this.srcEqualsDrmNode_) {
      if (wantsToBeAt == this.srcEqualsNode_ &&
          currentlyWith.mediaElement == wantsToHave.mediaElement) {
        next = this.srcEqualsNode_;
      } else {
        next = this.unloadNode_;
      }
    }

    // After we load content, always go through unload because we can't safely
    // use components after we have started playback.
    if (currentlyAt == this.loadNode_ || currentlyAt == this.srcEqualsNode_) {
      next = this.unloadNode_;
    }
    if (currentlyAt == this.unloadNode_) {
      next = this.getNextAfterUnload_(wantsToBeAt, currentlyWith, wantsToHave);
    }
    asserts.assert(next, 'Missing next step!');
    return next;
  }

  private getNextAfterAttach_(goingTo: Node, has: Payload, wants: Payload): Node
      |null {
    // Attach and detach are the only two nodes that we can directly go
    // back-and-forth between.
    if (goingTo == this.detachNode_) {
      return this.detachNode_;
    }

    // If we are going anywhere other than detach, then we need the media
    // element to match, if they don't match, we need to go through detach
    // first.
    if (has.mediaElement != wants.mediaElement) {
      return this.detachNode_;
    }

    // If we are already in attached, and someone calls |attach| again (to the
    // same video element), we can handle the redundant request by re-entering
    // our current state.
    if (goingTo == this.attachNode_) {
      return this.attachNode_;
    }

    // The next step from attached to loaded is through media source.
    if (goingTo == this.mediaSourceNode_ || goingTo == this.loadNode_) {
      return this.mediaSourceNode_;
    }

    // If we are going to src=, then we should set up DRM first.  This will
    // support cases like FairPlay HLS on Safari.
    if (goingTo == this.srcEqualsNode_) {
      return this.srcEqualsDrmNode_;
    }

    // We are missing a rule, the null will get caught by a common check in
    // the routing system.
    return null;
  }

  private getNextAfterMediaSource_(goingTo: Node, has: Payload, wants: Payload):
      Node|null {
    // We can only go to parse manifest or unload. If we want to go to load and
    // we have the right media element, we can go to parse manifest. If we
    // don't, no matter where we want to go, we must go through unload.
    if (goingTo == this.loadNode_ && has.mediaElement == wants.mediaElement) {
      return this.parserNode_;
    }

    // Right now the unload node is responsible for tearing down all playback
    // components (including media source). So since we have created media
    // source, we need to unload since our dependencies are not compatible.
    // TODO: We are structured this way to maintain a historic structure. Going
    //       forward, there is no reason to restrict ourselves to this. Going
    //       forward we should explore breaking apart |onUnload| and develop
    //       more meaningful terminology around tearing down playback resources.
    return this.unloadNode_;
  }

  /**
   * After unload there are only two options, attached or detached. This choice
   * is based on whether or not we have a media element. If we have a media
   * element, then we go to attach. If we don't have a media element, we go to
   * detach.
   *
   */
  private getNextAfterUnload_(goingTo: Node, has: Payload, wants: Payload): Node
      |null {
    // If we don't want a media element, detach.
    // If we have the wrong media element, detach.
    // Otherwise it means we want to attach to a media element and it is safe to
    // do so.
    return !wants.mediaElement || has.mediaElement != wants.mediaElement ?
        this.detachNode_ :
        this.attachNode_;
  }

  /**
   * A general method used to handle routing when we can either than one step
   * toward our destination (while all our dependencies match) or go to a node
   * that will reset us so we can try again.
   *
   *   What |goingTo| must be for us to step toward |nextNode|. Otherwise we
   *   will go to |resetNode|.
   *   The node we will go to next if |goingTo == destinationNode| and all
   *   dependencies match.
   *   The node we will go to next if |goingTo != destinationNode| or any
   *   dependency does not match.
   *   The node that the walker is trying to go to.
   *   The payload that the walker currently has.
   *   The payload that the walker wants to have when iy gets to |goingTo|.
   */
  private getNextMatchingAllDependencies_(
      destinationNode: Node, nextNode: Node, resetNode: Node, goingTo: Node,
      has: Payload, wants: Payload): Node {
    if (goingTo == destinationNode && has.mediaElement == wants.mediaElement &&
        has.uri == wants.uri && has.mimeType == wants.mimeType) {
      return nextNode;
    }
    return resetNode;
  }

  private static createEmptyPayload_(): Payload {
    return {
      mediaElement: null,
      mimeType: null,
      startTime: null,
      startTimeOfLoad: NaN,
      uri: null
    };
  }

  /**
   * Using a promise, wrap the listeners returned by |Walker.startNewRoute|.
   * This will work for most usages in |Player| but should not be used for
   * special cases.
   *
   * This will connect |onCancel|, |onEnd|, |onError|, and |onSkip| with
   * |resolve| and |reject| but will leave |onStart| unset.
   *
   */
  private wrapWalkerListenersWithPromise_(listeners: WalkerExports.Listeners):
      Promise {
    return new Promise((resolve, reject) => {
      listeners.onCancel = () => reject(this.createAbortLoadError_());
      listeners.onEnd = () => resolve();
      listeners.onError = (e) => reject(e);
      listeners.onSkip = () => reject(this.createAbortLoadError_());
    });
  }
}

/**
 * In order to know what method of loading the player used for some content, we
 * have this enum. It lets us know if content has not been loaded, loaded with
 * media source, or loaded with src equals.
 *
 * This enum has a low resolution, because it is only meant to express the
 * outer limits of the various states that the player is in. For example, when
 * someone calls a public method on player, it should not matter if they have
 * initialized drm engine, it should only matter if they finished loading
 * content.
 *
 * @export
 */
export enum LoadMode {
  DESTROYED,
  NOT_LOADED,
  MEDIA_SOURCE,
  SRC_EQUALS
}

/**
 * The typical buffering threshold.  When we have less than this buffered (in
 * seconds), we enter a buffering state.  This specific value is based on manual
 * testing and evaluation across a variety of platforms.
 *
 * To make the buffering logic work in all cases, this "typical" threshold will
 * be overridden if the rebufferingGoal configuration is too low.
 *
 */
export const TYPICAL_BUFFERING_THRESHOLD_: number = 0.5;

/**
 * @define {string} A version number taken from git at compile time.
 * @export
 */
export const version: string = 'v4.2.0-uncompiled';

// Initialize the deprecation system using the version string we just set
// on the player.
Deprecate.init(version);

/**
 * These are the EME key statuses that represent restricted playback.
 * 'usable', 'released', 'output-downscaled', 'status-pending' are statuses
 * of the usable keys.  'expired' status is being handled separately in
 * DrmEngine.
 *
 */
export const restrictedStatuses_: string[] =
    ['output-restricted', 'internal-error'];
  
export let supportPlugins_ = {};

export let adManagerFactory_: Factory|null = null;

export const SRC_EQUAL_EXTENSIONS_TO_MIME_TYPES_: {[key: string]: string} = {
  'mp4': 'video/mp4',
  'm4v': 'video/mp4',
  'm4a': 'audio/mp4',
  'webm': 'video/webm',
  'weba': 'audio/webm',
  'mkv': 'video/webm',
  // Chromium browsers supports it.
  'ts': 'video/mp2t',
  'ogv': 'video/ogg',
  'ogg': 'audio/ogg',
  'mpg': 'video/mpeg',
  'mpeg': 'video/mpeg',
  'm3u8': 'application/x-mpegurl',
  'mpd': 'application/dash+xml',
  'mp3': 'audio/mpeg',
  'aac': 'audio/aac',
  'flac': 'audio/flac',
  'wav': 'audio/wav'
};

export const TEXT_EXTENSIONS_TO_MIME_TYPES_: {[key: string]: string} = {
  'sbv': 'text/x-subviewer',
  'srt': 'text/srt',
  'vtt': 'text/vtt',
  'webvtt': 'text/vtt',
  'ttml': 'application/ttml+xml',
  'lrc': 'application/x-subtitle-lrc',
  'ssa': 'text/x-ssa',
  'ass': 'text/x-ssa'
};

export const TextTrackLabel: string = 'Shaka Player TextTrack';
