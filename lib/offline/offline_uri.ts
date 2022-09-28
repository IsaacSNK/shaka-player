/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.offline {
  /**
   * The OfflineUri class contains all the components that make up the offline
   * uri. The components are:
   *    TYPE: Used to know what type of data the uri points to. It can either
   *          be "manifest" or "segment".
   *    MECHANISM: The name of the mechanism that manages the storage cell that
   *               holds the data.
   *    CELL: The name of the cell that holds the data.
   *    KEY: The key that the data is stored under in the cell.
   */
  export class OfflineUri {
    private type_: string;
    private mechanism_: string;
    private cell_: string;
    private key_: number;
    private asString_: string;

    constructor(type: string, mechanism: string, cell: string, key: number) {
      this.type_ = type;
      this.mechanism_ = mechanism;
      this.cell_ = cell;
      this.key_ = key;
      this.asString_ = [
        "offline:",
        type,
        "/",
        mechanism,
        "/",
        cell,
        "/",
        key,
      ].join("");
    }

    isManifest(): boolean {
      return this.type_ == "manifest";
    }

    isSegment(): boolean {
      return this.type_ == "segment";
    }

    mechanism(): string {
      return this.mechanism_;
    }

    cell(): string {
      return this.cell_;
    }

    key(): number {
      return this.key_;
    }

    /** @override */
    toString() {
      return this.asString_;
    }

    static parse(uri: string): OfflineUri | null {
      const parts = /^offline:([a-z]+)\/([^/]+)\/([^/]+)\/([0-9]+)$/.exec(uri);
      if (parts == null) {
        return null;
      }
      const type = parts[1];
      if (type != "manifest" && type != "segment") {
        return null;
      }
      const mechanism = parts[2];
      if (!mechanism) {
        return null;
      }
      const cell = parts[3];
      if (!cell) {
        return null;
      }
      const key = Number(parts[4]);
      if (type == null) {
        return null;
      }
      return new shaka.offline.OfflineUri(type, mechanism, cell, key);
    }

    static manifest(mechanism: string, cell: string, key: number): OfflineUri {
      return new shaka.offline.OfflineUri("manifest", mechanism, cell, key);
    }

    static segment(mechanism: string, cell: string, key: number): OfflineUri {
      return new shaka.offline.OfflineUri("segment", mechanism, cell, key);
    }
  }
}
