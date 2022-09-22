/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * @externs
 */

/**
 * @typedef {{
 *   loadTimes: !Array.<number>,
 *   started: number,
 *   playedCompletely: number,
 *   skipped: number
 * }}
 *
 * @description
 * Contains statistics and information about the current state of the player.
 *
 * @property {number} loadTimes
 *   The set of amounts of time it took to get the final manifest.
 * @property {number} started
 *   The number of ads started.
 * @property {number} playedCompletely
 *   The number of ads played completely.
 * @property {number} skipped
 *   The number of ads skipped.
 * @exportDoc
 */
export type AdsStats = { loadTimes : number [] , playedCompletely : number , skipped : number , started : number } ;


/**
 * @typedef {{
 *   start: number,
 *   end: ?number
 * }}
 *
 * @description
 * Contains the times of a range of an Ad.
 *
 * @property {number} start
 *   The start time of the range, in milliseconds.
 * @property {number} end
 *   The end time of the range, in milliseconds.
 * @exportDoc
 */
export type AdCuePoint = { end : number | null , start : number } ;


/**
 * An object that's responsible for all the ad-related logic
 * in the player.
 *
 * @interface
 * @exportDoc
 */
 interface IAdManager extends EventTarget {
  getServerSideCuePoints ( ) : AdCuePoint [] ;
  /**
   * Get statistics for the current playback session. If the player is not
   * playing content, this will return an empty stats object.
   */
  getStats ( ) : any ;
  initClientSide (adContainer : HTMLElement , video : HTMLMediaElement ) : any ;
  initServerSide (adContainer : HTMLElement , video : HTMLMediaElement ) : any ;
  onAssetUnload ( ) : any ;
  onCueMetadataChange (value : shaka.extern.ID3Metadata ) : any ;
  onDashTimedMetadata (region : shaka.extern.TimelineRegionInfo ) : any ;
  onHlsTimedMetadata (metadata : shaka.extern.ID3Metadata , timestampOffset : number ) : any ;
  release ( ) : any ;
  replaceServerSideAdTagParameters (adTagParameters : object | null ) : any ;
  requestClientSideAds (imaRequest : google.ima.AdsRequest ) : any ;
  requestServerSideStream (imaRequest : google.ima.dai.api.StreamRequest , backupUrl ? : string ) : Promise < string > ;
  setLocale (locale : string ) : any ;
}


/**
 * A factory for creating the ad manager.
 *
 * @typedef {function():!IAdManager}
 * @exportDoc
 */
export type Factory = ( ) => IAdManager ;


/**
 * Interface for Ad objects.
 *
 * @extends {shaka.util.IReleasable}
 * @interface
 * @exportDoc
 */
 interface IAd extends shaka.util.IReleasable {
  canSkipNow ( ) : boolean ;
  getDuration ( ) : number ;
  /**
   * Gets the minimum suggested duration.  Defaults to being equivalent to
   * getDuration() for server-side ads.
   */
  getMinSuggestedDuration ( ) : number ;
  getPositionInSequence ( ) : number ;
  getRemainingTime ( ) : number ;
  getSequenceLength ( ) : number ;
  getTimeUntilSkippable ( ) : number ;
  getVolume ( ) : number ;
  isLinear ( ) : boolean ;
  isMuted ( ) : boolean ;
  isPaused ( ) : boolean ;
  isSkippable ( ) : boolean ;
  pause ( ) : any ;
  play ( ) : any ;
  resize (width : number , height : number ) : any ;
  setMuted (muted : boolean ) : any ;
  setVolume (volume : number ) : any ;
  skip ( ) : any ;
}
