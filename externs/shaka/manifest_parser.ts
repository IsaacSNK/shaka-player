/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NetworkingEngine } from "../../lib/net/networking_engine";
import { ManifestInfo, SegmentInfo } from "../../lib/util/cmcd_manager";
import { Manifest } from "./manifest";
import { ManifestConfiguration, TimelineRegionInfo } from "./player";
import { ShakaError } from "./util/error";
/**
 * Parses media manifests and handles manifest updates.
 *
 * Given a URI where the initial manifest is found, a parser will request the
 * manifest, parse it, and return the resulting Manifest object.
 *
 * If the manifest requires updates (e.g. for live media), the parser will use
 * background timers to update the same Manifest object.
 *
 * There are many ways for |start| and |stop| to be called. Implementations
 * should support all cases:
 *
 *  BASIC
 *    await parser.start(uri, playerInterface);
 *    await parser.stop();
 *
 *  INTERRUPTING
 *    const p = parser.start(uri, playerInterface);
 *    await parser.stop();
 *    await p;
 *
 *    |p| should be rejected with an OPERATION_ABORTED error.
 *
 *  STOPPED BEFORE STARTING
 *    await parser.stop();
 *
 * @exportDoc
 */
declare class ManifestParser{
  /**
   * Called by the Player to provide an updated configuration any time the
   * configuration changes.  Will be called at least once before start().
   *
   * @exportDoc
   */
  configure(config: ManifestConfiguration) ;

  /**
   * Initialize and start the parser. When |start| resolves, it should return
   * the initial version of the manifest. |start| will only be called once. If
   * |stop| is called while |start| is pending, |start| should reject.
   *
   * @param uri The URI of the manifest.
   *    The player interface contains the callbacks and members that the parser
   *    can use to communicate with the player and outside world.
   * @exportDoc
   */
  start(
      uri: string,
      playerInterface: PlayerInterface):
      Promise<Manifest> ;

  /**
   * Tell the parser that it must stop and free all internal resources as soon
   * as possible. Only once all internal resources are stopped and freed will
   * the promise resolve. Once stopped a parser will not be started again.
   *
   * The parser should support having |stop| called multiple times and the
   * promise should always resolve.
   *
   * @exportDoc
   */
  stop(): Promise<any> ;

  /**
   * Tells the parser to do a manual manifest update.  Implementing this is
   * optional.  This is only called when 'emsg' boxes are present.
   * @exportDoc
   */
  update() ;

  /**
   * Tells the parser that the expiration time of an EME session has changed.
   * Implementing this is optional.
   *
   * @exportDoc
   */
  onExpirationUpdated(sessionId: string, expiration: number);
};

export interface PlayerInterface {
  networkingEngine: NetworkingEngine;
  modifyManifestRequest:
      (p1: Request,
       p2: ManifestInfo) => any;
  modifySegmentRequest:
      (p1: Request, p2: SegmentInfo) => any;
  filter: (p1: Manifest) => Promise<any>;
  makeTextStreamsForClosedCaptions: (p1: Manifest) => any;
  onTimelineRegionAdded: (p1: TimelineRegionInfo) => any;
  onEvent: (p1: Event) => any;
  onError: (p1: ShakaError) => any;
  isLowLatencyMode: () => boolean;
  isAutoLowLatencyMode: () => boolean;
  enableLowLatencyMode: () => any;
  updateDuration: () => any;
}
type Factory = () => ManifestParser;
