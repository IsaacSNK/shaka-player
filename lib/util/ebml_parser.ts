/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import {BufferUtils} from './util___buffer_utils';
import * as DataViewReaderExports from './util___data_view_reader';
import {DataViewReader} from './util___data_view_reader';
import * as ErrorExports from './util___error';
import {Error} from './util___error';

/**
 * @summary
 * Extensible Binary Markup Language (EBML) parser.
 */
export class EbmlParser {
  private dataView_: DataView;
  private reader_: DataViewReader;

  constructor(data: BufferSource) {
    this.dataView_ = BufferUtils.toDataView(data);
    this.reader_ = new DataViewReader(
        this.dataView_, DataViewReaderExports.Endianness.BIG_ENDIAN);
  }

  /**
   * @return True if the parser has more data, false otherwise.
   */
  hasMoreData(): boolean {
    return this.reader_.hasMoreData();
  }

  /**
   * Parses an EBML element from the parser's current position, and advances
   * the parser.
   * @return The EBML element.
   * @see http://matroska.org/technical/specs/rfc/index.html
   */
  parseElement(): EbmlElement {
    const id = this.parseId_();

    // Parse the element's size.
    const vint = this.parseVint_();
    let size;
    if (EbmlParser.isDynamicSizeValue_(vint)) {
      // If this has an unknown size, assume that it takes up the rest of the
      // data.
      size = this.dataView_.byteLength - this.reader_.getPosition();
    } else {
      size = EbmlParser.getVintValue_(vint);
    }

    // Note that if the element's size is larger than the buffer then we are
    // parsing a "partial element". This may occur if for example we are
    // parsing the beginning of some WebM container data, but our buffer does
    // not contain the entire WebM container data.
    const elementSize =
        this.reader_.getPosition() + size <= this.dataView_.byteLength ?
        size :
        this.dataView_.byteLength - this.reader_.getPosition();
    const dataView = BufferUtils.toDataView(
        this.dataView_, this.reader_.getPosition(), elementSize);
    this.reader_.skip(elementSize);
    return new EbmlElement(id, dataView);
  }

  /**
   * Parses an EBML ID from the parser's current position, and advances the
   * parser.
   * @return The EBML ID.
   */
  private parseId_(): number {
    const vint = this.parseVint_();
    if (vint.length > 7) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.EBML_OVERFLOW);
    }
    let id = 0;
    for (const
             /* byte */
             b of vint) {
      // Note that we cannot use << since |value| may exceed 32 bits.
      id = 256 * id + b;
    }
    return id;
  }

  /**
   * Parses a variable sized integer from the parser's current position, and
   * advances the parser.
   * For example:
   *   1 byte  wide: 1xxx xxxx
   *   2 bytes wide: 01xx xxxx xxxx xxxx
   *   3 bytes wide: 001x xxxx xxxx xxxx xxxx xxxx
   * @return The variable sized integer.
   */
  private parseVint_(): Uint8Array {
    const position = this.reader_.getPosition();
    const firstByte = this.reader_.readUint8();
    if (firstByte == 0) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.EBML_OVERFLOW);
    }

    // Determine the index of the highest bit set.
    const index = Math.floor(Math.log2(firstByte));
    const numBytes = 8 - index;
    asserts.assert(numBytes <= 8 && numBytes >= 1, 'Incorrect log2 value');
    this.reader_.skip(numBytes - 1);
    return BufferUtils.toUint8(this.dataView_, position, numBytes);
  }

  /**
   * Gets the value of a variable sized integer.
   * For example, the x's below are part of the vint's value.
   *    7-bit value: 1xxx xxxx
   *   14-bit value: 01xx xxxx xxxx xxxx
   *   21-bit value: 001x xxxx xxxx xxxx xxxx xxxx
   * @param vint The variable sized integer.
   * @return The value of the variable sized integer.
   */
  private static getVintValue_(vint: Uint8Array): number {
    // If |vint| is 8 bytes wide then we must ensure that it does not have more
    // than 53 meaningful bits. For example, assume |vint| is 8 bytes wide,
    // so it has the following structure,
    // 0000 0001 | xxxx xxxx ...
    // Thus, the first 3 bits following the first byte of |vint| must be 0.
    if (vint.length == 8 && vint[1] & 224) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.JS_INTEGER_OVERFLOW);
    }
    let value = 0;
    for (let i = 0; i < vint.length; i++) {
      const item = vint[i];
      if (i == 0) {
        // Mask out the first few bits of |vint|'s first byte to get the most
        // significant bits of |vint|'s value. If |vint| is 8 bytes wide then
        // |value| will be set to 0.
        const mask = 1 << 8 - vint.length;
        value = item & mask - 1;
      } else {
        // Note that we cannot use << since |value| may exceed 32 bits.
        value = 256 * value + item;
      }
    }
    return value;
  }

  /**
   * Checks if the given variable sized integer represents a dynamic size value.
   * @param vint The variable sized integer.
   * @return true if |vint| represents a dynamic size value,
   *   false otherwise.
   */
  private static isDynamicSizeValue_(vint: Uint8Array): boolean {
    const EbmlParser = EbmlParser;
    const BufferUtils = BufferUtils;
    for (const dynamicSizeConst of EbmlParser.DYNAMIC_SIZES) {
      if (BufferUtils.equal(vint, new Uint8Array(dynamicSizeConst))) {
        return true;
      }
    }
    return false;
  }
}

/**
 * A list of EBML dynamic size constants.
 */
export const DYNAMIC_SIZES: number[][] = [
  [255], [127, 255], [63, 255, 255], [31, 255, 255, 255],
  [15, 255, 255, 255, 255], [7, 255, 255, 255, 255, 255],
  [3, 255, 255, 255, 255, 255, 255], [1, 255, 255, 255, 255, 255, 255, 255]
];

export class EbmlElement {
  private dataView_: DataView;

  /**
   * @param id The ID.
   * @param dataView The DataView.
   */
  constructor(public id: number, dataView: DataView) {
    this.dataView_ = dataView;
  }

  /**
   * Gets the element's offset from the beginning of the buffer.
   */
  getOffset(): number {
    return this.dataView_.byteOffset;
  }

  /**
   * Interpret the element's data as a list of sub-elements.
   * @return A parser over the sub-elements.
   */
  createParser(): EbmlParser {
    return new EbmlParser(this.dataView_);
  }

  /**
   * Interpret the element's data as an unsigned integer.
   */
  getUint(): number {
    if (this.dataView_.byteLength > 8) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.EBML_OVERFLOW);
    }

    // Ensure we have at most 53 meaningful bits.
    if (this.dataView_.byteLength == 8 && this.dataView_.getUint8(0) & 224) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.JS_INTEGER_OVERFLOW);
    }
    let value = 0;
    for (let i = 0; i < this.dataView_.byteLength; i++) {
      const chunk = this.dataView_.getUint8(i);
      value = 256 * value + chunk;
    }
    return value;
  }

  /**
   * Interpret the element's data as a floating point number
   * (32 bits or 64 bits). 80-bit floating point numbers are not supported.
   */
  getFloat(): number {
    if (this.dataView_.byteLength == 4) {
      return this.dataView_.getFloat32(0);
    } else {
      if (this.dataView_.byteLength == 8) {
        return this.dataView_.getFloat64(0);
      } else {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
            ErrorExports.Code.EBML_BAD_FLOATING_POINT_SIZE);
      }
    }
  }
}
