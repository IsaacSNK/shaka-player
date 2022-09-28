/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  encrypted
 *   A map of key system name to whether it supports offline playback.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface OfflineSupport {
    basic: boolean;
    encrypted: { [key: string]: boolean };
  }
}
/**
 *  isIncomplete
 *   If true, the content is still downloading.  Manifests with this set cannot
 *   be played yet.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface StoredContent {
    offlineUri: string | null;
    originalManifestUri: string;
    duration: number;
    size: number;
    expiration: number;
    tracks: shaka.extern.Track[];
    appMetadata: Object;
    isIncomplete: boolean;
  }
}
/**
 *  sequenceMode
 *   If true, we will append the media segments using sequence mode; that is to
 *   say, ignoring any timestamps inside the media files.
 */
declare namespace shaka.extern {
  export interface ManifestDB {
    creationTime: number;
    originalManifestUri: string;
    duration: number;
    size: number;
    expiration: number;
    streams: shaka.extern.StreamDB[];
    sessionIds: string[];
    drmInfo: shaka.extern.DrmInfo | null;
    appMetadata: Object;
    isIncomplete: boolean | undefined;
    sequenceMode: boolean | undefined;
  }
}
/**
 *  tilesLayout
 *   The value is a grid-item-dimension consisting of two positive decimal
 *   integers in the format: column-x-row ('4x3'). It describes the arrangement
 *   of Images in a Grid. The minimum valid LAYOUT is '1x1'.
 */
declare namespace shaka.extern {
  export interface StreamDB {
    id: number;
    originalId: string | null;
    primary: boolean;
    type: string;
    mimeType: string;
    codecs: string;
    frameRate: number | undefined;
    pixelAspectRatio: string | undefined;
    hdr: string | undefined;
    kind: string | undefined;
    language: string;
    label: string | null;
    width: number | null;
    height: number | null;
    encrypted: boolean;
    keyIds: Set<string>;
    segments: shaka.extern.SegmentDB[];
    variantIds: number[];
    roles: string[];
    forced: boolean;
    channelsCount: number | null;
    audioSamplingRate: number | null;
    spatialAudio: boolean;
    closedCaptions: Map<string, string>;
    tilesLayout: string | undefined;
  }
}
/**
 *  dataKey
 *   The key to the data in storage.
 */
declare namespace shaka.extern {
  export interface SegmentDB {
    initSegmentKey: number | null;
    startTime: number;
    endTime: number;
    appendWindowStart: number;
    appendWindowEnd: number;
    timestampOffset: number;
    tilesLayout: string | null;
    pendingSegmentRefId: string | undefined;
    pendingInitSegmentRefId: string | undefined;
    dataKey: number;
  }
}
/**
 *  data
 *   The data contents of the segment.
 */
declare namespace shaka.extern {
  export interface SegmentDataDB {
    data: ArrayBuffer;
  }
}
/**
 *  videoCapabilities
 *   The EME video capabilities used to create the session.
 */
declare namespace shaka.extern {
  export interface EmeSessionDB {
    sessionId: string;
    keySystem: string;
    licenseUri: string;
    serverCertificate: Uint8Array;
    audioCapabilities: MediaKeySystemMediaCapability[];
    videoCapabilities: MediaKeySystemMediaCapability[];
  }
}
declare namespace shaka.extern {
  class StorageCell {
    /**
     * Free all resources used by this cell. This should not affect the stored
     * content.
     *
     */
    // @ts-ignore
    destroy(): Promise;

    /**
     * Check if the cell can support new keys. If a cell has a fixed key space,
     * then all add-operations will fail as no new keys can be added. All
     * remove-operations and update-operations should still work.
     *
     */
    hasFixedKeySpace(): boolean;

    /**
     * Add a group of segments. Will return a promise that resolves with a list
     * of keys for each segment. If one segment fails to be added, all segments
     * should fail to be added.
     *
     */
    addSegments(segments: shaka.extern.SegmentDataDB[]): Promise<number[]>;

    /**
     * Remove a group of segments using their keys to identify them. If a key
     * is not found, then that removal should be considered successful.
     *
     * @param onRemove A callback for when a segment is removed
     *                                    from the cell. The key of the segment
     *                                    will be passed to the callback.
     */
    // @ts-ignore
    removeSegments(keys: number[], onRemove: (p1: number) => any): Promise;

    /**
     * Get a group of segments using their keys to identify them. If any key is
     * not found, the promise chain will be rejected.
     *
     */
    getSegments(keys: number[]): Promise<shaka.extern.SegmentDataDB[]>;

    /**
     * Add a group of manifests. Will return a promise that resolves with a list
     * of keys for each manifest. If one manifest fails to be added, all manifests
     * should fail to be added.
     *
     * @return keys
     */
    addManifests(manifests: shaka.extern.ManifestDB[]): Promise<number[]>;

    /**
     * Updates the given manifest, stored at the given key.
     *
     */
    // @ts-ignore
    updateManifest(key: number, manifest: shaka.extern.ManifestDB): Promise;

    /**
     * Replace the expiration time of the manifest stored under |key| with
     * |newExpiration|. If no manifest is found under |key| then this should
     * act as a no-op.
     *
     */
    // @ts-ignore
    updateManifestExpiration(key: number, expiration: number): Promise;

    /**
     * Remove a group of manifests using their keys to identify them. If a key
     * is not found, then that removal should be considered successful.
     *
     * @param onRemove A callback for when a manifest is
     *                                    removed from the cell. The key of the
     *                                    manifest will be passed to the callback.
     */
    // @ts-ignore
    removeManifests(keys: number[], onRemove: (p1: number) => any): Promise;

    /**
     * Get a group of manifests using their keys to identify them. If any key is
     * not found, the promise chain will be rejected.
     *
     */
    getManifests(keys: number[]): Promise<shaka.extern.ManifestDB[]>;

    /**
     * Get all manifests stored in this cell. Since manifests are small compared
     * to the asset they describe, it is assumed that it is feasible to have them
     * all in main memory at one time.
     *
     */
    getAllManifests(): Promise<Map<number, shaka.extern.ManifestDB>>;
  }
}
declare namespace shaka.extern {
  class EmeSessionStorageCell {
    /**
     * Free all resources used by this cell. This won't affect the stored content.
     */
    // @ts-ignore
    destroy(): Promise;

    /**
     * Gets the currently stored sessions.
     */
    getAll(): Promise<shaka.extern.EmeSessionDB[]>;

    /**
     * Adds the given sessions to the store.
     */
    // @ts-ignore
    add(sessions: shaka.extern.EmeSessionDB[]): Promise;

    /**
     * Removes the given session IDs from the store.
     */
    // @ts-ignore
    remove(sessionIds: string[]): Promise;
  }
}
declare namespace shaka.extern {
  class StorageMechanism {
    /**
     * Initialize the storage mechanism for first use. This should only be called
     * once. Calling |init| multiple times has an undefined behaviour.
     *
     */
    // @ts-ignore
    init(): Promise;

    /**
     * Free all resources used by the storage mechanism and its cells. This should
     * not affect the stored content.
     *
     */
    // @ts-ignore
    destroy(): Promise;

    /**
     * Get a map of all the cells managed by the storage mechanism. Editing the
     * map should have no effect on the storage mechanism. The map key is the
     * cell's address in the mechanism and should be consistent between calls to
     * |getCells|.
     *
     */
    getCells(): Map<string, shaka.extern.StorageCell>;

    /**
     * Get the current EME session storage cell.
     */
    getEmeSessionCell(): shaka.extern.EmeSessionStorageCell;

    /**
     * Erase all content from storage and leave storage in an empty state. Erase
     * may be called with or without |init|.  This allows for storage to be wiped
     * in case of a version mismatch.
     *
     * After calling |erase|, the mechanism will be in an initialized state.
     *
     */
    // @ts-ignore
    erase(): Promise;
  }
}
