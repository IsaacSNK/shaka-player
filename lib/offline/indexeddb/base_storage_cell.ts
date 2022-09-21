/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {DBConnection} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.db_connection';
import {DBOperation} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.db_operation';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';

/**
 * indexeddb.StorageCellBase is a base class for all stores that use IndexedDB.
 *
 */
export class BaseStorageCell implements shaka.
extern.StorageCell {
  protected connection_: DBConnection;
  protected segmentStore_: string;
  protected manifestStore_: string;

  constructor(
      connection: IDBDatabase, segmentStore: string, manifestStore: string) {
    this.connection_ = new DBConnection(connection);
    this.segmentStore_ = segmentStore;
    this.manifestStore_ = manifestStore;
  }

  /** @override */
  destroy() {
    return this.connection_.destroy();
  }

  /** @override */
  hasFixedKeySpace() {
    // By default, all IDB stores are read-only.  The latest one will need to
    // override this default to be read-write.
    return true;
  }

  /** @override */
  addSegments(segments) {
    // By default, reject all additions.
    return this.rejectAdd(this.segmentStore_);
  }

  /** @override */
  removeSegments(keys, onRemove) {
    return this.remove_(this.segmentStore_, keys, onRemove);
  }

  /** @override */
  async getSegments(keys) {
    const rawSegments = await this.get_(this.segmentStore_, keys);
    return rawSegments.map((s) => this.convertSegmentData(s));
  }

  /** @override */
  addManifests(manifests) {
    // By default, reject all additions.
    return this.rejectAdd(this.manifestStore_);
  }

  /** @override */
  updateManifest(key, manifest) {
    // By default, reject all updates.
    return this.rejectUpdate(this.manifestStore_);
  }

  protected updateManifestImplementation(
      key: number, manifest: shaka.extern.ManifestDB): Promise {
    const op = this.connection_.startReadWriteOperation(this.manifestStore_);
    const store = op.store();
    store.get(key).onsuccess = (e) => {
      store.put(manifest, key);
    };
    return op.promise();
  }

  /** @override */
  updateManifestExpiration(key, newExpiration) {
    const op = this.connection_.startReadWriteOperation(this.manifestStore_);
    const store = op.store();
    store.get(key).onsuccess = (e) => {
      const manifest = e.target.result;

      // If we can't find the value, then there is nothing for us to update.
      if (manifest) {
        manifest.expiration = newExpiration;
        store.put(manifest, key);
      }
    };
    return op.promise();
  }

  /** @override */
  removeManifests(keys, onRemove) {
    return this.remove_(this.manifestStore_, keys, onRemove);
  }

  /** @override */
  async getManifests(keys) {
    const rawManifests = await this.get_(this.manifestStore_, keys);
    return Promise.all(rawManifests.map((m) => this.convertManifest(m)));
  }

  /** @override */
  async getAllManifests() {
    const op: DBOperation =
        this.connection_.startReadOnlyOperation(this.manifestStore_);
    const values: Map<number, shaka.extern.ManifestDB> = new Map();
    await op.forEachEntry(async (key, value) => {
      const manifest = await this.convertManifest(value);
      values.set((key as number), manifest);
    });
    await op.promise();
    return values;
  }

  protected convertSegmentData(old: any): shaka.extern.SegmentDataDB {
    // Conversion is specific to each subclass.  By default, do nothing.
    return (old as shaka.extern.SegmentDataDB);
  }

  protected convertManifest(old: any): Promise<shaka.extern.ManifestDB> {
    // Conversion is specific to each subclass.  By default, do nothing.
    return Promise.resolve((old as shaka.extern.ManifestDB));
  }

  protected rejectAdd(storeName: string): Promise {
    return Promise.reject(new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
        ErrorExports.Code.NEW_KEY_OPERATION_NOT_SUPPORTED,
        'Cannot add new value to ' + storeName));
  }

  protected rejectUpdate(storeName: string): Promise {
    return Promise.reject(new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
        ErrorExports.Code.MODIFY_OPERATION_NOT_SUPPORTED,
        'Cannot modify values in ' + storeName));
  }

  /**
   * @template T
   */
  protected async add(storeName: string, values: T[]): Promise<number[]> {
    const op = this.connection_.startReadWriteOperation(storeName);
    const store = op.store();
    const keys: number[] = [];

    // Write each segment out. When each request completes, the key will
    // be in |request.result| as can be seen in
    // https://w3c.github.io/IndexedDB/#key-generator-construct.
    for (const value of values) {
      const request = store.add(value);
      request.onsuccess = (event) => {
        const key = request.result;
        keys.push(key);
      };
    }

    // Wait until the operation completes or else |keys| will not be fully
    // populated.
    await op.promise();
    return keys;
  }

  private remove_(
      storeName: string, keys: number[],
      onRemove: (p1: number) => any): Promise {
    const op = this.connection_.startReadWriteOperation(storeName);
    const store = op.store();
    for (const key of keys) {
      store.delete(key).onsuccess = () => onRemove(key);
    }
    return op.promise();
  }

  /**
   * @template T
   */
  private async get_(storeName: string, keys: number[]): Promise<T[]> {
    const op = this.connection_.startReadOnlyOperation(storeName);
    const store = op.store();
    const values = {};
    const missing: number[] = [];

    // Use a map to store the objects so that we can reorder the results to
    // match the order of |keys|.
    for (const key of keys) {
      const request = store.get(key);
      request.onsuccess = () => {
        // Make sure a defined value was found. Indexeddb treats no-value found
        // as a success with an undefined result.
        if (request.result == undefined) {
          missing.push(key);
        }
        values[key] = request.result;
      };
    }

    // Wait until the operation completes or else values may be missing from
    // |values|. Use the original key list to convert the map to a list so that
    // the order will match.
    await op.promise();
    if (missing.length) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
          ErrorExports.Code.KEY_NOT_FOUND,
          'Could not find values for ' + missing);
    }
    return keys.map((key) => values[key]);
  }
}
