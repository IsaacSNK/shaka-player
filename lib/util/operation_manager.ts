/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * A utility for cleaning up AbortableOperations, to help simplify common
   * patterns and reduce code duplication.
   *
   */
  export class OperationManager implements IDestroyable {
    // @ts-ignore
    private operations_: shaka.extern.IAbortableOperation[] = [];

    /**
     * Manage an operation.  This means aborting it on destroy() and removing it
     * from the management set when it complete.
     *
     */
    // @ts-ignore
    manage(operation: shaka.extern.IAbortableOperation) {
      this.operations_.push(
        operation.finally(() => {
          shaka.util.ArrayUtils.remove(this.operations_, operation);
        })
      );
    }

    /** @override */
    destroy() {
      const cleanup = [];
      for (const op of this.operations_) {
        // Catch and ignore any failures.  This silences error logs in the
        // JavaScript console about uncaught Promise failures.
        op.promise.catch(() => {});

        // Now abort the operation.
        cleanup.push(op.abort());
      }
      this.operations_ = [];
      return Promise.all(cleanup);
    }
  }
}
