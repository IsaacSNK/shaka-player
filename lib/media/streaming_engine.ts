/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 * @suppress {missingRequire} TODO(b/152540451): this shouldn't be needed
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as logExports from './debug___log';
import {log} from './debug___log';
import * as MediaSourceEngineExports from './media___media_source_engine';
import {MediaSourceEngine} from './media___media_source_engine';
import {SegmentIterator} from './media___segment_index';
import * as SegmentReferenceExports from './media___segment_reference';
import {InitSegmentReference, SegmentReference} from './media___segment_reference';
import {Backoff} from './net___backoff';
import * as NetworkingEngineExports from './net___networking_engine';
import {NetworkingEngine} from './net___networking_engine';
import {SegmentInfo} from './util___cmcd_manager';
import {DelayedTick} from './util___delayed_tick';
import {Destroyer} from './util___destroyer';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import * as FakeEventExports from './util___fake_event';
import {FakeEvent} from './util___fake_event';
import {IDestroyable} from './util___i_destroyable';
import * as ManifestParserUtilsExports from './util___manifest_parser_utils';
import {ManifestParserUtils} from './util___manifest_parser_utils';
import * as MimeUtilsExports from './util___mime_utils';
import {MimeUtils} from './util___mime_utils';
import * as Mp4ParserExports from './util___mp4_parser';
import {Mp4Parser} from './util___mp4_parser';
import {Networking} from './util___networking';

/**
 * @summary Creates a Streaming Engine.
 * The StreamingEngine is responsible for setting up the Manifest's Streams
 * (i.e., for calling each Stream's createSegmentIndex() function), for
 * downloading segments, for co-ordinating audio, video, and text buffering.
 * The StreamingEngine provides an interface to switch between Streams, but it
 * does not choose which Streams to switch to.
 *
 * The StreamingEngine does not need to be notified about changes to the
 * Manifest's SegmentIndexes; however, it does need to be notified when new
 * Variants are added to the Manifest.
 *
 * To start the StreamingEngine the owner must first call configure(), followed
 * by one call to switchVariant(), one optional call to switchTextStream(), and
 * finally a call to start().  After start() resolves, switch*() can be used
 * freely.
 *
 * The owner must call seeked() each time the playhead moves to a new location
 * within the presentation timeline; however, the owner may forego calling
 * seeked() when the playhead moves outside the presentation timeline.
 *
 */
export class StreamingEngine implements IDestroyable {
  private playerInterface_: PlayerInterface|null;
  private manifest_: shaka.extern.Manifest|null;
  private config_: shaka.extern.StreamingConfiguration|null = null;
  private bufferingGoalScale_: number = 1;
  private currentVariant_: shaka.extern.Variant|null = null;
  private currentTextStream_: shaka.extern.Stream|null = null;

  /**
   * Maps a content type, e.g., 'audio', 'video', or 'text', to a MediaState.
   *
   * {!Map.<shaka.util.ManifestParserUtils.ContentType,
   *                 !shaka.media.StreamingEngine.MediaState_>}
   */
  private mediaStates_:
      Map<ManifestParserUtilsExports.ContentType, MediaState_>;

  /**
   * Set to true once the initial media states have been created.
   *
   */
  private startupComplete_: boolean = false;

  /**
   * Used for delay and backoff of failure callbacks, so that apps do not
   * retry instantly.
   *
   */
  private failureCallbackBackoff_: Backoff = null;

  /**
   * Set to true on fatal error.  Interrupts fetchAndAppend_().
   *
   */
  private fatalError_: boolean = false;
  private destroyer_: Destroyer;

  constructor(
      manifest: shaka.extern.Manifest, playerInterface: PlayerInterface) {
    this.playerInterface_ = playerInterface;
    this.manifest_ = manifest;
    this.mediaStates_ = new Map();
    this.destroyer_ = new Destroyer(() => this.doDestroy_());
  }

  /** @override */
  destroy() {
    return this.destroyer_.destroy();
  }

  private async doDestroy_(): Promise {
    const aborts = [];
    for (const state of this.mediaStates_.values()) {
      this.cancelUpdate_(state);
      aborts.push(this.abortOperations_(state));
    }
    await Promise.all(aborts);
    this.mediaStates_.clear();
    this.playerInterface_ = null;
    this.manifest_ = null;
    this.config_ = null;
  }

  /**
   * Called by the Player to provide an updated configuration any time it
   * changes. Must be called at least once before start().
   *
   */
  configure(config: shaka.extern.StreamingConfiguration) {
    this.config_ = config;

    // Create separate parameters for backoff during streaming failure.
    const failureRetryParams: shaka.extern.RetryParameters = {
      // The term "attempts" includes the initial attempt, plus all retries.
      // In order to see a delay, there would have to be at least 2 attempts.
      maxAttempts: Math.max(config.retryParameters.maxAttempts, 2),
      baseDelay: config.retryParameters.baseDelay,
      backoffFactor: config.retryParameters.backoffFactor,
      fuzzFactor: config.retryParameters.fuzzFactor,
      timeout: 0,
      // irrelevant
      stallTimeout: 0,
      // irrelevant
      connectionTimeout: 0
    };

    // irrelevant

    // We don't want to ever run out of attempts.  The application should be
    // allowed to retry streaming infinitely if it wishes.
    const autoReset = true;
    this.failureCallbackBackoff_ = new Backoff(failureRetryParams, autoReset);
  }

  /**
   * Initialize and start streaming.
   *
   * By calling this method, StreamingEngine will start streaming the variant
   * chosen by a prior call to switchVariant(), and optionally, the text stream
   * chosen by a prior call to switchTextStream().  Once the Promise resolves,
   * switch*() may be called freely.
   *
   */
  async start(): Promise {
    asserts.assert(
        this.config_,
        'StreamingEngine configure() must be called before init()!');

    // Setup the initial set of Streams and then begin each update cycle.
    await this.initStreams_();
    this.destroyer_.ensureNotDestroyed();
    log.debug('init: completed initial Stream setup');
    this.startupComplete_ = true;
  }

  /**
   * Get the current variant we are streaming.  Returns null if nothing is
   * streaming.
   */
  getCurrentVariant(): shaka.extern.Variant|null {
    return this.currentVariant_;
  }

  /**
   * Get the text stream we are streaming.  Returns null if there is no text
   * streaming.
   */
  getCurrentTextStream(): shaka.extern.Stream|null {
    return this.currentTextStream_;
  }

  /**
   * Start streaming text, creating a new media state.
   *
   */
  private async loadNewTextStream_(stream: shaka.extern.Stream): Promise {
    const ContentType = ManifestParserUtilsExports.ContentType;
    asserts.assert(
        !this.mediaStates_.has(ContentType.TEXT),
        'Should not call loadNewTextStream_ while streaming text!');
    try {
      // Clear MediaSource's buffered text, so that the new text stream will
      // properly replace the old buffered text.
      // TODO: Should this happen in unloadTextStream() instead?
      await this.playerInterface_.mediaSourceEngine.clear(ContentType.TEXT);
    } catch (error) {
      if (this.playerInterface_) {
        this.playerInterface_.onError(error);
      }
    }
    const mimeType = MimeUtils.getFullType(stream.mimeType, stream.codecs);
    this.playerInterface_.mediaSourceEngine.reinitText(
        mimeType, this.manifest_.sequenceMode);
    const textDisplayer =
        this.playerInterface_.mediaSourceEngine.getTextDisplayer();
    const streamText =
        textDisplayer.isTextVisible() || this.config_.alwaysStreamText;
    if (streamText) {
      const state = this.createMediaState_(stream);
      this.mediaStates_.set(ContentType.TEXT, state);
      this.scheduleUpdate_(state, 0);
    }
  }

  /**
   * Stop fetching text stream when the user chooses to hide the captions.
   */
  unloadTextStream() {
    const ContentType = ManifestParserUtilsExports.ContentType;
    const state = this.mediaStates_.get(ContentType.TEXT);
    if (state) {
      this.cancelUpdate_(state);
      this.abortOperations_(state).catch(() => {});
      this.mediaStates_.delete(ContentType.TEXT);
    }
    this.currentTextStream_ = null;
  }

  /**
   * Set trick play on or off.
   * If trick play is on, related trick play streams will be used when possible.
   */
  setTrickPlay(on: boolean) {
    const ContentType = ManifestParserUtilsExports.ContentType;
    const mediaState = this.mediaStates_.get(ContentType.VIDEO);
    if (!mediaState) {
      return;
    }
    const stream = mediaState.stream;
    if (!stream) {
      return;
    }
    log.debug('setTrickPlay', on);
    if (on) {
      const trickModeVideo = stream.trickModeVideo;
      if (!trickModeVideo) {
        return;
      }

      // Can't engage trick play.
      const normalVideo = mediaState.restoreStreamAfterTrickPlay;
      if (normalVideo) {
        return;
      }

      // Already in trick play.
      log.debug('Engaging trick mode stream', trickModeVideo);
      this.switchInternal_(
          trickModeVideo,
          /* clearBuffer= */
          false,
          /* safeMargin= */
          0,
          /* force= */
          false);
      mediaState.restoreStreamAfterTrickPlay = stream;
    } else {
      const normalVideo = mediaState.restoreStreamAfterTrickPlay;
      if (!normalVideo) {
        return;
      }
      log.debug('Restoring non-trick-mode stream', normalVideo);
      mediaState.restoreStreamAfterTrickPlay = null;
      this.switchInternal_(
          normalVideo,
          /* clearBuffer= */
          true,
          /* safeMargin= */
          0,
          /* force= */
          false);
    }
  }

  /**
   *   If true, reload the variant even if it did not change.
   */
  switchVariant(
      variant: shaka.extern.Variant, clearBuffer: boolean = false,
      safeMargin: number = 0, force: boolean = false) {
    this.currentVariant_ = variant;
    if (!this.startupComplete_) {
      // The selected variant will be used in start().
      return;
    }
    if (variant.video) {
      this.switchInternal_(
          variant.video,
          /* clearBuffer= */
          clearBuffer,
          /* safeMargin= */
          safeMargin,
          /* force= */
          force);
    }
    if (variant.audio) {
      this.switchInternal_(
          variant.audio,
          /* clearBuffer= */
          clearBuffer,
          /* safeMargin= */
          safeMargin,
          /* force= */
          force);
    }
  }

  switchTextStream(textStream: shaka.extern.Stream) {
    this.currentTextStream_ = textStream;
    if (!this.startupComplete_) {
      // The selected text stream will be used in start().
      return;
    }
    const ContentType = ManifestParserUtilsExports.ContentType;
    asserts.assert(
        textStream && textStream.type == ContentType.TEXT,
        'Wrong stream type passed to switchTextStream!');
    this.switchInternal_(
        textStream,
        /* clearBuffer= */
        true,
        /* safeMargin= */
        0,
        /* force= */
        false);
  }

  /** Reload the current text stream. */
  reloadTextStream() {
    const ContentType = ManifestParserUtilsExports.ContentType;
    const mediaState = this.mediaStates_.get(ContentType.TEXT);
    if (mediaState) {
      // Don't reload if there's no text to begin with.
      this.switchInternal_(
          mediaState.stream,
          /* clearBuffer= */
          true,
          /* safeMargin= */
          0,
          /* force= */
          true);
    }
  }

  /**
   * Switches to the given Stream. |stream| may be from any Variant.
   *
   *   If true, reload the text stream even if it did not change.
   */
  private switchInternal_(
      stream: shaka.extern.Stream, clearBuffer: boolean, safeMargin: number,
      force: boolean) {
    const ContentType = ManifestParserUtilsExports.ContentType;
    const type = (stream.type as ContentType);
    const mediaState = this.mediaStates_.get(type);
    if (!mediaState && stream.type == ContentType.TEXT) {
      this.loadNewTextStream_(stream);
      return;
    }
    asserts.assert(mediaState, 'switch: expected mediaState to exist');
    if (!mediaState) {
      return;
    }
    if (mediaState.restoreStreamAfterTrickPlay) {
      log.debug('switch during trick play mode', stream);

      // Already in trick play mode, so stick with trick mode tracks if
      // possible.
      if (stream.trickModeVideo) {
        // Use the trick mode stream, but revert to the new selection later.
        mediaState.restoreStreamAfterTrickPlay = stream;
        stream = stream.trickModeVideo;
        log.debug('switch found trick play stream', stream);
      } else {
        // There is no special trick mode video for this stream!
        mediaState.restoreStreamAfterTrickPlay = null;
        log.debug('switch found no special trick play stream');
      }
    }
    if (mediaState.stream == stream && !force) {
      const streamTag = StreamingEngine.logPrefix_(mediaState);
      log.debug('switch: Stream ' + streamTag + ' already active');
      return;
    }
    if (stream.type == ContentType.TEXT) {
      // Mime types are allowed to change for text streams.
      // Reinitialize the text parser, but only if we are going to fetch the
      // init segment again.
      const fullMimeType =
          MimeUtils.getFullType(stream.mimeType, stream.codecs);
      this.playerInterface_.mediaSourceEngine.reinitText(
          fullMimeType, this.manifest_.sequenceMode);
    }

    // Releases the segmentIndex of the old stream.
    if (mediaState.stream.closeSegmentIndex) {
      mediaState.stream.closeSegmentIndex();
    }
    mediaState.stream = stream;
    mediaState.segmentIterator = null;
    const streamTag = StreamingEngine.logPrefix_(mediaState);
    log.debug('switch: switching to Stream ' + streamTag);
    if (clearBuffer) {
      if (mediaState.clearingBuffer) {
        // We are already going to clear the buffer, but make sure it is also
        // flushed.
        mediaState.waitingToFlushBuffer = true;
      } else {
        if (mediaState.performingUpdate) {
          // We are performing an update, so we have to wait until it's
          // finished. onUpdate_() will call clearBuffer_() when the update has
          // finished. We need to save the safe margin because its value will be
          // needed when clearing the buffer after the update.
          mediaState.waitingToClearBuffer = true;
          mediaState.clearBufferSafeMargin = safeMargin;
          mediaState.waitingToFlushBuffer = true;
        } else {
          // Cancel the update timer, if any.
          this.cancelUpdate_(mediaState);

          // Clear right away.
          this.clearBuffer_(
                  mediaState,
                  /* flush= */
                  true, safeMargin)
              .catch((error) => {
                if (this.playerInterface_) {
                  asserts.assert(error instanceof Error, 'Wrong error type!');
                  this.playerInterface_.onError(error);
                }
              });
        }
      }
    }
    this.makeAbortDecision_(mediaState).catch((error) => {
      if (this.playerInterface_) {
        asserts.assert(error instanceof Error, 'Wrong error type!');
        this.playerInterface_.onError(error);
      }
    });
  }

  /**
   * Decide if it makes sense to abort the current operation, and abort it if
   * so.
   *
   */
  private async makeAbortDecision_(mediaState: MediaState_) {
    // If the operation is completed, it will be set to null, and there's no
    // need to abort the request.
    if (!mediaState.operation) {
      return;
    }
    const originalStream = mediaState.stream;
    const originalOperation = mediaState.operation;
    if (!originalStream.segmentIndex) {
      // Create the new segment index so the time taken is accounted for when
      // deciding whether to abort.
      await originalStream.createSegmentIndex();
    }
    if (mediaState.operation != originalOperation) {
      // The original operation completed while we were getting a segment index,
      // so there's nothing to do now.
      return;
    }
    if (mediaState.stream != originalStream) {
      // The stream changed again while we were getting a segment index.  We
      // can't carry out this check, since another one might be in progress by
      // now.
      return;
    }
    asserts.assert(
        mediaState.stream.segmentIndex, 'Segment index should exist by now!');
    if (this.shouldAbortCurrentRequest_(mediaState)) {
      log.info('Aborting current segment request.');
      mediaState.operation.abort();
    }
  }

  /**
   * Returns whether we should abort the current request.
   *
   */
  private shouldAbortCurrentRequest_(mediaState: MediaState_): boolean {
    asserts.assert(
        mediaState.operation, 'Abort logic requires an ongoing operation!');
    asserts.assert(
        mediaState.stream && mediaState.stream.segmentIndex,
        'Abort logic requires a segment index');
    const presentationTime = this.playerInterface_.getPresentationTime();
    const bufferEnd =
        this.playerInterface_.mediaSourceEngine.bufferEnd(mediaState.type);

    // The next segment to append from the current stream.  This doesn't
    // account for a pending network request and will likely be different from
    // that since we just switched.
    const timeNeeded = this.getTimeNeeded_(mediaState, presentationTime);
    const index = mediaState.stream.segmentIndex.find(timeNeeded);
    const newSegment =
        index == null ? null : mediaState.stream.segmentIndex.get(index);
    let newSegmentSize = newSegment ? newSegment.getSize() : null;
    if (newSegment && !newSegmentSize) {
      // compute approximate segment size using stream bandwidth
      const duration = newSegment.getEndTime() - newSegment.getStartTime();
      const bandwidth = mediaState.stream.bandwidth || 0;

      // bandwidth is in bits per second, and the size is in bytes
      newSegmentSize = duration * bandwidth / 8;
    }
    if (!newSegmentSize) {
      return false;
    }

    // When switching, we'll need to download the init segment.
    const init = newSegment.initSegmentReference;
    if (init) {
      newSegmentSize += init.getSize() || 0;
    }
    const bandwidthEstimate = this.playerInterface_.getBandwidthEstimate();

    // The estimate is in bits per second, and the size is in bytes.  The time
    // remaining is in seconds after this calculation.
    const timeToFetchNewSegment = newSegmentSize * 8 / bandwidthEstimate;

    // If the new segment can be finished in time without risking a buffer
    // underflow, we should abort the old one and switch.
    const bufferedAhead = (bufferEnd || 0) - presentationTime;
    const safetyBuffer = Math.max(
        this.manifest_.minBufferTime || 0, this.config_.rebufferingGoal);
    const safeBufferedAhead = bufferedAhead - safetyBuffer;
    if (timeToFetchNewSegment < safeBufferedAhead) {
      return true;
    }

    // If the thing we want to switch to will be done more quickly than what
    // we've got in progress, we should abort the old one and switch.
    const bytesRemaining = mediaState.operation.getBytesRemaining();
    if (bytesRemaining > newSegmentSize) {
      return true;
    }

    // Otherwise, complete the operation in progress.
    return false;
  }

  /**
   * Notifies the StreamingEngine that the playhead has moved to a valid time
   * within the presentation timeline.
   */
  seeked() {
    const presentationTime = this.playerInterface_.getPresentationTime();
    const ContentType = ManifestParserUtilsExports.ContentType;
    const newTimeIsBuffered = (type) => {
      return this.playerInterface_.mediaSourceEngine.isBuffered(
          type, presentationTime);
    };
    let streamCleared = false;
    for (const type of this.mediaStates_.keys()) {
      const mediaState = this.mediaStates_.get(type);
      const logPrefix = StreamingEngine.logPrefix_(mediaState);

      // Always clear the iterator since we need to start streaming from the
      // new time.  This also happens in clearBuffer_, but if we don't clear,
      // we still want to reset the iterator.
      mediaState.segmentIterator = null;
      if (!newTimeIsBuffered(type)) {
        const bufferEnd =
            this.playerInterface_.mediaSourceEngine.bufferEnd(type);
        const somethingBuffered = bufferEnd != null;

        // Don't clear the buffer unless something is buffered.  This extra
        // check prevents extra, useless calls to clear the buffer.
        if (somethingBuffered || mediaState.performingUpdate) {
          this.forceClearBuffer_(mediaState);
          streamCleared = true;
        }

        // If there is an operation in progress, stop it now.
        if (mediaState.operation) {
          mediaState.operation.abort();
          log.debug(logPrefix, 'Aborting operation due to seek');
          mediaState.operation = null;
        }

        // The pts has shifted from the seek, invalidating captions currently
        // in the text buffer. Thus, clear and reset the caption parser.
        if (type === ContentType.TEXT) {
          this.playerInterface_.mediaSourceEngine.resetCaptionParser();
        }

        // Mark the media state as having seeked, so that the new buffers know
        // that they will need to be at a new position (for sequence mode).
        mediaState.seeked = true;
      }
    }
    if (!streamCleared) {
      log.debug(
          '(all): seeked: buffered seek: presentationTime=' + presentationTime);
    }
  }

  /**
   * Clear the buffer for a given stream.  Unlike clearBuffer_, this will handle
   * cases where a MediaState is performing an update.  After this runs, every
   * MediaState will have a pending update.
   */
  private forceClearBuffer_(mediaState: MediaState_) {
    const logPrefix = StreamingEngine.logPrefix_(mediaState);
    if (mediaState.clearingBuffer) {
      // We're already clearing the buffer, so we don't need to clear the
      // buffer again.
      log.debug(logPrefix, 'clear: already clearing the buffer');
      return;
    }
    if (mediaState.waitingToClearBuffer) {
      // May not be performing an update, but an update will still happen.
      // See: https://github.com/shaka-project/shaka-player/issues/334
      log.debug(logPrefix, 'clear: already waiting');
      return;
    }
    if (mediaState.performingUpdate) {
      // We are performing an update, so we have to wait until it's finished.
      // onUpdate_() will call clearBuffer_() when the update has finished.
      log.debug(logPrefix, 'clear: currently updating');
      mediaState.waitingToClearBuffer = true;

      // We can set the offset to zero to remember that this was a call to
      // clearAllBuffers.
      mediaState.clearBufferSafeMargin = 0;
      return;
    }
    const type = mediaState.type;
    if (this.playerInterface_.mediaSourceEngine.bufferStart(type) == null) {
      // Nothing buffered.
      log.debug(logPrefix, 'clear: nothing buffered');
      if (mediaState.updateTimer == null) {
        // Note: an update cycle stops when we buffer to the end of the
        // presentation, or when we raise an error.
        this.scheduleUpdate_(mediaState, 0);
      }
      return;
    }

    // An update may be scheduled, but we can just cancel it and clear the
    // buffer right away. Note: clearBuffer_() will schedule the next update.
    log.debug(logPrefix, 'clear: handling right now');
    this.cancelUpdate_(mediaState);

    /* flush= */
    this.clearBuffer_(mediaState, false, 0).catch((error) => {
      if (this.playerInterface_) {
        asserts.assert(error instanceof Error, 'Wrong error type!');
        this.playerInterface_.onError(error);
      }
    });
  }

  /**
   * Initializes the initial streams and media states.  This will schedule
   * updates for the given types.
   *
   */
  private async initStreams_(): Promise {
    const ContentType = ManifestParserUtilsExports.ContentType;
    asserts.assert(
        this.config_,
        'StreamingEngine configure() must be called before init()!');
    if (!this.currentVariant_) {
      log.error('init: no Streams chosen');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STREAMING,
          ErrorExports.Code.STREAMING_ENGINE_STARTUP_INVALID_STATE);
    }
    const streamsByType:
        Map<ManifestParserUtilsExports.ContentType, shaka.extern.Stream> =
            new Map();
    const streams: Set<shaka.extern.Stream> = new Set();
    if (this.currentVariant_.audio) {
      streamsByType.set(ContentType.AUDIO, this.currentVariant_.audio);
      streams.add(this.currentVariant_.audio);
    }
    if (this.currentVariant_.video) {
      streamsByType.set(ContentType.VIDEO, this.currentVariant_.video);
      streams.add(this.currentVariant_.video);
    }
    if (this.currentTextStream_) {
      streamsByType.set(ContentType.TEXT, this.currentTextStream_);
      streams.add(this.currentTextStream_);
    }

    // Init MediaSourceEngine.
    const mediaSourceEngine = this.playerInterface_.mediaSourceEngine;
    const forceTransmuxTS = this.config_.forceTransmuxTS;
    await mediaSourceEngine.init(
        streamsByType, forceTransmuxTS, this.manifest_.sequenceMode);
    this.destroyer_.ensureNotDestroyed();
    this.setDuration_();
    for (const type of streamsByType.keys()) {
      const stream = streamsByType.get(type);
      if (!this.mediaStates_.has(type)) {
        const state = this.createMediaState_(stream);
        this.mediaStates_.set(type, state);
        this.scheduleUpdate_(state, 0);
      }
    }
  }

  /**
   * Creates a media state.
   *
   */
  private createMediaState_(stream: shaka.extern.Stream): MediaState_ {
    return ({
      stream,
      type: stream.type,
      segmentIterator: null,
      lastSegmentReference: null,
      lastInitSegmentReference: null,
      lastTimestampOffset: null,
      lastAppendWindowStart: null,
      lastAppendWindowEnd: null,
      restoreStreamAfterTrickPlay: null,
      endOfStream: false,
      performingUpdate: false,
      updateTimer: null,
      waitingToClearBuffer: false,
      clearBufferSafeMargin: 0,
      waitingToFlushBuffer: false,
      clearingBuffer: false,
      // The playhead might be seeking on startup, if a start time is set, so
      // start "seeked" as true.
      seeked: true,
      recovering: false,
      hasError: false,
      operation: null
    } as MediaState_);
  }

  /**
   * Sets the MediaSource's duration.
   */
  private setDuration_() {
    const duration = this.manifest_.presentationTimeline.getDuration();
    if (duration < Infinity) {
      this.playerInterface_.mediaSourceEngine.setDuration(duration);
    } else {
      // Not all platforms support infinite durations, so set a finite duration
      // so we can append segments and so the user agent can seek.
      this.playerInterface_.mediaSourceEngine.setDuration(Math.pow(2, 32));
    }
  }

  /**
   * Called when |mediaState|'s update timer has expired.
   *
   * @suppress {suspiciousCode} The compiler assumes that updateTimer can't
   *   change during the await, and so complains about the null check.
   */
  private async onUpdate_(mediaState: MediaState_) {
    this.destroyer_.ensureNotDestroyed();
    const logPrefix = StreamingEngine.logPrefix_(mediaState);

    // Sanity check.
    asserts.assert(
        !mediaState.performingUpdate && mediaState.updateTimer != null,
        logPrefix + ' unexpected call to onUpdate_()');
    if (mediaState.performingUpdate || mediaState.updateTimer == null) {
      return;
    }
    asserts.assert(
        !mediaState.clearingBuffer,
        logPrefix +
            ' onUpdate_() should not be called when clearing the buffer');
    if (mediaState.clearingBuffer) {
      return;
    }
    mediaState.updateTimer = null;

    // Handle pending buffer clears.
    if (mediaState.waitingToClearBuffer) {
      // Note: clearBuffer_() will schedule the next update.
      log.debug(logPrefix, 'skipping update and clearing the buffer');
      await this.clearBuffer_(
          mediaState, mediaState.waitingToFlushBuffer,
          mediaState.clearBufferSafeMargin);
      return;
    }

    // Make sure the segment index exists. If not, create the segment index.
    if (!mediaState.stream.segmentIndex) {
      const thisStream = mediaState.stream;
      await mediaState.stream.createSegmentIndex();
      if (thisStream != mediaState.stream) {
        // We switched streams while in the middle of this async call to
        // createSegmentIndex.  Abandon this update and schedule a new one if
        // there's not already one pending.
        // Releases the segmentIndex of the old stream.
        if (thisStream.closeSegmentIndex) {
          asserts.assert(
              !mediaState.stream.segmentIndex,
              'mediastate.stream should not have segmentIndex yet.');
          thisStream.closeSegmentIndex();
        }
        if (mediaState.updateTimer == null) {
          this.scheduleUpdate_(mediaState, 0);
        }
        return;
      }
    }

    // Update the MediaState.
    try {
      const delay = this.update_(mediaState);
      if (delay != null) {
        this.scheduleUpdate_(mediaState, delay);
        mediaState.hasError = false;
      }
    } catch (error) {
      await this.handleStreamingError_(error);
      return;
    }
    const mediaStates = Array.from(this.mediaStates_.values());

    // Check if we've buffered to the end of the presentation.  We delay adding
    // the audio and video media states, so it is possible for the text stream
    // to be the only state and buffer to the end.  So we need to wait until we
    // have completed startup to determine if we have reached the end.
    if (this.startupComplete_ && mediaStates.every((ms) => ms.endOfStream)) {
      log.v1(logPrefix, 'calling endOfStream()...');
      await this.playerInterface_.mediaSourceEngine.endOfStream();
      this.destroyer_.ensureNotDestroyed();

      // If the media segments don't reach the end, then we need to update the
      // timeline duration to match the final media duration to avoid
      // buffering forever at the end.
      // We should only do this if the duration needs to shrink.
      // Growing it by less than 1ms can actually cause buffering on
      // replay, as in https://github.com/shaka-project/shaka-player/issues/979
      // On some platforms, this can spuriously be 0, so ignore this case.
      // https://github.com/shaka-project/shaka-player/issues/1967,
      const duration = this.playerInterface_.mediaSourceEngine.getDuration();
      if (duration != 0 &&
          duration < this.manifest_.presentationTimeline.getDuration()) {
        this.manifest_.presentationTimeline.setDuration(duration);
      }
    }
  }

  /**
   * Updates the given MediaState.
   *
   * @return The number of seconds to wait until updating again or
   *   null if another update does not need to be scheduled.
   */
  private update_(mediaState: MediaState_): number|null {
    asserts.assert(this.manifest_, 'manifest_ should not be null');
    asserts.assert(this.config_, 'config_ should not be null');
    const ContentType = ManifestParserUtilsExports.ContentType;

    // Do not schedule update for closed captions text mediastate, since closed
    // captions are embedded in video streams.
    if (StreamingEngine.isEmbeddedText_(mediaState)) {
      this.playerInterface_.mediaSourceEngine.setSelectedClosedCaptionId(
          mediaState.stream.originalId || '');
      return null;
    } else {
      if (mediaState.type == ContentType.TEXT) {
        // Disable embedded captions if not desired (e.g. if transitioning from
        // embedded to not-embedded captions).
        this.playerInterface_.mediaSourceEngine.clearSelectedClosedCaptionId();
      }
    }
    const logPrefix = StreamingEngine.logPrefix_(mediaState);

    // Compute how far we've buffered ahead of the playhead.
    const presentationTime = this.playerInterface_.getPresentationTime();

    // Get the next timestamp we need.
    const timeNeeded = this.getTimeNeeded_(mediaState, presentationTime);
    log.v2(logPrefix, 'timeNeeded=' + timeNeeded);

    // Get the amount of content we have buffered, accounting for drift.  This
    // is only used to determine if we have meet the buffering goal.  This
    // should be the same method that PlayheadObserver uses.
    const bufferedAhead =
        this.playerInterface_.mediaSourceEngine.bufferedAheadOf(
            mediaState.type, presentationTime);
    log.v2(
        logPrefix, 'update_:', 'presentationTime=' + presentationTime,
        'bufferedAhead=' + bufferedAhead);
    const unscaledBufferingGoal = Math.max(
        this.manifest_.minBufferTime || 0, this.config_.rebufferingGoal,
        this.config_.bufferingGoal);
    const scaledBufferingGoal =
        unscaledBufferingGoal * this.bufferingGoalScale_;

    // Check if we've buffered to the end of the presentation.
    const timeUntilEnd =
        this.manifest_.presentationTimeline.getDuration() - timeNeeded;
    const oneMicrosecond = 1e-6;
    if (timeUntilEnd < oneMicrosecond) {
      // We shouldn't rebuffer if the playhead is close to the end of the
      // presentation.
      log.debug(logPrefix, 'buffered to end of presentation');
      mediaState.endOfStream = true;
      if (mediaState.type == ContentType.VIDEO) {
        // Since the text stream of CEA closed captions doesn't have update
        // timer, we have to set the text endOfStream based on the video
        // stream's endOfStream state.
        const textState = this.mediaStates_.get(ContentType.TEXT);
        if (textState && StreamingEngine.isEmbeddedText_(textState)) {
          textState.endOfStream = true;
        }
      }
      return null;
    }
    mediaState.endOfStream = false;

    // If we've buffered to the buffering goal then schedule an update.
    if (bufferedAhead >= scaledBufferingGoal) {
      log.v2(logPrefix, 'buffering goal met');

      // Do not try to predict the next update.  Just poll according to
      // configuration (seconds). The playback rate can change at any time, so
      // any prediction we make now could be terribly invalid soon.
      return this.config_.updateIntervalSeconds / 2;
    }
    const bufferEnd =
        this.playerInterface_.mediaSourceEngine.bufferEnd(mediaState.type);
    const reference = this.getSegmentReferenceNeeded_(
        mediaState, presentationTime, bufferEnd);
    if (!reference) {
      // The segment could not be found, does not exist, or is not available.
      // In any case just try again... if the manifest is incomplete or is not
      // being updated then we'll idle forever; otherwise, we'll end up getting
      // a SegmentReference eventually.
      return this.config_.updateIntervalSeconds;
    }

    // Do not let any one stream get far ahead of any other.
    let minTimeNeeded = Infinity;
    const mediaStates = Array.from(this.mediaStates_.values());
    for (const otherState of mediaStates) {
      // Do not consider embedded captions in this calculation.  It could lead
      // to hangs in streaming.
      if (StreamingEngine.isEmbeddedText_(otherState)) {
        continue;
      }

      // If there is no next segment, ignore this stream.  This happens with
      // text when there's a Period with no text in it.
      if (otherState.segmentIterator && !otherState.segmentIterator.current()) {
        continue;
      }
      const timeNeeded = this.getTimeNeeded_(otherState, presentationTime);
      minTimeNeeded = Math.min(minTimeNeeded, timeNeeded);
    }
    const maxSegmentDuration =
        this.manifest_.presentationTimeline.getMaxSegmentDuration();
    const maxRunAhead = maxSegmentDuration * MAX_RUN_AHEAD_SEGMENTS_;
    if (timeNeeded >= minTimeNeeded + maxRunAhead) {
      // Wait and give other media types time to catch up to this one.
      // For example, let video buffering catch up to audio buffering before
      // fetching another audio segment.
      log.v2(logPrefix, 'waiting for other streams to buffer');
      return this.config_.updateIntervalSeconds;
    }
    const p = this.fetchAndAppend_(mediaState, presentationTime, reference);
    p.catch(
        // TODO(#1993): Handle asynchronous errors.
        () => {});
    return null;
  }

  /**
   * Gets the next timestamp needed. Returns the playhead's position if the
   * buffer is empty; otherwise, returns the time at which the last segment
   * appended ends.
   *
   * @return The next timestamp needed.
   */
  private getTimeNeeded_(mediaState: MediaState_, presentationTime: number):
      number {
    // Get the next timestamp we need. We must use |lastSegmentReference|
    // to determine this and not the actual buffer for two reasons:
    //   1. Actual segments end slightly before their advertised end times, so
    //      the next timestamp we need is actually larger than |bufferEnd|.
    //   2. There may be drift (the timestamps in the segments are ahead/behind
    //      of the timestamps in the manifest), but we need drift-free times
    //      when comparing times against the presentation timeline.
    if (!mediaState.lastSegmentReference) {
      return presentationTime;
    }
    return mediaState.lastSegmentReference.endTime;
  }

  /**
   * Gets the SegmentReference of the next segment needed.
   *
   * @return The SegmentReference of the
   *   next segment needed. Returns null if a segment could not be found, does
   *   not exist, or is not available.
   */
  private getSegmentReferenceNeeded_(
      mediaState: MediaState_, presentationTime: number,
      bufferEnd: number|null): SegmentReference {
    const logPrefix = StreamingEngine.logPrefix_(mediaState);
    asserts.assert(
        mediaState.stream.segmentIndex,
        'segment index should have been generated already');
    if (mediaState.segmentIterator) {
      // Something is buffered from the same Stream.  Use the current position
      // in the segment index.  This is updated via next() after each segment is
      // appended.
      return mediaState.segmentIterator.current();
    } else {
      if (mediaState.lastSegmentReference || bufferEnd) {
        // Something is buffered from another Stream.
        const time = mediaState.lastSegmentReference ?
            mediaState.lastSegmentReference.endTime :
            bufferEnd;
        asserts.assert(time != null, 'Should have a time to search');
        log.v1(logPrefix, 'looking up segment from new stream endTime:', time);
        mediaState.segmentIterator =
            mediaState.stream.segmentIndex.getIteratorForTime(time);
        const ref = mediaState.segmentIterator &&
            mediaState.segmentIterator.next().value;
        if (ref == null) {
          log.warning(logPrefix, 'cannot find segment', 'endTime:', time);
        }
        return ref;
      } else {
        // Nothing is buffered.  Start at the playhead time.

        // If there's positive drift then we need to adjust the lookup time, and
        // may wind up requesting the previous segment to be safe.
        // inaccurateManifestTolerance should be 0 for low latency streaming.
        const inaccurateTolerance = this.config_.inaccurateManifestTolerance;
        const lookupTime = Math.max(presentationTime - inaccurateTolerance, 0);
        log.v1(
            logPrefix, 'looking up segment', 'lookupTime:', lookupTime,
            'presentationTime:', presentationTime);
        let ref = null;
        if (inaccurateTolerance) {
          mediaState.segmentIterator =
              mediaState.stream.segmentIndex.getIteratorForTime(lookupTime);
          ref = mediaState.segmentIterator &&
              mediaState.segmentIterator.next().value;
        }
        if (!ref) {
          // If we can't find a valid segment with the drifted time, look for a
          // segment with the presentation time.
          mediaState.segmentIterator =
              mediaState.stream.segmentIndex.getIteratorForTime(
                  presentationTime);
          ref = mediaState.segmentIterator &&
              mediaState.segmentIterator.next().value;
        }
        if (ref == null) {
          log.warning(
              logPrefix, 'cannot find segment', 'lookupTime:', lookupTime,
              'presentationTime:', presentationTime);
        }
        return ref;
      }
    }
  }

  /**
   * Fetches and appends the given segment. Sets up the given MediaState's
   * associated SourceBuffer and evicts segments if either are required
   * beforehand. Schedules another update after completing successfully.
   *
   */
  private async fetchAndAppend_(
      mediaState: MediaState_, presentationTime: number,
      reference: SegmentReference) {
    const ContentType = ManifestParserUtilsExports.ContentType;
    const StreamingEngine = StreamingEngine;
    const logPrefix = StreamingEngine.logPrefix_(mediaState);
    log.v1(
        logPrefix, 'fetchAndAppend_:', 'presentationTime=' + presentationTime,
        'reference.startTime=' + reference.startTime,
        'reference.endTime=' + reference.endTime);

    // Subtlety: The playhead may move while asynchronous update operations are
    // in progress, so we should avoid calling playhead.getTime() in any
    // callbacks. Furthermore, switch() or seeked() may be called at any time,
    // so we store the old iterator.  This allows the mediaState to change and
    // we'll update the old iterator.
    const stream = mediaState.stream;
    const iter = mediaState.segmentIterator;
    mediaState.performingUpdate = true;
    try {
      if (reference.getStatus() == SegmentReferenceExports.Status.MISSING) {
        throw new Error(
            ErrorExports.Severity.RECOVERABLE, ErrorExports.Category.NETWORK,
            ErrorExports.Code.SEGMENT_MISSING);
      }
      await this.initSourceBuffer_(mediaState, reference);
      this.destroyer_.ensureNotDestroyed();
      if (this.fatalError_) {
        return;
      }
      log.v2(logPrefix, 'fetching segment');
      const isMP4 =
          stream.mimeType == 'video/mp4' || stream.mimeType == 'audio/mp4';
      const isReadableStreamSupported = window.ReadableStream;

      // Enable MP4 low latency streaming with ReadableStream chunked data.
      // Disabled when AES-128 is present, as we cannot decrypt part of a
      // segment.
      if (this.config_.lowLatencyMode && isReadableStreamSupported && isMP4 &&
          !reference.hlsAes128Key) {
        let remaining = new Uint8Array(0);
        const streamDataCallback = async (data) => {
          this.destroyer_.ensureNotDestroyed();
          if (this.fatalError_) {
            return;
          }

          // Append the data with complete boxes.
          // Every time streamDataCallback gets called, append the new data to
          // the remaining data.
          // Find the last fully completed Mdat box, and slice the data into two
          // parts: the first part with completed Mdat boxes, and the second
          // part with an incomplete box.
          // Append the first part, and save the second part as remaining data,
          // and handle it with the next streamDataCallback call.
          remaining = this.concatArray_(remaining, data);
          let sawMDAT = false;
          let offset = 0;
          (new Mp4Parser())
              .box(
                  'mdat',
                  (box) => {
                    offset = box.size + box.start;
                    sawMDAT = true;
                  })
              .parse(
                  remaining,
                  /* partialOkay= */
                  false,
                  /* isChunkedData= */
                  true);
          if (sawMDAT) {
            const dataToAppend = remaining.subarray(0, offset);
            remaining = remaining.subarray(offset);
            await this.append_(
                mediaState, presentationTime, stream, reference, dataToAppend);
          }
        };
        await this.fetch_(mediaState, reference, streamDataCallback);
      } else {
        if (this.config_.lowLatencyMode && !isReadableStreamSupported) {
          log.warning(
              'Low latency streaming mode is enabled, but ' +
              'ReadableStream is not supported by the browser.');
        }
        const fetchSegment = this.fetch_(mediaState, reference);
        let result = await fetchSegment;
        this.destroyer_.ensureNotDestroyed();
        if (this.fatalError_) {
          return;
        }
        if (reference.hlsAes128Key) {
          asserts.assert(iter, 'mediaState.segmentIterator should exist');
          result = await this.aes128Decrypt_(result, reference, iter);
        }
        this.destroyer_.ensureNotDestroyed();

        // If the text stream gets switched between fetch_() and append_(), the
        // new text parser is initialized, but the new init segment is not
        // fetched yet.  That would cause an error in TextParser.parseMedia().
        // See http://b/168253400
        if (mediaState.waitingToClearBuffer) {
          log.info(logPrefix, 'waitingToClearBuffer, skip append');
          mediaState.performingUpdate = false;
          this.scheduleUpdate_(mediaState, 0);
          return;
        }
        await this.append_(
            mediaState, presentationTime, stream, reference, result);
      }
      this.destroyer_.ensureNotDestroyed();
      if (this.fatalError_) {
        return;
      }

      // move to next segment after appending the current segment.
      mediaState.lastSegmentReference = reference;
      const newRef = iter.next().value;
      log.v2(logPrefix, 'advancing to next segment', newRef);
      mediaState.performingUpdate = false;
      mediaState.recovering = false;
      const info = this.playerInterface_.mediaSourceEngine.getBufferedInfo();
      const buffered = info[mediaState.type];

      // Convert the buffered object to a string capture its properties on
      // WebOS.
      log.v1(logPrefix, 'finished fetch and append', JSON.stringify(buffered));
      if (!mediaState.waitingToClearBuffer) {
        this.playerInterface_.onSegmentAppended(
            reference.startTime, reference.endTime, mediaState.type);
      }

      // Update right away.
      this.scheduleUpdate_(mediaState, 0);
    } catch (error) {
      this.destroyer_.ensureNotDestroyed(error);
      if (this.fatalError_) {
        return;
      }
      asserts.assert(
          error instanceof Error, 'Should only receive a Shaka error');
      mediaState.performingUpdate = false;
      if (error.code == ErrorExports.Code.OPERATION_ABORTED) {
        // If the network slows down, abort the current fetch request and start
        // a new one, and ignore the error message.
        mediaState.performingUpdate = false;
        mediaState.updateTimer = null;
        this.scheduleUpdate_(mediaState, 0);
      } else {
        if (mediaState.type == ContentType.TEXT &&
            this.config_.ignoreTextStreamFailures) {
          if (error.code == ErrorExports.Code.BAD_HTTP_STATUS) {
            log.warning(
                logPrefix,
                'Text stream failed to download. Proceeding without it.');
          } else {
            log.warning(
                logPrefix,
                'Text stream failed to parse. Proceeding without it.');
          }
          this.mediaStates_.delete(ContentType.TEXT);
        } else {
          if (error.code == ErrorExports.Code.QUOTA_EXCEEDED_ERROR) {
            this.handleQuotaExceeded_(mediaState, error);
          } else {
            if (error.code == ErrorExports.Code.BAD_HTTP_STATUS && error.data &&
                error.data[1] == 404) {
              // The segment could not be found, does not exist, or is not
              // available. In any case just try again. The current segment is
              // not available. Schedule another update to fetch the segment
              // again.
              log.v2(logPrefix, 'segment not available.');
              mediaState.performingUpdate = false;
              mediaState.updateTimer = null;
              this.scheduleUpdate_(mediaState, 1);
            } else {
              log.error(
                  logPrefix, 'failed fetch and append: code=' + error.code);
              mediaState.hasError = true;
              error.severity = ErrorExports.Severity.CRITICAL;
              await this.handleStreamingError_(error);
            }
          }
        }
      }
    }
  }

  /**
   * @return finalResult
   */
  private async aes128Decrypt_(
      rawResult: BufferSource, reference: SegmentReference,
      iter: SegmentIterator): Promise<BufferSource> {
    const key = reference.hlsAes128Key;
    if (!key.cryptoKey) {
      asserts.assert(
          key.fetchKey,
          'If AES-128 cryptoKey was not ' +
              'preloaded, fetchKey function should be provided');
      await key.fetchKey();
      asserts.assert(key.cryptoKey, 'AES-128 cryptoKey should now be set');
    }
    let iv = key.iv;
    if (!iv) {
      iv = shaka.util.BufferUtils.toUint8(new ArrayBuffer(16));
      let sequence = key.firstMediaSequenceNumber + iter.currentPosition();
      for (let i = iv.byteLength - 1; i >= 0; i--) {
        iv[i] = sequence & 255;
        sequence >>= 8;
      }
    }
    return window.crypto.subtle.decrypt(
        {name: 'AES-CBC', iv}, key.cryptoKey, rawResult);
  }

  /**
   * Clear per-stream error states and retry any failed streams.
   * @return False if unable to retry.
   */
  retry(): boolean {
    if (this.destroyer_.destroyed()) {
      log.error('Unable to retry after StreamingEngine is destroyed!');
      return false;
    }
    if (this.fatalError_) {
      log.error(
          'Unable to retry after StreamingEngine encountered a ' +
          'fatal error!');
      return false;
    }
    for (const mediaState of this.mediaStates_.values()) {
      const logPrefix = StreamingEngine.logPrefix_(mediaState);
      if (mediaState.hasError) {
        log.info(logPrefix, 'Retrying after failure...');
        mediaState.hasError = false;
        this.scheduleUpdate_(mediaState, 0.1);
      }
    }
    return true;
  }

  /**
   * Append the data to the remaining data.
   */
  private concatArray_(remaining: Uint8Array, data: Uint8Array): Uint8Array {
    const result = new Uint8Array(remaining.length + data.length);
    result.set(remaining);
    result.set(data, remaining.length);
    return result;
  }

  /**
   * Handles a QUOTA_EXCEEDED_ERROR.
   *
   */
  private handleQuotaExceeded_(mediaState: MediaState_, error: Error) {
    const logPrefix = StreamingEngine.logPrefix_(mediaState);

    // The segment cannot fit into the SourceBuffer. Ideally, MediaSource would
    // have evicted old data to accommodate the segment; however, it may have
    // failed to do this if the segment is very large, or if it could not find
    // a suitable time range to remove.
    // We can overcome the latter by trying to append the segment again;
    // however, to avoid continuous QuotaExceededErrors we must reduce the size
    // of the buffer going forward.
    // If we've recently reduced the buffering goals, wait until the stream
    // which caused the first QuotaExceededError recovers. Doing this ensures
    // we don't reduce the buffering goals too quickly.
    const mediaStates = Array.from(this.mediaStates_.values());
    const waitingForAnotherStreamToRecover = mediaStates.some((ms) => {
      return ms != mediaState && ms.recovering;
    });
    if (!waitingForAnotherStreamToRecover) {
      // Reduction schedule: 80%, 60%, 40%, 20%, 16%, 12%, 8%, 4%, fail.
      // Note: percentages are used for comparisons to avoid rounding errors.
      const percentBefore = Math.round(100 * this.bufferingGoalScale_);
      if (percentBefore > 20) {
        this.bufferingGoalScale_ -= 0.2;
      } else {
        if (percentBefore > 4) {
          this.bufferingGoalScale_ -= 0.04;
        } else {
          log.error(
              logPrefix, 'MediaSource threw QuotaExceededError too many times');
          mediaState.hasError = true;
          this.fatalError_ = true;
          this.playerInterface_.onError(error);
          return;
        }
      }
      const percentAfter = Math.round(100 * this.bufferingGoalScale_);
      log.warning(
          logPrefix, 'MediaSource threw QuotaExceededError:',
          'reducing buffering goals by ' + (100 - percentAfter) + '%');
      mediaState.recovering = true;
    } else {
      log.debug(
          logPrefix, 'MediaSource threw QuotaExceededError:',
          'waiting for another stream to recover...');
    }

    // QuotaExceededError gets thrown if evication didn't help to make room
    // for a segment. We want to wait for a while (4 seconds is just an
    // arbitrary number) before updating to give the playhead a chance to
    // advance, so we don't immidiately throw again.
    this.scheduleUpdate_(mediaState, 4);
  }

  /**
   * Sets the given MediaState's associated SourceBuffer's timestamp offset,
   * append window, and init segment if they have changed. If an error occurs
   * then neither the timestamp offset or init segment are unset, since another
   * call to switch() will end up superseding them.
   *
   */
  private async initSourceBuffer_(
      mediaState: MediaState_, reference: SegmentReference): Promise {
    const StreamingEngine = StreamingEngine;
    const logPrefix = StreamingEngine.logPrefix_(mediaState);
    const operations: Promise[] = [];

    // Rounding issues can cause us to remove the first frame of a Period, so
    // reduce the window start time slightly.
    const appendWindowStart = Math.max(
        0,
        reference.appendWindowStart -
            StreamingEngine.APPEND_WINDOW_START_FUDGE_);
    const appendWindowEnd =
        reference.appendWindowEnd + StreamingEngine.APPEND_WINDOW_END_FUDGE_;
    asserts.assert(
        reference.startTime <= appendWindowEnd,
        logPrefix + ' segment should start before append window end');
    const timestampOffset = reference.timestampOffset;
    if (timestampOffset != mediaState.lastTimestampOffset ||
        appendWindowStart != mediaState.lastAppendWindowStart ||
        appendWindowEnd != mediaState.lastAppendWindowEnd) {
      log.v1(logPrefix, 'setting timestamp offset to ' + timestampOffset);
      log.v1(logPrefix, 'setting append window start to ' + appendWindowStart);
      log.v1(logPrefix, 'setting append window end to ' + appendWindowEnd);
      const setProperties = async () => {
        try {
          mediaState.lastAppendWindowStart = appendWindowStart;
          mediaState.lastAppendWindowEnd = appendWindowEnd;
          mediaState.lastTimestampOffset = timestampOffset;
          await this.playerInterface_.mediaSourceEngine.setStreamProperties(
              mediaState.type, timestampOffset, appendWindowStart,
              appendWindowEnd, this.manifest_.sequenceMode);
        } catch (error) {
          mediaState.lastAppendWindowStart = null;
          mediaState.lastAppendWindowEnd = null;
          mediaState.lastTimestampOffset = null;
          throw error;
        }
      };
      operations.push(setProperties());
    }
    if (!InitSegmentReference.equal(
            reference.initSegmentReference,
            mediaState.lastInitSegmentReference)) {
      mediaState.lastInitSegmentReference = reference.initSegmentReference;
      if (reference.initSegmentReference) {
        log.v1(logPrefix, 'fetching init segment');
        const fetchInit =
            this.fetch_(mediaState, reference.initSegmentReference);
        const append = async () => {
          try {
            const initSegment = await fetchInit;
            this.destroyer_.ensureNotDestroyed();
            log.v1(logPrefix, 'appending init segment');
            const hasClosedCaptions = mediaState.stream.closedCaptions &&
                mediaState.stream.closedCaptions.size > 0;
            await this.playerInterface_.mediaSourceEngine.appendBuffer(
                mediaState.type, initSegment,
                /* reference= */
                null, hasClosedCaptions);
          } catch (error) {
            mediaState.lastInitSegmentReference = null;
            throw error;
          }
        };
        this.playerInterface_.onInitSegmentAppended(
            reference.startTime, reference.initSegmentReference);
        operations.push(append());
      }
    }
    await Promise.all(operations);
  }

  /**
   * Appends the given segment and evicts content if required to append.
   *
   */
  private async append_(
      mediaState: MediaState_, presentationTime: number,
      stream: shaka.extern.Stream, reference: SegmentReference,
      segment: BufferSource): Promise {
    const logPrefix = StreamingEngine.logPrefix_(mediaState);
    const hasClosedCaptions =
        stream.closedCaptions && stream.closedCaptions.size > 0;
    if (stream.emsgSchemeIdUris != null && stream.emsgSchemeIdUris.length > 0 ||
        this.config_.dispatchAllEmsgBoxes) {
      (new Mp4Parser())
          .fullBox(
              'emsg',
              (box) => this.parseEMSG_(reference, stream.emsgSchemeIdUris, box))
          .parse(segment);
    }
    await this.evict_(mediaState, presentationTime);
    this.destroyer_.ensureNotDestroyed();
    log.v1(
        logPrefix, 'appending media segment at',
        reference.syncTime == null ? 'unknown' : reference.syncTime);
    const seeked = mediaState.seeked;
    mediaState.seeked = false;
    await this.playerInterface_.mediaSourceEngine.appendBuffer(
        mediaState.type, segment, reference, hasClosedCaptions, seeked);
    this.destroyer_.ensureNotDestroyed();
    log.v2(logPrefix, 'appended media segment');
  }

  /**
   * Parse the EMSG box from a MP4 container.
   *
   * @param emsgSchemeIdUris Array of emsg
   *     scheme_id_uri for which emsg boxes should be parsed.
   * https://dashif-documents.azurewebsites.net/Events/master/event.html#emsg-format
   * aligned(8) class DASHEventMessageBox
   *    extends FullBox(‘emsg’, version, flags = 0){
   * if (version==0) {
   *   string scheme_id_uri;
   *   string value;
   *   unsigned int(32) timescale;
   *   unsigned int(32) presentation_time_delta;
   *   unsigned int(32) event_duration;
   *   unsigned int(32) id;
   * } else if (version==1) {
   *   unsigned int(32) timescale;
   *   unsigned int(64) presentation_time;
   *   unsigned int(32) event_duration;
   *   unsigned int(32) id;
   *   string scheme_id_uri;
   *   string value;
   * }
   * unsigned int(8) message_data[];
   */
  private parseEMSG_(
      reference: SegmentReference, emsgSchemeIdUris: string[]|null,
      box: shaka.extern.ParsedBox) {
    let timescale;
    let id;
    let eventDuration;
    let schemeId;
    let startTime;
    let presentationTimeDelta;
    let value;
    if (box.version === 0) {
      schemeId = box.reader.readTerminatedString();
      value = box.reader.readTerminatedString();
      timescale = box.reader.readUint32();
      presentationTimeDelta = box.reader.readUint32();
      eventDuration = box.reader.readUint32();
      id = box.reader.readUint32();
      startTime = reference.startTime + presentationTimeDelta / timescale;
    } else {
      timescale = box.reader.readUint32();
      const pts = box.reader.readUint64();
      startTime = pts / timescale + reference.timestampOffset;
      presentationTimeDelta = startTime - reference.startTime;
      eventDuration = box.reader.readUint32();
      id = box.reader.readUint32();
      schemeId = box.reader.readTerminatedString();
      value = box.reader.readTerminatedString();
    }
    const messageData =
        box.reader.readBytes(box.reader.getLength() - box.reader.getPosition());

    // See DASH sec. 5.10.3.3.1
    // If a DASH client detects an event message box with a scheme that is not
    // defined in MPD, the client is expected to ignore it.
    if (emsgSchemeIdUris && emsgSchemeIdUris.includes(schemeId) ||
        this.config_.dispatchAllEmsgBoxes) {
      // See DASH sec. 5.10.4.1
      // A special scheme in DASH used to signal manifest updates.
      if (schemeId == 'urn:mpeg:dash:event:2012') {
        this.playerInterface_.onManifestUpdate();
      } else {
        const emsg: shaka.extern.EmsgInfo = {
          startTime: startTime,
          endTime: startTime + eventDuration / timescale,
          schemeIdUri: schemeId,
          value: value,
          timescale: timescale,
          presentationTimeDelta: presentationTimeDelta,
          eventDuration: eventDuration,
          id: id,
          messageData: messageData
        };

        // Dispatch an event to notify the application about the emsg box.
        const eventName = FakeEventExports.EventName.Emsg;
        const data = (new Map()).set('detail', emsg);
        const event = new FakeEvent(eventName, data);
        this.playerInterface_.onEvent(event);
      }
    }
  }

  /**
   * Evicts media to meet the max buffer behind limit.
   *
   */
  private async evict_(mediaState: MediaState_, presentationTime: number) {
    const logPrefix = StreamingEngine.logPrefix_(mediaState);
    log.v2(logPrefix, 'checking buffer length');

    // Use the max segment duration, if it is longer than the bufferBehind, to
    // avoid accidentally clearing too much data when dealing with a manifest
    // with a long keyframe interval.
    const bufferBehind = Math.max(
        this.config_.bufferBehind,
        this.manifest_.presentationTimeline.getMaxSegmentDuration());
    const startTime =
        this.playerInterface_.mediaSourceEngine.bufferStart(mediaState.type);
    if (startTime == null) {
      log.v2(
          logPrefix, 'buffer behind okay because nothing buffered:',
          'presentationTime=' + presentationTime,
          'bufferBehind=' + bufferBehind);
      return;
    }
    const bufferedBehind = presentationTime - startTime;
    const overflow = bufferedBehind - bufferBehind;

    // See: https://github.com/shaka-project/shaka-player/issues/2982
    if (overflow <= 0.01) {
      log.v2(
          logPrefix,
          'buffer behind okay:', 'presentationTime=' + presentationTime,
          'bufferedBehind=' + bufferedBehind, 'bufferBehind=' + bufferBehind,
          'underflow=' + Math.abs(overflow));
      return;
    }
    log.v1(
        logPrefix,
        'buffer behind too large:', 'presentationTime=' + presentationTime,
        'bufferedBehind=' + bufferedBehind, 'bufferBehind=' + bufferBehind,
        'overflow=' + overflow);
    await this.playerInterface_.mediaSourceEngine.remove(
        mediaState.type, startTime, startTime + overflow);
    this.destroyer_.ensureNotDestroyed();
    log.v1(logPrefix, 'evicted ' + overflow + ' seconds');
  }

  private static isEmbeddedText_(mediaState: MediaState_): boolean {
    const MimeUtils = MimeUtils;
    const CEA608_MIME = MimeUtils.CEA608_CLOSED_CAPTION_MIMETYPE;
    const CEA708_MIME = MimeUtils.CEA708_CLOSED_CAPTION_MIMETYPE;
    return mediaState &&
        mediaState.type == ManifestParserUtilsExports.ContentType.TEXT &&
        (mediaState.stream.mimeType == CEA608_MIME ||
         mediaState.stream.mimeType == CEA708_MIME);
  }

  /**
   * Fetches the given segment.
   *
   * @param
   *   reference
   *
   * @suppress {strictMissingProperties}
   */
  private async fetch_(
      mediaState: MediaState_, reference: InitSegmentReference|SegmentReference,
      streamDataCallback?: ((p1: BufferSource) => Promise)|
      null): Promise<BufferSource> {
    const requestType = NetworkingEngineExports.RequestType.SEGMENT;
    const request = Networking.createSegmentRequest(
        reference.getUris(), reference.startByte, reference.endByte,
        this.config_.retryParameters, streamDataCallback);
    log.v2('fetching: reference=', reference);
    const stream = mediaState.stream;
    this.playerInterface_.modifySegmentRequest(request, {
      type: stream.type,
      init: reference instanceof InitSegmentReference,
      duration: reference.endTime - reference.startTime,
      mimeType: stream.mimeType,
      codecs: stream.codecs,
      bandwidth: stream.bandwidth
    });
    const op = this.playerInterface_.netEngine.request(requestType, request);
    mediaState.operation = op;
    const response = await op.promise;
    mediaState.operation = null;
    return response.data;
  }

  /**
   * Clears the buffer and schedules another update.
   * The optional parameter safeMargin allows to retain a certain amount
   * of buffer, which can help avoiding rebuffering events.
   * The value of the safe margin should be provided by the ABR manager.
   *
   */
  private async clearBuffer_(
      mediaState: MediaState_, flush: boolean, safeMargin: number) {
    const logPrefix = StreamingEngine.logPrefix_(mediaState);
    asserts.assert(
        !mediaState.performingUpdate && mediaState.updateTimer == null,
        logPrefix + ' unexpected call to clearBuffer_()');
    mediaState.waitingToClearBuffer = false;
    mediaState.waitingToFlushBuffer = false;
    mediaState.clearBufferSafeMargin = 0;
    mediaState.clearingBuffer = true;
    mediaState.lastSegmentReference = null;
    mediaState.lastInitSegmentReference = null;
    mediaState.segmentIterator = null;
    log.debug(logPrefix, 'clearing buffer');
    if (safeMargin) {
      const presentationTime = this.playerInterface_.getPresentationTime();
      const duration = this.playerInterface_.mediaSourceEngine.getDuration();
      await this.playerInterface_.mediaSourceEngine.remove(
          mediaState.type, presentationTime + safeMargin, duration);
    } else {
      await this.playerInterface_.mediaSourceEngine.clear(mediaState.type);
      this.destroyer_.ensureNotDestroyed();
      if (flush) {
        await this.playerInterface_.mediaSourceEngine.flush(mediaState.type);
      }
    }
    this.destroyer_.ensureNotDestroyed();
    log.debug(logPrefix, 'cleared buffer');
    mediaState.clearingBuffer = false;
    mediaState.endOfStream = false;
    this.scheduleUpdate_(mediaState, 0);
  }

  /**
   * Schedules |mediaState|'s next update.
   *
   * @param delay The delay in seconds.
   */
  private scheduleUpdate_(mediaState: MediaState_, delay: number) {
    const logPrefix = StreamingEngine.logPrefix_(mediaState);

    // If the text's update is canceled and its mediaState is deleted, stop
    // scheduling another update.
    const type = mediaState.type;
    if (type == ManifestParserUtilsExports.ContentType.TEXT &&
        !this.mediaStates_.has(type)) {
      log.v1(logPrefix, 'Text stream is unloaded. No update is needed.');
      return;
    }
    log.v2(logPrefix, 'updating in ' + delay + ' seconds');
    asserts.assert(
        mediaState.updateTimer == null,
        logPrefix + ' did not expect update to be scheduled');
    mediaState.updateTimer = (new DelayedTick(async () => {
                               try {
                                 await this.onUpdate_(mediaState);
                               } catch (error) {
                                 if (this.playerInterface_) {
                                   this.playerInterface_.onError(error);
                                 }
                               }
                             })).tickAfter(delay);
  }

  /**
   * If |mediaState| is scheduled to update, stop it.
   *
   */
  private cancelUpdate_(mediaState: MediaState_) {
    if (mediaState.updateTimer == null) {
      return;
    }
    mediaState.updateTimer.stop();
    mediaState.updateTimer = null;
  }

  /**
   * If |mediaState| holds any in-progress operations, abort them.
   *
   */
  private async abortOperations_(mediaState): Promise {
    if (mediaState.operation) {
      await mediaState.operation.abort();
    }
  }

  /**
   * Handle streaming errors by delaying, then notifying the application by
   * error callback and by streaming failure callback.
   *
   */
  private async handleStreamingError_(error: Error): Promise {
    // If we invoke the callback right away, the application could trigger a
    // rapid retry cycle that could be very unkind to the server.  Instead,
    // use the backoff system to delay and backoff the error handling.
    await this.failureCallbackBackoff_.attempt();
    this.destroyer_.ensureNotDestroyed();

    // First fire an error event.
    this.playerInterface_.onError(error);

    // If the error was not handled by the application, call the failure
    // callback.
    if (!error.handled) {
      this.config_.failureCallback(error);
    }
  }

  /**
   * @return A log prefix of the form ($CONTENT_TYPE:$STREAM_ID), e.g.,
   *   "(audio:5)" or "(video:hd)".
   */
  private static logPrefix_(mediaState: MediaState_): string {
    return '(' + mediaState.type + ':' + mediaState.stream.id + ')';
  }
}
type PlayerInterface = {
  getPresentationTime: () => number,
  getBandwidthEstimate: () => number,
  modifySegmentRequest: (p1: shaka.extern.Request, p2: SegmentInfo) => any,
  mediaSourceEngine: MediaSourceEngine,
  netEngine: NetworkingEngine,
  onError: (p1: Error) => any,
  onEvent: (p1: Event) => any,
  onManifestUpdate: () => any,
  onSegmentAppended:
      (p1: number, p2: number, p3: ManifestParserUtilsExports.ContentType) =>
          any,
  onInitSegmentAppended: (p1: number, p2: InitSegmentReference) => any
};

export {PlayerInterface};
type MediaState_ = {
  type: ManifestParserUtilsExports.ContentType,
  stream: shaka.extern.Stream,
  segmentIterator: SegmentIterator,
  lastSegmentReference: SegmentReference,
  lastInitSegmentReference: InitSegmentReference,
  lastTimestampOffset: number|null,
  lastAppendWindowStart: number|null,
  lastAppendWindowEnd: number|null,
  restoreStreamAfterTrickPlay: shaka.extern.Stream|null,
  endOfStream: boolean,
  performingUpdate: boolean,
  updateTimer: DelayedTick,
  waitingToClearBuffer: boolean,
  waitingToFlushBuffer: boolean,
  clearBufferSafeMargin: number,
  clearingBuffer: boolean,
  seeked: boolean,
  recovering: boolean,
  hasError: boolean,
  operation: NetworkingEngineExports.PendingRequest
};

export {MediaState_};

/**
 * The fudge factor for appendWindowStart.  By adjusting the window backward, we
 * avoid rounding errors that could cause us to remove the keyframe at the start
 * of the Period.
 *
 * NOTE: This was increased as part of the solution to
 * https://github.com/shaka-project/shaka-player/issues/1281
 *
 */
export const APPEND_WINDOW_START_FUDGE_: number = 0.1;

/**
 * The fudge factor for appendWindowEnd.  By adjusting the window backward, we
 * avoid rounding errors that could cause us to remove the last few samples of
 * the Period.  This rounding error could then create an artificial gap and a
 * stutter when the gap-jumping logic takes over.
 *
 * https://github.com/shaka-project/shaka-player/issues/1597
 *
 */
export const APPEND_WINDOW_END_FUDGE_: number = 0.01;

/**
 * The maximum number of segments by which a stream can get ahead of other
 * streams.
 *
 * Introduced to keep StreamingEngine from letting one media type get too far
 * ahead of another.  For example, audio segments are typically much smaller
 * than video segments, so in the time it takes to fetch one video segment, we
 * could fetch many audio segments.  This doesn't help with buffering, though,
 * since the intersection of the two buffered ranges is what counts.
 *
 */
export const MAX_RUN_AHEAD_SEGMENTS_: number = 1;
