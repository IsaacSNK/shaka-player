/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './../debug/asserts';
import {asserts} from './../debug/asserts';
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import {BufferUtils} from './/buffer_utils';
import * as ErrorExports from './/error';
import {Error} from './/error';
import {Lazy} from './/lazy';
import * as PlatformExports from './/platform';
import {Platform} from './/platform';

/**
 * @namespace shaka.util.StringUtils
 * @summary A set of string utility functions.
 * @export
 */
export class StringUtils {
  /**
   * Creates a string from the given buffer as UTF-8 encoding.
   *
   * @export
   */
  static fromUTF8(data: BufferSource|null): string {
    if (!data) {
      return '';
    }
    let uint8 = BufferUtils.toUint8(data);

    // If present, strip off the UTF-8 BOM.
    if (uint8[0] == 239 && uint8[1] == 187 && uint8[2] == 191) {
      uint8 = uint8.subarray(3);
    }
    if (window.TextDecoder && !Platform.isPS4()) {
      // Use the TextDecoder interface to decode the text.  This has the
      // advantage compared to the previously-standard decodeUriComponent that
      // it will continue parsing even if it finds an invalid UTF8 character,
      // rather than stop and throw an error.
      const utf8decoder = new TextDecoder();
      const decoded = utf8decoder.decode(uint8);
      if (decoded.includes('\ufffd')) {
        log.alwaysError(
            'Decoded string contains an "unknown character' +
            '" codepoint.  That probably means the UTF8 ' +
            'encoding was incorrect!');
      }
      return decoded;
    } else {
      // Homebrewed UTF-8 decoder based on
      // https://en.wikipedia.org/wiki/UTF-8#Encoding
      // Unlike decodeURIComponent, won't throw on bad encoding.
      // In this way, it is similar to TextDecoder.
      let decoded = '';
      for (let i = 0; i < uint8.length; ++i) {
        // By default, the "replacement character" codepoint.
        let codePoint = 65533;

        // Top bit is 0, 1-byte encoding.
        // Top 3 bits of byte 0 are 110, top 2 bits of byte 1 are 10,
        // 2-byte encoding.
        if ((uint8[i] & 128) == 0) {
          codePoint = uint8[i];
        } else {
          // Top 4 bits of byte 0 are 1110, top 2 bits of byte 1 and 2 are 10,
          // 3-byte encoding.
          if (uint8.length >= i + 2 && (uint8[i] & 224) == 192 &&
              (uint8[i + 1] & 192) == 128) {
            codePoint = (uint8[i] & 31) << 6 | uint8[i + 1] & 63;
            i += 1;
          } else {
            // Top 5 bits of byte 0 are 11110, top 2 bits of byte 1, 2 and 3 are
            // 10, 4-byte encoding.
            if (uint8.length >= i + 3 && (uint8[i] & 240) == 224 &&
                (uint8[i + 1] & 192) == 128 && (uint8[i + 2] & 192) == 128) {
              codePoint = (uint8[i] & 15) << 12 | (uint8[i + 1] & 63) << 6 |
                  uint8[i + 2] & 63;
              i += 2;
            } else {
              if (uint8.length >= i + 4 && (uint8[i] & 241) == 240 &&
                  (uint8[i + 1] & 192) == 128 && (uint8[i + 2] & 192) == 128 &&
                  (uint8[i + 3] & 192) == 128) {
                codePoint = (uint8[i] & 7) << 18 | (uint8[i + 1] & 63) << 12 |
                    (uint8[i + 2] & 63) << 6 | uint8[i + 3] & 63;
                i += 3;
              }
            }
          }
        }

        // Consume three extra bytes.

        // JavaScript strings are a series of UTF-16 characters.
        if (codePoint <= 65535) {
          decoded += String.fromCharCode(codePoint);
        } else {
          // UTF-16 surrogate-pair encoding, based on
          // https://en.wikipedia.org/wiki/UTF-16#Description
          const baseCodePoint = codePoint - 65536;
          const highPart = baseCodePoint >> 10;
          const lowPart = baseCodePoint & 1023;
          decoded += String.fromCharCode(55296 + highPart);
          decoded += String.fromCharCode(56320 + lowPart);
        }
      }
      return decoded;
    }
  }

  /**
     * Creates a string from the given buffer as UTF-16 encoding.
     *
           true to read little endian, false to read big.
     * @param noThrow true to avoid throwing in cases where we may
     *     expect invalid input.  If noThrow is true and the data has an odd
     *     length,it will be truncated.
     * @export
     */
  static fromUTF16(
      data: BufferSource|null, littleEndian: boolean,
      noThrow?: boolean): string {
    if (!data) {
      return '';
    }
    if (!noThrow && data.byteLength % 2 != 0) {
      log.error('Data has an incorrect length, must be even.');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.BAD_ENCODING);
    }

    // Use a DataView to ensure correct endianness.
    const length = Math.floor(data.byteLength / 2);
    const arr = new Uint16Array(length);
    const dataView = BufferUtils.toDataView(data);
    for (let i = 0; i < length; i++) {
      arr[i] = dataView.getUint16(i * 2, littleEndian);
    }
    return StringUtils.fromCharCode(arr);
  }

  /**
   * Creates a string from the given buffer, auto-detecting the encoding that is
   * being used.  If it cannot detect the encoding, it will throw an exception.
   *
   * @export
   */
  static fromBytesAutoDetect(data: BufferSource|null): string {
    const StringUtils = StringUtils;
    if (!data) {
      return '';
    }
    const uint8 = BufferUtils.toUint8(data);
    if (uint8[0] == 239 && uint8[1] == 187 && uint8[2] == 191) {
      return StringUtils.fromUTF8(uint8);
    } else {
      if (uint8[0] == 254 && uint8[1] == 255) {
        return StringUtils.fromUTF16(
            uint8.subarray(2),
            /* littleEndian= */
            false);
      } else {
        if (uint8[0] == 255 && uint8[1] == 254) {
          return StringUtils.fromUTF16(
              uint8.subarray(2),
              /* littleEndian= */
              true);
        }
      }
    }
    const isAscii = (i) => {
      // arr[i] >= ' ' && arr[i] <= '~';
      return uint8.byteLength <= i || uint8[i] >= 32 && uint8[i] <= 126;
    };
    log.debug('Unable to find byte-order-mark, making an educated guess.');
    if (uint8[0] == 0 && uint8[2] == 0) {
      return StringUtils.fromUTF16(
          data,
          /* littleEndian= */
          false);
    } else {
      if (uint8[1] == 0 && uint8[3] == 0) {
        return StringUtils.fromUTF16(
            data,
            /* littleEndian= */
            true);
      } else {
        if (isAscii(0) && isAscii(1) && isAscii(2) && isAscii(3)) {
          return StringUtils.fromUTF8(data);
        }
      }
    }
    throw new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
        ErrorExports.Code.UNABLE_TO_DETECT_ENCODING);
  }

  /**
   * Creates a ArrayBuffer from the given string, converting to UTF-8 encoding.
   *
   * @export
   */
  static toUTF8(str: string): ArrayBuffer {
    if (window.TextEncoder && !Platform.isPS4()) {
      const utf8Encoder = new TextEncoder();
      return BufferUtils.toArrayBuffer(utf8Encoder.encode(str));
    } else {
      // http://stackoverflow.com/a/13691499
      // Converts the given string to a URI encoded string.  If a character
      // falls in the ASCII range, it is not converted; otherwise it will be
      // converted to a series of URI escape sequences according to UTF-8.
      // Example: 'g#€' -> 'g#%E3%82%AC'
      const encoded = encodeURIComponent(str);

      // Convert each escape sequence individually into a character.  Each
      // escape sequence is interpreted as a code-point, so if an escape
      // sequence happens to be part of a multi-byte sequence, each byte will
      // be converted to a single character.
      // Example: 'g#%E3%82%AC' -> '\x67\x35\xe3\x82\xac'
      const utf8 = unescape(encoded);
      const result = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        const item = utf8[i];
        result[i] = item.charCodeAt(0);
      }
      return BufferUtils.toArrayBuffer(result);
    }
  }

  /**
   * Creates a ArrayBuffer from the given string, converting to UTF-16 encoding.
   *
   * @export
   */
  static toUTF16(str: string, littleEndian: boolean): ArrayBuffer {
    const result = new ArrayBuffer(str.length * 2);
    const view = new DataView(result);
    for (let i = 0; i < str.length; ++i) {
      const value = str.charCodeAt(i);
      view.setUint16(
          /* position= */
          i * 2, value, littleEndian);
    }
    return result;
  }

  /**
   * Creates a new string from the given array of char codes.
   *
   * Using String.fromCharCode.apply is risky because you can trigger stack
   * errors on very large arrays.  This breaks up the array into several pieces
   * to avoid this.
   *
   */
  static fromCharCode(array: TypedArray): string {
    return fromCharCodeImpl_.value()(array);
  }

  /**
   * Resets the fromCharCode method's implementation.
   * For debug use.
   * @export
   */
  static resetFromCharCode() {
    fromCharCodeImpl_.reset();
  }
}

export const fromCharCodeImpl_: Lazy<(p1: TypedArray) => string> =
    new Lazy(() => {
      /** @param size */
      const supportsChunkSize = (size: number) => {
        // Actually use "foo", so it's not compiled out.
        try {
          // The compiler will complain about suspicious value if this isn't
          // stored in a variable and used.
          const buffer = new Uint8Array(size);

          // This can't use the spread operator, or it blows up on Xbox One.
          // So we use apply() instead, which is normally not allowed.
          // See issue #2186 for more details.
          // eslint-disable-next-line no-restricted-syntax
          const foo = String.fromCharCode.apply(null, buffer);
          asserts.assert(foo, 'Should get value');
          return foo.length > 0;
        } catch (error) {
          return false;
        }
      };

      // Different browsers support different chunk sizes; find out the largest
      // this browser supports so we can use larger chunks on supported browsers
      // but still support lower-end devices that require small chunks.
      // 64k is supported on all major desktop browsers.
      for (let size = 64 * 1024; size > 0; size /= 2) {
        if (supportsChunkSize(size)) {
          return (buffer) => {
            let ret = '';
            for (let i = 0; i < buffer.length; i += size) {
              const subArray = buffer.subarray(i, i + size);

              // This can't use the spread operator, or it blows up on Xbox One.
              // So we use apply() instead, which is normally not allowed.
              // See issue #2186 for more details.
              // eslint-disable-next-line no-restricted-syntax
              ret += String.fromCharCode.apply(
                  null,
                  // Issue #2186
                  subArray);
            }
            return ret;
          };
        }
      }
      asserts.assert(false, 'Unable to create a fromCharCode method');
      return null;
    });
