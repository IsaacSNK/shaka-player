/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import {IPlayheadObserver} from './/playhead_observer';
import * as FakeEventExports from './../util/fake_event';
import {FakeEvent} from './../util/fake_event';
import * as FakeEventTargetExports from './../util/fake_event_target';
import {FakeEventTarget} from './../util/fake_event_target';

/**
 * Monitors the quality of content being appended to the source buffers and
 * fires 'qualitychange' events when the media quality at the playhead changes.
 *
 * @final
 */
export class QualityObserver extends FakeEventTarget implements
    IPlayheadObserver {
  private contentTypeStates_: Map<string, ContentTypeState>;

  /** function():!shaka.extern.BufferedInfo */
  private getBufferedInfo_: any;

  /**
   * Creates a new QualityObserver.
   *
   *   Buffered info is needed to purge QualityChanges that are no
   *   longer relevant.
   */
  constructor(getBufferedInfo: () => shaka.extern.BufferedInfo) {
    super();
    this.contentTypeStates_ = new Map();
    this.getBufferedInfo_ = getBufferedInfo;
  }

  /** @override */
  release() {
    this.contentTypeStates_.clear();
    super.release();
  }

  /**
   * Get the ContenTypeState for a contentType, creating a new
   * one if necessary.
   *
   *  The contend type e.g. "video" or "audio".
   */
  private getContentTypeState_(contentType: string): ContentTypeState {
    let contentTypeState = this.contentTypeStates_.get(contentType);
    if (!contentTypeState) {
      contentTypeState = {
        qualityChangePositions: [],
        currentQuality: null,
        contentType: contentType
      };
      this.contentTypeStates_.set(contentType, contentTypeState);
    }
    return contentTypeState;
  }

  /**
   * Adds a QualityChangePosition for the contentType identified by
   * the mediaQuality.contentType.
   *
   *  Position in seconds of the quality change.
   */
  addMediaQualityChange(
      mediaQuality: shaka.extern.MediaQualityInfo, position: number) {
    const contentTypeState =
        this.getContentTypeState_(mediaQuality.contentType);

    // Remove unneeded QualityChangePosition(s) before adding the new one
    this.purgeQualityChangePositions_(contentTypeState);
    const newChangePosition = {mediaQuality: mediaQuality, position: position};
    const changePositions = contentTypeState.qualityChangePositions;
    const insertBeforeIndex = changePositions.findIndex(
        (qualityChange) => qualityChange.position >= position);
    if (insertBeforeIndex >= 0) {
      const duplicatePositions =
          changePositions[insertBeforeIndex].position == position ? 1 : 0;
      changePositions.splice(
          insertBeforeIndex, duplicatePositions, newChangePosition);
    } else {
      changePositions.push(newChangePosition);
    }
  }

  /**
   * Determines the media quality at a specific position in the source buffer.
   *
   *  Position in seconds
   */
  private static getMediaQualityAtPosition_(
      position: number,
      contentTypeState: ContentTypeState): shaka.extern.MediaQualityInfo|null {
    // The qualityChangePositions must be ordered by position ascending
    // Find the last QualityChangePosition prior to the position
    const changePositions = contentTypeState.qualityChangePositions;
    for (let i = changePositions.length - 1; i >= 0; i--) {
      const qualityChange = changePositions[i];
      if (qualityChange.position <= position) {
        return qualityChange.mediaQuality;
      }
    }
    return null;
  }

  /**
   * Determines if two MediaQualityInfo objects are the same or not.
   *
   */
  private static mediaQualitiesAreTheSame_(
      mq1: shaka.extern.MediaQualityInfo|null,
      mq2: shaka.extern.MediaQualityInfo|null): boolean {
    if (mq1 === mq2) {
      return true;
    }
    if (!mq1 || !mq2) {
      return false;
    }
    return mq1.bandwidth == mq2.bandwidth &&
        mq1.audioSamplingRate == mq2.audioSamplingRate &&
        mq1.codecs == mq2.codecs && mq1.contentType == mq2.contentType &&
        mq1.frameRate == mq2.frameRate && mq1.height == mq2.height &&
        mq1.mimeType == mq2.mimeType &&
        mq1.channelsCount == mq2.channelsCount &&
        mq1.pixelAspectRatio == mq2.pixelAspectRatio && mq1.width == mq2.width;
  }

  /** @override */
  poll(positionInSeconds, wasSeeking) {
    for (const contentTypeState of this.contentTypeStates_.values()) {
      const qualityAtPosition = QualityObserver.getMediaQualityAtPosition_(
          positionInSeconds, contentTypeState);
      if (qualityAtPosition &&
          !QualityObserver.mediaQualitiesAreTheSame_(
              contentTypeState.currentQuality, qualityAtPosition)) {
        if (this.positionIsBuffered_(
                positionInSeconds, qualityAtPosition.contentType)) {
          contentTypeState.currentQuality = qualityAtPosition;
          log.debug(
              'Media quality changed at position ' + positionInSeconds + ' ' +
              JSON.stringify(qualityAtPosition));
          const event = new FakeEvent(
              'qualitychange', new Map([
                ['quality', qualityAtPosition], ['position', positionInSeconds]
              ]));
          this.dispatchEvent(event);
        }
      }
    }
  }

  /**
   * Determine if a position is buffered for a given content type.
   *
   */
  private positionIsBuffered_(position: number, contentType: string) {
    const bufferedInfo = this.getBufferedInfo_();
    const bufferedRanges = bufferedInfo[contentType];
    if (bufferedRanges && bufferedRanges.length > 0) {
      const bufferStart = bufferedRanges[0].start;
      const bufferEnd = bufferedRanges[bufferedRanges.length - 1].end;
      if (position >= bufferStart && position < bufferEnd) {
        return true;
      }
    }
    return false;
  }

  /**
   * Removes the QualityChangePosition(s) that are not relevant to the buffered
   * content of the specified contentType. Note that this function is
   * invoked just before adding the quality change info associated with
   * the next media segment to be appended.
   *
   */
  private purgeQualityChangePositions_(contentTypeState: ContentTypeState) {
    const bufferedInfo = this.getBufferedInfo_();
    const bufferedRanges = bufferedInfo[contentTypeState.contentType];
    if (bufferedRanges && bufferedRanges.length > 0) {
      const bufferStart = bufferedRanges[0].start;
      const bufferEnd = bufferedRanges[bufferedRanges.length - 1].end;
      const oldChangePositions = contentTypeState.qualityChangePositions;
      contentTypeState.qualityChangePositions =
          oldChangePositions.filter((qualityChange, index) => {
            // Remove all but last quality change before bufferStart.
            if (qualityChange.position <= bufferStart &&
                index + 1 < oldChangePositions.length &&
                oldChangePositions[index + 1].position <= bufferStart) {
              return false;
            }

            // Remove all quality changes after bufferEnd.
            if (qualityChange.position >= bufferEnd) {
              return false;
            }
            return true;
          });
    } else {
      // Nothing is buffered; so remove all quality changes.
      contentTypeState.qualityChangePositions = [];
    }
  }
}
type QualityChangePosition = {
  mediaQuality: shaka.extern.MediaQualityInfo,
  position: number
};

export {QualityChangePosition};
type ContentTypeState = {
  qualityChangePositions: QualityChangePosition[],
  currentQuality: shaka.extern.MediaQualityInfo|null,
  contentType: string
};

export {ContentTypeState};
