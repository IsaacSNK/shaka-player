/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary A set of BufferSource utility functions.
   * @export
   */
  export class BufferUtils {
    /**
     * Compare two buffers for equality.  For buffers of different types, this
     * compares the underlying buffers as binary data.
     *
     * @export
     * @suppress {strictMissingProperties}
     */
    static equal(
      arr1: BufferSource | null,
      arr2: BufferSource | null
    ): boolean {
      const BufferUtils = shaka.util.BufferUtils;
      if (!arr1 && !arr2) {
        return true;
      }
      if (!arr1 || !arr2) {
        return false;
      }
      if (arr1.byteLength != arr2.byteLength) {
        return false;
      }

      // Quickly check if these are views of the same buffer.  An ArrayBuffer can
      // be passed but doesn't have a byteOffset field, so default to 0.
      if (
        BufferUtils.unsafeGetArrayBuffer_(arr1) ==
          BufferUtils.unsafeGetArrayBuffer_(arr2) &&
          //@ts-ignore
        (arr1.byteOffset || 0) == (arr2.byteOffset || 0)
      ) {
        return true;
      }
      const uint8A = shaka.util.BufferUtils.toUint8(arr1);
      const uint8B = shaka.util.BufferUtils.toUint8(arr2);
      for (let i = 0; i < arr1.byteLength; i++) {
        if (uint8A[i] != uint8B[i]) {
          return false;
        }
      }
      return true;
    }

    /**
     * Gets the underlying ArrayBuffer of the given view.  The caller needs to
     * ensure it uses the "byteOffset" and "byteLength" fields of the view to
     * only use the same "view" of the data.
     *
     */
    private static unsafeGetArrayBuffer_(view: BufferSource): ArrayBuffer {
      if (view instanceof ArrayBuffer) {
        return view;
      } else {
        return view.buffer;
      }
    }

    /**
     * Gets an ArrayBuffer that contains the data from the given TypedArray.  Note
     * this will allocate a new ArrayBuffer if the object is a partial view of
     * the data.
     *
     * @export
     */
    static toArrayBuffer(view: BufferSource): ArrayBuffer {
      if (view instanceof ArrayBuffer) {
        return view;
      } else {
        if (view.byteOffset == 0 && view.byteLength == view.buffer.byteLength) {
          // This is a TypedArray over the whole buffer.
          return view.buffer;
        }

        // This is a "view" on the buffer.  Create a new buffer that only contains
        // the data.  Note that since this isn't an ArrayBuffer, the "new" call
        // will allocate a new buffer to hold the copy.
        //@ts-ignore
        return new Uint8Array(view).buffer;
      }
    }

    /**
     * Creates a new Uint8Array view on the same buffer.  This clamps the values
     * to be within the same view (i.e. you can't use this to move past the end
     * of the view, even if the underlying buffer is larger).  However, you can
     * pass a negative offset to access the data before the view.
     *
     * @param offset The offset from the beginning of this data's view
     *   to start the new view at.
     * @param length The byte length of the new view.
     * @export
     */
    static toUint8(
      data: BufferSource,
      offset: number = 0,
      length: number = Infinity
    ): Uint8Array {
      //@ts-ignore
      return shaka.util.BufferUtils.view_(data, offset, length, Uint8Array);
    }

    /**
     * Creates a DataView over the given buffer.
     *
     * @see toUint8
     * @export
     */
    static toDataView(
      buffer: BufferSource,
      offset: number = 0,
      length: number = Infinity
    ): DataView {
      //@ts-ignore
      return shaka.util.BufferUtils.view_(buffer, offset, length, DataView);
    }

    /**
     * @template T
     */
    private static view_(
      data: BufferSource,
      offset: number,
      length: number,
      Type: (p1: ArrayBuffer, p2: number, p3: number) => any
    ): any {
      const buffer = shaka.util.BufferUtils.unsafeGetArrayBuffer_(data);

      // Absolute end of the |data| view within |buffer|.
      /** @suppress {strictMissingProperties} */
      //@ts-ignore
      const dataEnd = (data.byteOffset || 0) + data.byteLength;

      // Absolute start of the result within |buffer|.
      /** @suppress {strictMissingProperties} */
      //@ts-ignore
      const rawStart = (data.byteOffset || 0) + offset;
      const start = Math.max(0, Math.min(rawStart, dataEnd));

      // Absolute end of the result within |buffer|.
      const end = Math.min(start + Math.max(length, 0), dataEnd);
      //@ts-ignore
      return new Type(buffer, start, end - start);
    }
  }
}
