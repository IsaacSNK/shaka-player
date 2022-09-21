/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import {EmeSessionStorageCell} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.eme_session_storage_cell';
import {V1StorageCell} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.v1_storage_cell';
import {V2StorageCell} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.v2_storage_cell';
import {V5StorageCell} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.v5_storage_cell';
import * as StorageMuxerExports from './dev-workspace.shaka-player-fork.lib.offline.storage_muxer';
import {StorageMuxer} from './dev-workspace.shaka-player-fork.lib.offline.storage_muxer';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import * as PlatformExports from './dev-workspace.shaka-player-fork.lib.util.platform';
import {Platform} from './dev-workspace.shaka-player-fork.lib.util.platform';
import {PublicPromise} from './dev-workspace.shaka-player-fork.lib.util.public_promise';

/**
 * A storage mechanism to manage storage cells for an indexed db instance.
 * The cells are just for interacting with the stores that are found in the
 * database instance. The mechanism is responsible for creating new stores
 * when opening the database. If the database is too old of a version, a
 * cell will be added for the old stores but the cell won't support add
 * operations. The mechanism will create the new versions of the stores and
 * will allow add operations for those stores.
 *
 */
export class StorageMechanism implements shaka.
extern.StorageMechanism {
  private db_: IDBDatabase = null;
  private v1_: shaka.extern.StorageCell = null;
  private v2_: shaka.extern.StorageCell = null;
  private v3_: shaka.extern.StorageCell = null;
  private v5_: shaka.extern.StorageCell = null;
  private sessions_: shaka.extern.EmeSessionStorageCell = null;

  /**
   * @override
   */
  init() {
    const name = DB_NAME;
    const version = VERSION;
    const p = new PublicPromise();
    const open = window.indexedDB.open(name, version);
    open.onsuccess = (event) => {
      const db = open.result;
      this.db_ = db;
      this.v1_ = StorageMechanism.createV1_(db);
      this.v2_ = StorageMechanism.createV2_(db);
      this.v3_ = StorageMechanism.createV3_(db);

      // NOTE: V4 of the database was when we introduced a special table to
      // store EME session IDs.  It has no separate storage cell, so we skip to
      // V5.
      this.v5_ = StorageMechanism.createV5_(db);
      this.sessions_ = StorageMechanism.createEmeSessionCell_(db);
      p.resolve();
    };
    open.onupgradeneeded = (event) => {
      // Add object stores for the latest version only.
      this.createStores_(open.result);
    };
    open.onerror = (event) => {
      p.reject(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.INDEXED_DB_ERROR, open.error));

      // Firefox will raise an error on the main thread unless we stop it here.
      event.preventDefault();
    };
    return p;
  }

  /**
   * @override
   */
  async destroy() {
    if (this.v1_) {
      await this.v1_.destroy();
    }
    if (this.v2_) {
      await this.v2_.destroy();
    }
    if (this.v3_) {
      await this.v3_.destroy();
    }
    if (this.v5_) {
      await this.v5_.destroy();
    }
    if (this.sessions_) {
      await this.sessions_.destroy();
    }

    // If we were never initialized, then |db_| will still be null.
    if (this.db_) {
      this.db_.close();
    }
  }

  /**
   * @override
   */
  getCells() {
    const map = new Map();
    if (this.v1_) {
      map.set('v1', this.v1_);
    }
    if (this.v2_) {
      map.set('v2', this.v2_);
    }
    if (this.v3_) {
      map.set('v3', this.v3_);
    }
    if (this.v5_) {
      map.set('v5', this.v5_);
    }
    return map;
  }

  /**
   * @override
   */
  getEmeSessionCell() {
    asserts.assert(this.sessions_, 'Cannot be destroyed.');
    return this.sessions_;
  }

  /**
   * @override
   */
  async erase() {
    // Not all cells may have been created, so only destroy the ones that
    // were created.
    if (this.v1_) {
      await this.v1_.destroy();
    }
    if (this.v2_) {
      await this.v2_.destroy();
    }
    if (this.v3_) {
      await this.v3_.destroy();
    }
    if (this.v5_) {
      await this.v5_.destroy();
    }

    // |db_| will only be null if the muxer was not initialized. We need to
    // close the connection in order delete the database without it being
    // blocked.
    if (this.db_) {
      this.db_.close();
    }
    await StorageMechanism.deleteAll_();

    // Reset before initializing.
    this.db_ = null;
    this.v1_ = null;
    this.v2_ = null;
    this.v3_ = null;
    this.v5_ = null;
    await this.init();
  }

  private static createV1_(db: IDBDatabase): shaka.extern.StorageCell {
    const StorageMechanism = StorageMechanism;
    const segmentStore = StorageMechanism.V1_SEGMENT_STORE;
    const manifestStore = StorageMechanism.V1_MANIFEST_STORE;
    const stores = db.objectStoreNames;
    if (stores.contains(manifestStore) && stores.contains(segmentStore)) {
      log.debug('Mounting v1 idb storage cell');
      return new V1StorageCell(db, segmentStore, manifestStore);
    }
    return null;
  }

  private static createV2_(db: IDBDatabase): shaka.extern.StorageCell {
    const StorageMechanism = StorageMechanism;
    const segmentStore = StorageMechanism.V2_SEGMENT_STORE;
    const manifestStore = StorageMechanism.V2_MANIFEST_STORE;
    const stores = db.objectStoreNames;
    if (stores.contains(manifestStore) && stores.contains(segmentStore)) {
      log.debug('Mounting v2 idb storage cell');
      return new V2StorageCell(db, segmentStore, manifestStore);
    }
    return null;
  }

  private static createV3_(db: IDBDatabase): shaka.extern.StorageCell {
    const StorageMechanism = StorageMechanism;
    const segmentStore = StorageMechanism.V3_SEGMENT_STORE;
    const manifestStore = StorageMechanism.V3_MANIFEST_STORE;
    const stores = db.objectStoreNames;
    if (stores.contains(manifestStore) && stores.contains(segmentStore)) {
      log.debug('Mounting v3 idb storage cell');

      // Version 3 uses the same structure as version 2, so we can use the same
      // cells but it can support new entries.
      return new V2StorageCell(db, segmentStore, manifestStore);
    }
    return null;
  }

  private static createV5_(db: IDBDatabase): shaka.extern.StorageCell {
    const StorageMechanism = StorageMechanism;
    const segmentStore = StorageMechanism.V5_SEGMENT_STORE;
    const manifestStore = StorageMechanism.V5_MANIFEST_STORE;
    const stores = db.objectStoreNames;
    if (stores.contains(manifestStore) && stores.contains(segmentStore)) {
      log.debug('Mounting v5 idb storage cell');
      return new V5StorageCell(db, segmentStore, manifestStore);
    }
    return null;
  }

  private static createEmeSessionCell_(db: IDBDatabase):
      shaka.extern.EmeSessionStorageCell {
    const StorageMechanism = StorageMechanism;
    const store = StorageMechanism.SESSION_ID_STORE;
    if (db.objectStoreNames.contains(store)) {
      log.debug('Mounting session ID idb storage cell');
      return new EmeSessionStorageCell(db, store);
    }
    return null;
  }

  private createStores_(db: IDBDatabase) {
    const storeNames = [V5_SEGMENT_STORE, V5_MANIFEST_STORE, SESSION_ID_STORE];
    for (const name of storeNames) {
      if (!db.objectStoreNames.contains(name)) {
        db.createObjectStore(name, {autoIncrement: true});
      }
    }
  }

  /**
   * Delete the indexed db instance so that all stores are deleted and cleared.
   * This will force the database to a like-new state next time it opens.
   *
   */
  private static deleteAll_(): Promise {
    const name = DB_NAME;
    const p = new PublicPromise();
    const del = window.indexedDB.deleteDatabase(name);
    del.onblocked = (event) => {
      log.warning('Deleting', name, 'is being blocked', event);
    };
    del.onsuccess = (event) => {
      p.resolve();
    };
    del.onerror = (event) => {
      p.reject(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.INDEXED_DB_ERROR, del.error));

      // Firefox will raise an error on the main thread unless we stop it here.
      event.preventDefault();
    };
    return p;
  }
}

export const DB_NAME: string = 'shaka_offline_db';

export const VERSION: number = 5;

export const V1_SEGMENT_STORE: string = 'segment';

export const V2_SEGMENT_STORE: string = 'segment-v2';

export const V3_SEGMENT_STORE: string = 'segment-v3';

export const V5_SEGMENT_STORE: string = 'segment-v5';

export const V1_MANIFEST_STORE: string = 'manifest';

export const V2_MANIFEST_STORE: string = 'manifest-v2';

export const V3_MANIFEST_STORE: string = 'manifest-v3';

export const V5_MANIFEST_STORE: string = 'manifest-v5';

export const SESSION_ID_STORE: string = 'session-ids';

// Since this may be called before the polyfills remove indexeddb support from
// some platforms (looking at you Chromecast), we need to check for support
// when we create the mechanism.
// Thankfully the storage muxer api allows us to return a null mechanism
// to indicate that the mechanism is not supported on this platform.
StorageMuxer.register('idb', () => {
  // Offline storage is not supported on the Chromecast or Xbox One
  // platforms.
  if (Platform.isChromecast() || Platform.isXboxOne()) {
    return null;
  }

  // Offline storage requires the IndexedDB API.
  if (!window.indexedDB) {
    return null;
  }
  return new StorageMechanism();
});
