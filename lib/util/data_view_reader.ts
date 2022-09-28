/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary DataViewReader abstracts a DataView object.
   * @export
   */
  export class DataViewReader {
    private dataView_: DataView;
    private littleEndian_: boolean;
    private position_: number = 0;

    /**
     * @param endianness The endianness.
     */
    constructor(data: BufferSource, endianness: shaka.util.DataViewReader.Endianness) {
      this.dataView_ = shaka.util.BufferUtils.toDataView(data);
      this.littleEndian_ =
        endianness == shaka.util.DataViewReader.Endianness.LITTLE_ENDIAN;
    }

    /** @return The underlying DataView instance. */
    getDataView(): DataView {
      return this.dataView_;
    }

    /**
     * @return True if the reader has more data, false otherwise.
     * @export
     */
    hasMoreData(): boolean {
      return this.position_ < this.dataView_.byteLength;
    }

    /**
     * Gets the current byte position.
     * @export
     */
    getPosition(): number {
      return this.position_;
    }

    /**
     * Gets the byte length of the DataView.
     * @export
     */
    getLength(): number {
      return this.dataView_.byteLength;
    }

    /**
     * Reads an unsigned 8 bit integer, and advances the reader.
     * @return The integer.
     * @export
     */
    readUint8(): number {
      try {
        const value = this.dataView_.getUint8(this.position_);
        this.position_ += 1;
        return value;
      } catch (exception) {
        throw this.outOfBounds_();
      }
    }

    /**
     * Reads an unsigned 16 bit integer, and advances the reader.
     * @return The integer.
     * @export
     */
    readUint16(): number {
      try {
        const value = this.dataView_.getUint16(
          this.position_,
          this.littleEndian_
        );
        this.position_ += 2;
        return value;
      } catch (exception) {
        throw this.outOfBounds_();
      }
    }

    /**
     * Reads an unsigned 32 bit integer, and advances the reader.
     * @return The integer.
     * @export
     */
    readUint32(): number {
      try {
        const value = this.dataView_.getUint32(
          this.position_,
          this.littleEndian_
        );
        this.position_ += 4;
        return value;
      } catch (exception) {
        throw this.outOfBounds_();
      }
    }

    /**
     * Reads a signed 32 bit integer, and advances the reader.
     * @return The integer.
     * @export
     */
    readInt32(): number {
      try {
        const value = this.dataView_.getInt32(
          this.position_,
          this.littleEndian_
        );
        this.position_ += 4;
        return value;
      } catch (exception) {
        throw this.outOfBounds_();
      }
    }

    /**
     * Reads an unsigned 64 bit integer, and advances the reader.
     * @return The integer.
     * @export
     */
    readUint64(): number {
      let low: number;
      let high: number;
      try {
        if (this.littleEndian_) {
          low = this.dataView_.getUint32(this.position_, true);
          high = this.dataView_.getUint32(this.position_ + 4, true);
        } else {
          high = this.dataView_.getUint32(this.position_, false);
          low = this.dataView_.getUint32(this.position_ + 4, false);
        }
      } catch (exception) {
        throw this.outOfBounds_();
      }
      if (high > 2097151) {
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.JS_INTEGER_OVERFLOW
        );
      }
      this.position_ += 8;

      // NOTE: This is subtle, but in JavaScript you can't shift left by 32
      // and get the full range of 53-bit values possible.
      // You must multiply by 2^32.
      return high * Math.pow(2, 32) + low;
    }

    /**
     * Reads the specified number of raw bytes.
     * @param bytes The number of bytes to read.
     * @export
     */
    readBytes(bytes: number): Uint8Array {
      goog.asserts.assert(bytes >= 0, "Bad call to DataViewReader.readBytes");
      if (this.position_ + bytes > this.dataView_.byteLength) {
        throw this.outOfBounds_();
      }
      const value = shaka.util.BufferUtils.toUint8(
        this.dataView_,
        this.position_,
        bytes
      );
      this.position_ += bytes;
      return value;
    }

    /**
     * Skips the specified number of bytes.
     * @param bytes The number of bytes to skip.
     * @export
     */
    skip(bytes: number) {
      goog.asserts.assert(bytes >= 0, "Bad call to DataViewReader.skip");
      if (this.position_ + bytes > this.dataView_.byteLength) {
        throw this.outOfBounds_();
      }
      this.position_ += bytes;
    }

    /**
     * Rewinds the specified number of bytes.
     * @param bytes The number of bytes to rewind.
     * @export
     */
    rewind(bytes: number) {
      goog.asserts.assert(bytes >= 0, "Bad call to DataViewReader.rewind");
      if (this.position_ < bytes) {
        throw this.outOfBounds_();
      }
      this.position_ -= bytes;
    }

    /**
     * Seeks to a specified position.
     * @param position The desired byte position within the DataView.
     * @export
     */
    seek(position: number) {
      goog.asserts.assert(position >= 0, "Bad call to DataViewReader.seek");
      if (position < 0 || position > this.dataView_.byteLength) {
        throw this.outOfBounds_();
      }
      this.position_ = position;
    }

    /**
     * Keeps reading until it reaches a byte that equals to zero.  The text is
     * assumed to be UTF-8.
     * @export
     */
    readTerminatedString(): string {
      const start = this.position_;
      while (this.hasMoreData()) {
        const value = this.dataView_.getUint8(this.position_);
        if (value == 0) {
          break;
        }
        this.position_ += 1;
      }
      const ret = shaka.util.BufferUtils.toUint8(
        this.dataView_,
        start,
        this.position_ - start
      );

      // Skip string termination.
      this.position_ += 1;
      return shaka.util.StringUtils.fromUTF8(ret);
    }

    private outOfBounds_(): Error {
      return new shaka.util.Error(
        shaka.util.Error.Severity.CRITICAL,
        shaka.util.Error.Category.MEDIA,
        shaka.util.Error.Code.BUFFER_READ_OUT_OF_BOUNDS
      );
    }
  }
}

namespace shaka.util.DataViewReader {
  /**
   * Endianness.
   * @export
   */
  export enum Endianness {
    BIG_ENDIAN,
    LITTLE_ENDIAN,
  }
}
