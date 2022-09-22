/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {DBConnection} from './/db_connection';
import {DBOperation} from './/db_operation';

/**
 * The implementation of the EME session storage cell.
 *
 */
export class EmeSessionStorageCell implements shaka.
extern.EmeSessionStorageCell {
  private connection_: DBConnection;
  private store_: string;

  constructor(connection: IDBDatabase, store: string) {
    this.connection_ = new DBConnection(connection);
    this.store_ = store;
  }

  /** @override */
  destroy() {
    return this.connection_.destroy();
  }

  /** @override */
  async getAll() {
    const op: DBOperation =
        this.connection_.startReadOnlyOperation(this.store_);
    const values: shaka.extern.EmeSessionDB[] = [];
    await op.forEachEntry((key, value) => {
      values.push(value);
    });
    await op.promise();
    return values;
  }

  /** @override */
  add(sessions) {
    const op = this.connection_.startReadWriteOperation(this.store_);
    const store = op.store();
    for (const session of sessions) {
      store.add(session);
    }
    return op.promise();
  }

  /** @override */
  async remove(sessionIds) {
    const op: DBOperation =
        this.connection_.startReadWriteOperation(this.store_);
    await op.forEachEntry((key, value, cursor) => {
      if (sessionIds.includes(value.sessionId)) {
        cursor.delete();
      }
    });
    await op.promise();
  }
}
