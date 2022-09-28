/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface StorageCellPath {
  mechanism: string;
  cell: string;
}

export { StorageCellPath };

export interface StorageCellHandle {
  path: StorageCellPath;
  cell: shaka.extern.StorageCell;
}

export { StorageCellHandle };

namespace shaka.offline {
  // TODO: revisit this when Closure Compiler supports partially-exported classes.
  /**
   * StorageMuxer is responsible for managing StorageMechanisms and addressing
   * cells. The primary purpose of the muxer is to give the caller the correct
   * cell for the operations they want to perform.
   *
   * |findActive| will be used when the caller wants a cell that supports
   * add-operations. This will be used when saving new content to storage.
   *
   * |findAll| will be used when the caller want to look at all the content
   * in storage.
   *
   * |resolvePath| will be used to convert a path (from |findActive| and
   * |findAll|) into a cell, which it then returns.
   *
   * @export
   */
  export class StorageMuxer implements IDestroyable {
    /**
     * A key in this map is the name given when registering a StorageMechanism.
     *
     */
    private mechanisms_: Map<string, shaka.extern.StorageMechanism>;

    constructor() {
      this.mechanisms_ = new Map();
    }

    // TODO: revisit this when the compiler supports partially-exported classes.
    /**
     * Free all resources used by the muxer, mechanisms, and cells. This should
     * not affect the stored content.
     *
     * @override
     * @export
     */
    destroy() {
      const destroys: Promise[] = [];
      for (const mechanism of this.mechanisms_.values()) {
        destroys.push(mechanism.destroy());
      }

      // Empty the map so that subsequent calls will be no-ops.
      this.mechanisms_.clear();
      return Promise.all(destroys);
    }

    /**
     * Initialize the storage muxer. This must be called before any other calls.
     * This will initialize the muxer to use all mechanisms that have been
     * registered with |StorageMuxer.register|.
     *
     */
    init(): Promise {
      // Add the new instance of each mechanism to the muxer.
      const registry = shaka.offline.StorageMuxer.getRegistry_();
      registry.forEach((factory, name) => {
        const mech = factory();
        if (mech) {
          this.mechanisms_.set(name, mech);
        } else {
          shaka.log.info(
            "Skipping " + name + " as it is not supported on this platform"
          );
        }
      });
      const initPromises: Promise[] = [];
      for (const mechanism of this.mechanisms_.values()) {
        initPromises.push(mechanism.init());
      }
      return Promise.all(initPromises);
    }

    /**
     * Get a promise that will resolve with a storage cell that supports
     * add-operations. If no cell can be found, the promise will be rejected.
     *
     */
    getActive(): StorageCellHandle {
      let handle: StorageCellHandle | null = null;
      this.mechanisms_.forEach((mechanism, mechanismName) => {
        mechanism.getCells().forEach((cell, cellName) => {
          // If this cell is not useful to us or we already have a handle, then
          // we don't need to make a new handle.
          if (cell.hasFixedKeySpace() || handle) {
            return;
          }
          const path = { mechanism: mechanismName, cell: cellName };
          handle = { path: path, cell: cell };
        });
      });
      if (handle) {
        return handle as StorageCellHandle;
      }
      throw new shaka.util.Error(
        shaka.util.Error.Severity.CRITICAL,
        shaka.util.Error.Category.STORAGE,
        shaka.util.Error.Code.MISSING_STORAGE_CELL,
        "Could not find a cell that supports add-operations"
      );
    }

    /**
     * @param {function(!shaka.offline.StorageCellPath,
     *                  !shaka.extern.StorageCell)} callback
     */
    forEachCell(
      callback: (p1: StorageCellPath, p2: shaka.extern.StorageCell) => any
    ) {
      this.mechanisms_.forEach((mechanism, mechanismName) => {
        mechanism.getCells().forEach((cell, cellName) => {
          const path = { mechanism: mechanismName, cell: cellName };
          callback(path, cell);
        });
      });
    }

    /**
     * Get a specific storage cell. The promise will resolve with the storage
     * cell if it is found. If the storage cell is not found, the promise will
     * be rejected.
     *
     */
    getCell(mechanismName: string, cellName: string): shaka.extern.StorageCell {
      const mechanism = this.mechanisms_.get(mechanismName);
      if (!mechanism) {
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.STORAGE,
          shaka.util.Error.Code.MISSING_STORAGE_CELL,
          "Could not find mechanism with name " + mechanismName
        );
      }
      const cell = mechanism.getCells().get(cellName);
      if (!cell) {
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.STORAGE,
          shaka.util.Error.Code.MISSING_STORAGE_CELL,
          "Could not find cell with name " + cellName
        );
      }
      return cell;
    }

    forEachEmeSessionCell(
      callback: (p1: shaka.extern.EmeSessionStorageCell) => any
    ) {
      this.mechanisms_.forEach((mechanism, name) => {
        callback(mechanism.getEmeSessionCell());
      });
    }

    /**
     * Gets an arbitrary EME session cell that can be used for storing new session
     * info.
     *
     */
    getEmeSessionCell(): shaka.extern.EmeSessionStorageCell {
      const mechanisms = Array.from(this.mechanisms_.keys());
      if (!mechanisms.length) {
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.STORAGE,
          shaka.util.Error.Code.STORAGE_NOT_SUPPORTED,
          "No supported storage mechanisms found"
        );
      }
      return this.mechanisms_.get(mechanisms[0]).getEmeSessionCell();
    }

    /**
     * Find the cell that the path points to. A path is made up of a mount point
     * and a cell id. If a cell can be found, the cell will be returned. If no
     * cell is found, null will be returned.
     *
     */
    resolvePath(path: StorageCellPath): shaka.extern.StorageCell {
      const mechanism = this.mechanisms_.get(path.mechanism);
      if (!mechanism) {
        return null;
      }
      return mechanism.getCells().get(path.cell);
    }

    /**
     * This will erase all previous content from storage. Using paths obtained
     * before calling |erase| is discouraged, as cells may have changed during a
     * erase.
     *
     */
    async erase(): Promise {
      // If we have initialized, we will use the existing mechanism instances.
      const mechanisms: shaka.extern.StorageMechanism[] = Array.from(
        this.mechanisms_.values()
      );
      const alreadyInitialized = mechanisms.length > 0;

      // If we have not initialized, we should still be able to erase.  This is
      // critical to our ability to wipe the DB in case of a version mismatch.
      // If there are no instances, create temporary ones and destroy them later.
      if (!alreadyInitialized) {
        const registry = shaka.offline.StorageMuxer.getRegistry_();
        registry.forEach((factory, name) => {
          const mech = factory();
          if (mech) {
            mechanisms.push(mech);
          }
        });
      }

      // Erase all storage mechanisms.
      await Promise.all(mechanisms.map((m) => m.erase()));

      // If we were erasing temporary instances, destroy them, too.
      if (!alreadyInitialized) {
        await Promise.all(mechanisms.map((m) => m.destroy()));
      }
    }

    /**
     * Register a storage mechanism for use with the default storage muxer. This
     * will have no effect on any storage muxer already in main memory.
     *
     * @export
     */
    static register(
      name: string,
      factory: () => shaka.extern.StorageMechanism
    ) {
      shaka.offline.StorageMuxer.registry_.set(name, factory);
    }

    /**
     * Unregister a storage mechanism for use with the default storage muxer. This
     * will have no effect on any storage muxer already in main memory.
     *
     * @param name The name that the storage mechanism was registered
     *                      under.
     * @export
     */
    static unregister(name: string) {
      shaka.offline.StorageMuxer.registry_.delete(name);
    }

    /**
     * Check if there is support for storage on this platform. It is assumed that
     * if there are any mechanisms registered, it means that storage is supported
     * on this platform. We do not check if the mechanisms have any cells.
     *
     */
    static support(): boolean {
      const registry = shaka.offline.StorageMuxer.getRegistry_();

      // Make sure that we will have SOME mechanisms created by creating a
      // mechanism and immediately destroying it.
      for (const create of registry.values()) {
        const instance = create();
        if (instance) {
          instance.destroy();
          return true;
        }
      }
      return false;
    }

    /**
     * Replace the mechanism map used by the muxer. This should only be used
     * in testing.
     *
     */
    static overrideSupport(
      map: Map<string, () => shaka.extern.StorageMechanism>
    ) {
      shaka.offline.StorageMuxer.override_ = map;
    }

    /**
     * Undo a previous call to |overrideSupport|.
     */
    static clearOverride() {
      shaka.offline.StorageMuxer.override_ = null;
    }

    /**
     * Get the registry. If the support has been disabled, this will always
     * an empty registry. Reading should always be done via |getRegistry_|.
     *
     */
    private static getRegistry_(): Map<
      string,
      () => shaka.extern.StorageMechanism
    > {
      const override = shaka.offline.StorageMuxer.override_;
      const registry = shaka.offline.StorageMuxer.registry_;
      if (COMPILED) {
        return registry;
      } else {
        return override || registry;
      }
    }
  }
}

namespace shaka.offline.StorageMuxer {
  export const override_: Map<string, () => shaka.extern.StorageMechanism> =
    null;
}

namespace shaka.offline.StorageMuxer {
  export const registry_: Map<string, () => shaka.extern.StorageMechanism> =
    new Map();
}
