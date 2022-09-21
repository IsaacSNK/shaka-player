/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {DBOperation} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.db_operation';
import {ArrayUtils} from './dev-workspace.shaka-player-fork.lib.util.array_utils';

/**
 * DBConnection is used to manage an IndexedDB connection. It can create new
 * operations. If the connection is killed (via |destroy|) all pending
 * operations will be cancelled.
 */
export class DBConnection {
  private connection_: IDBDatabase;
  private pending_: DBOperation[] = [];

  /**
   * @param connection A connection to an IndexedDB instance.
   */
  constructor(connection: IDBDatabase) {
    this.connection_ = connection;
  }

  destroy(): Promise {
    return Promise.all(this.pending_.map((op) => {
      return op.abort();
    }));
  }

  /**
   * @param store The name of the store that the operation should
   *                       occur on.
   */
  startReadOnlyOperation(store: string): DBOperation {
    return this.startOperation_(store, 'readonly');
  }

  /**
   * @param store The name of the store that the operation should
   *                       occur on.
   */
  startReadWriteOperation(store: string): DBOperation {
    return this.startOperation_(store, 'readwrite');
  }

  /**
   * @param store The name of the store that the operation should
   *                       occur on.
   * @param type The type of operation being performed on the store.
   *                      This determines what commands may be performed. This
   *                      can either be "readonly" or "readwrite".
   */
  private startOperation_(store: string, type: string): DBOperation {
    const transaction = this.connection_.transaction([store], type);
    const operation = new DBOperation(transaction, store);
    this.pending_.push(operation);

    // Once the operation is done (regardless of outcome) stop tracking it.
    operation.promise().then(
        () => this.stopTracking_(operation),
        () => this.stopTracking_(operation));
    return operation;
  }

  private stopTracking_(operation: DBOperation) {
    ArrayUtils.remove(this.pending_, operation);
  }
}
