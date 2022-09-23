/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Variant } from "./manifest";
import { AbrConfiguration } from "./player";

/**
 * An object which selects Streams from a set of possible choices.  This also
 * watches for system changes to automatically adapt for the current streaming
 * requirements.  For example, when the network slows down, this class is in
 * charge of telling the Player which streams to switch to in order to reduce
 * the required bandwidth.
 *
 * This class is given a set of streams to choose from when the Player starts
 * up.  This class should store these and use them to make future decisions
 * about ABR.  It is up to this class how those decisions are made.  All the
 * Player will do is tell this class what streams to choose from.
 *
 * @exportDoc
 */
export declare class AbrManager {
  /**
   * Initializes the AbrManager.
   *
   * @exportDoc
   */
  init(switchCallback: SwitchCallback) ;

  /**
   * Stops any background timers and frees any objects held by this instance.
   * This will only be called after a call to init.
   *
   * @exportDoc
   */
  stop() ;

  /**
   * Updates manager's variants collection.
   *
   * @exportDoc
   */
  setVariants(variants: Variant[]) ;

  /**
   * Chooses one variant to switch to.  Called by the Player.
   * @exportDoc
   */
  chooseVariant(): Variant ;

  /**
   * Enables automatic Variant choices from the last ones passed to setVariants.
   * After this, the AbrManager may call switchCallback() at any time.
   *
   * @exportDoc
   */
  enable() ;

  /**
   * Disables automatic Stream suggestions. After this, the AbrManager may not
   * call switchCallback().
   *
   * @exportDoc
   */
  disable() ;

  /**
   * Notifies the AbrManager that a segment has been downloaded (includes MP4
   * SIDX data, WebM Cues data, initialization segments, and media segments).
   *
   * @param deltaTimeMs The duration, in milliseconds, that the request
   *     took to complete.
   * @param numBytes The total number of bytes transferred.
   * @exportDoc
   */
  segmentDownloaded(deltaTimeMs: number, numBytes: number) ;

  /**
   * Gets an estimate of the current bandwidth in bit/sec.  This is used by the
   * Player to generate stats.
   *
   * @exportDoc
   */
  getBandwidthEstimate(): number ;

  /**
   * Updates manager playback rate.
   *
   * @exportDoc
   */
  playbackRateChanged(rate: number) ;

  /**
   * Set media element.
   *
   * @exportDoc
   */
  setMediaElement(mediaElement: HTMLMediaElement) ;

  /**
   * Sets the ABR configuration.
   *
   * It is the responsibility of the AbrManager implementation to implement the
   * restrictions behavior described in shaka.extern.AbrConfiguration.
   *
   * @exportDoc
   */
  configure(config: AbrConfiguration) ;
};

export type SwitchCallback = (p1: Variant, p2?: boolean, p3?: number) => any;

export type Factory = () => AbrManager;
