/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {PublicPromise} from './dev-workspace.shaka-player-fork.lib.util.public_promise';

/**
 * A DBOperation wraps an IndexedDB transaction in a promise.
 */
export class DBOperation {
  private transaction_: IDBTransaction;
  private store_: IDBObjectStore;
  private promise_: PublicPromise;

  constructor(transaction: IDBTransaction, storeName: string) {
    this.transaction_ = transaction;
    this.store_ = transaction.objectStore(storeName);
    this.promise_ = new PublicPromise();

    // Connect the transaction and the promise together.
    // |event.preventDefault()| is used on all non-successful callbacks to
    // prevent Firefox from surfacing the error on the main thread.
    transaction.onabort = (event) => {
      event.preventDefault();
      this.promise_.reject();
    };
    transaction.onerror = (event) => {
      event.preventDefault();
      this.promise_.reject();
    };
    transaction.oncomplete = (event) => {
      this.promise_.resolve();
    };
  }

  async abort(): Promise {
    try {
      this.transaction_.abort();
    } catch (e) {
    }

    // Ignore any exceptions that may be thrown as a result of aborting
    // the transaction.
    try {
      // Wait for the promise to be rejected, but ignore the rejection error.
      await this.promise_;
    } catch (e) {
    }
  }

  /**
   * Calls the given callback for each entry in the database.
   *
   * @param
   *   callback
   * @template T
   */
  forEachEntry(
      callback: (p1: IDBKeyType, p2: T, p3?: IDBCursorWithValue) => Promise |
          undefined): Promise {
    return new Promise((resolve, reject) => {
      const req = this.store_.openCursor();
      req.onerror = reject;
      req.onsuccess = async (event) => {
        // When we reach the end of the data that the cursor is iterating over,
        // |req.result| will be null to signal the end of the iteration.
        // https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor/continue
        if (req.result == null) {
          resolve();
          return;
        }
        const cursor: IDBCursorWithValue = req.result;
        await callback(cursor.key, cursor.value, cursor);
        cursor.continue();
      };
    });
  }

  /**
   * Get the store that the operation can interact with. Requests can be made
   * on the store. All requests made on the store will complete successfully
   * before the operation's promise will resolve. If any request fails, the
   * operation's promise will be rejected.
   *
   */
  store(): IDBObjectStore {
    return this.store_;
  }

  /**
   * Get the promise that wraps the transaction. This promise will resolve when
   * all requests on the object store complete successfully and the transaction
   * completes. If any request fails or the operation is aborted, the promise
   * will be rejected.
   *
   */
  promise(): Promise {
    return this.promise_;
  }
}
