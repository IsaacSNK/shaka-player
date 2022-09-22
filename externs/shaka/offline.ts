/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmInfo } from "./manifest";
import { Track } from "./player";

export interface OfflineSupport {
  basic: boolean;
  encrypted: {[key: string]: boolean};
}

export interface StoredContent {
  offlineUri: string|null;
  originalManifestUri: string;
  duration: number;
  size: number;
  expiration: number;
  tracks: Track[];
  appMetadata: Object;
  isIncomplete: boolean;
}

export interface ManifestDB {
  creationTime: number;
  originalManifestUri: string;
  duration: number;
  size: number;
  expiration: number;
  streams:StreamDB[];
  sessionIds: string[];
  drmInfo: DrmInfo|null;
  appMetadata: Object;
  isIncomplete: boolean|undefined;
  sequenceMode: boolean|undefined;
}

export interface StreamDB {
  id: number;
  originalId: string|null;
  primary: boolean;
  type: string;
  mimeType: string;
  codecs: string;
  frameRate: number|undefined;
  pixelAspectRatio: string|undefined;
  hdr: string|undefined;
  kind: string|undefined;
  language: string;
  label: string|null;
  width: number|null;
  height: number|null;
  encrypted: boolean;
  keyIds: Set<string>;
  segments: SegmentDB[];
  variantIds: number[];
  roles: string[];
  forced: boolean;
  channelsCount: number|null;
  audioSamplingRate: number|null;
  spatialAudio: boolean;
  closedCaptions: Map<string, string>;
  tilesLayout: string|undefined;
}

export interface SegmentDB {
  initSegmentKey: number|null;
  startTime: number;
  endTime: number;
  appendWindowStart: number;
  appendWindowEnd: number;
  timestampOffset: number;
  tilesLayout: string|null;
  pendingSegmentRefId: string|undefined;
  pendingInitSegmentRefId: string|undefined;
  dataKey: number;
}

export interface SegmentDataDB {
  data: ArrayBuffer;
}

export interface EmeSessionDB {
  sessionId: string;
  keySystem: string;
  licenseUri: string;
  serverCertificate: Uint8Array;
  audioCapabilities: MediaKeySystemMediaCapability[];
  videoCapabilities: MediaKeySystemMediaCapability[];
}

/**
 * An interface that defines access to collection of segments and manifests. All
 * methods are designed to be batched operations allowing the implementations to
 * optimize their operations based on how they store data.
 *
 * The storage cell is one of two exposed APIs used to control where and how
 * offline content is saved. The storage cell is responsible for converting
 * information between its internal structures and the external (library)
 * structures.
 *
 */
export interface StorageCell{
  /**
   * Free all resources used by this cell. This should not affect the stored
   * content.
   *
   */
  destroy(): Promise<any> ;

  /**
   * Check if the cell can support new keys. If a cell has a fixed key space,
   * then all add-operations will fail as no new keys can be added. All
   * remove-operations and update-operations should still work.
   *
   */
  hasFixedKeySpace(): boolean ;

  /**
   * Add a group of segments. Will return a promise that resolves with a list
   * of keys for each segment. If one segment fails to be added, all segments
   * should fail to be added.
   *
   */
  addSegments(segments: SegmentDataDB[]): Promise<number[]> ;

  /**
   * Remove a group of segments using their keys to identify them. If a key
   * is not found, then that removal should be considered successful.
   *
   * @param onRemove A callback for when a segment is removed
   *                                    from the cell. The key of the segment
   *                                    will be passed to the callback.
   */
  removeSegments(keys: number[], onRemove: (p1: number) => any): Promise<any> ;

  /**
   * Get a group of segments using their keys to identify them. If any key is
   * not found, the promise chain will be rejected.
   *
   */
  getSegments(keys: number[]): Promise<SegmentDataDB[]> ;

  /**
   * Add a group of manifests. Will return a promise that resolves with a list
   * of keys for each manifest. If one manifest fails to be added, all manifests
   * should fail to be added.
   *
   * @return keys
   */
  addManifests(manifests: ManifestDB[]): Promise<number[]> ;

  /**
   * Updates the given manifest, stored at the given key.
   *
   */
  updateManifest(key: number, manifest: ManifestDB): Promise<any> ;

  /**
   * Replace the expiration time of the manifest stored under |key| with
   * |newExpiration|. If no manifest is found under |key| then this should
   * act as a no-op.
   *
   */
  updateManifestExpiration(key: number, expiration: number): Promise<any> ;

  /**
   * Remove a group of manifests using their keys to identify them. If a key
   * is not found, then that removal should be considered successful.
   *
   * @param onRemove A callback for when a manifest is
   *                                    removed from the cell. The key of the
   *                                    manifest will be passed to the callback.
   */
  removeManifests(keys: number[], onRemove: (p1: number) => any): Promise<any> ;

  /**
   * Get a group of manifests using their keys to identify them. If any key is
   * not found, the promise chain will be rejected.
   *
   */
  getManifests(keys: number[]): Promise<ManifestDB[]> ;

  /**
   * Get all manifests stored in this cell. Since manifests are small compared
   * to the asset they describe, it is assumed that it is feasible to have them
   * all in main memory at one time.
   *
   */
  getAllManifests(): Promise<Map<number, ManifestDB>> ;
};

/**
 * Similar to storage cells (shaka.extern.StorageCell), an EmeSessionStorageCell
 * stores data persistently.  This only stores the license's session info, not
 * the license itself.  The license itself is stored using EME.
 *
 */
export interface EmeSessionStorageCell{
  /**
   * Free all resources used by this cell. This won't affect the stored content.
   */
  destroy(): Promise<any> ;

  /**
   * Gets the currently stored sessions.
   */
  getAll(): Promise<EmeSessionDB[]> ;

  /**
   * Adds the given sessions to the store.
   */
  add(sessions: EmeSessionDB[]): Promise<any> ;

  /**
   * Removes the given session IDs from the store.
   */
  remove(sessionIds: string[]): Promise<any> ;
};

/**
 * Storage mechanisms are one of two exported storage APIs. Storage mechanisms
 * are groups of storage cells (shaka.extern.StorageCell). Storage mechanisms
 * are responsible for managing the life cycle of resources shared between
 * storage cells in the same block.
 *
 * For example, a storage mechanism may manage a single database connection
 * while each cell would manage different tables in the database via the same
 * connection.
 *
 */
export  interface StorageMechanism{
  /**
   * Initialize the storage mechanism for first use. This should only be called
   * once. Calling |init| multiple times has an undefined behaviour.
   *
   */
  init(): Promise<any> ;

  /**
   * Free all resources used by the storage mechanism and its cells. This should
   * not affect the stored content.
   *
   */
  destroy(): Promise<any> ;

  /**
   * Get a map of all the cells managed by the storage mechanism. Editing the
   * map should have no effect on the storage mechanism. The map key is the
   * cell's address in the mechanism and should be consistent between calls to
   * |getCells|.
   *
   */
  getCells(): Map<string, StorageCell> ;

  /**
   * Get the current EME session storage cell.
   */
  getEmeSessionCell(): EmeSessionStorageCell ;

  /**
   * Erase all content from storage and leave storage in an empty state. Erase
   * may be called with or without |init|.  This allows for storage to be wiped
   * in case of a version mismatch.
   *
   * After calling |erase|, the mechanism will be in an initialized state.
   *
   */
  erase(): Promise<any> ;
};
