/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimelineRegionInfo } from "./player";

export interface AdsStats {
  loadTimes: number[];
  started: number;
  playedCompletely: number;
  skipped: number;
}

export interface AdCuePoint {
  start: number;
  end: number|null;
}

/**
 * An object that's responsible for all the ad-related logic
 * in the player.
 *
 * @exportDoc
 */
export interface IAdManager extends EventTarget {
  setLocale(locale: string) ;

  release() ;

  onAssetUnload() ;

  initClientSide(adContainer: HTMLElement, video: HTMLMediaElement) ;

  requestClientSideAds(imaRequest: google.ima.AdsRequest) ;

  initServerSide(adContainer: HTMLElement, video: HTMLMediaElement) ;

  requestServerSideStream(
      imaRequest: google.ima.dai.api.StreamRequest,
      backupUrl?: string): Promise<string> ;

  replaceServerSideAdTagParameters(adTagParameters: Object) ;

  getServerSideCuePoints(): AdCuePoint[] ;

  /**
   * Get statistics for the current playback session. If the player is not
   * playing content, this will return an empty stats object.
   */
  getStats() ;

  onDashTimedMetadata(region: TimelineRegionInfo) ;

  onHlsTimedMetadata(
      metadata: shaka.extern.ID3Metadata, timestampOffset: number) ;

  onCueMetadataChange(value: shaka.extern.ID3Metadata) ;
};
type Factory = () => IAdManager;

/**
 * Interface for Ad objects.
 *
 * @exportDoc
 */
export interface IAd {
  getDuration(): number;

  /**
   * Gets the minimum suggested duration.  Defaults to being equivalent to
   * getDuration() for server-side ads.
   * @see http://bit.ly/3q3U6hI
   */
  getMinSuggestedDuration(): number ;

  getRemainingTime(): number ;

  getTimeUntilSkippable(): number ;

  isPaused(): boolean ;

  isSkippable(): boolean ;

  canSkipNow(): boolean ;

  skip() ;

  play();

  pause() ;

  getVolume(): number ;

  setVolume(volume: number) ;

  isMuted(): boolean ;

  setMuted(muted: boolean) ;

  isLinear(): boolean ;

  resize(width: number, height: number) ;

  getSequenceLength(): number ;

  getPositionInSequence(): number ;
};
