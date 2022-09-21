/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {BufferUtils} from './util___buffer_utils';
import * as StringUtilsExports from './util___string_utils';
import {StringUtils} from './util___string_utils';


// TODO: revisit this when Closure Compiler supports partially-exported classes.
/**
 * @summary A set of Uint8Array utility functions.
 * @export
 */
export class Uint8ArrayUtils {
  /**
   * Convert a buffer to a base64 string. The output will be standard
   * alphabet as opposed to base64url safe alphabet.
   * @export
   */
  static toStandardBase64(data: BufferSource): string {
    const bytes = StringUtils.fromCharCode(BufferUtils.toUint8(data));
    return btoa(bytes);
  }

  /**
   * Convert a buffer to a base64 string.  The output will always use the
   * alternate encoding/alphabet also known as "base64url".
   * @param padding If true, pad the output with equals signs.
   *   Defaults to true.
   * @export
   */
  static toBase64(data: BufferSource, padding?: boolean): string {
    padding = padding == undefined ? true : padding;
    const base64 = Uint8ArrayUtils.toStandardBase64(data)
                       .replace(/\+/g, '-')
                       .replace(/\//g, '_');
    return padding ? base64 : base64.replace(/[=]*$/, '');
  }

  /**
   * Convert a base64 string to a Uint8Array.  Accepts either the standard
   * alphabet or the alternate "base64url" alphabet.
   * @export
   */
  static fromBase64(str: string): Uint8Array {
    // atob creates a "raw string" where each character is interpreted as a
    // byte.
    const bytes = window.atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; ++i) {
      result[i] = bytes.charCodeAt(i);
    }
    return result;
  }

  /**
   * Convert a hex string to a Uint8Array.
   * @export
   */
  static fromHex(str: string): Uint8Array {
    const size = str.length / 2;
    const arr = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = window.parseInt(str.substr(i * 2, 2), 16);
    }
    return arr;
  }

  /**
   * Convert a buffer to a hex string.
   * @export
   */
  static toHex(data: BufferSource): string {
    const arr = BufferUtils.toUint8(data);
    let hex = '';
    for (let value of arr) {
      value = value.toString(16);
      if (value.length == 1) {
        value = '0' + value;
      }
      hex += value;
    }
    return hex;
  }

  /**
   * Concatenate buffers.
   * @export
   */
  static concat(...varArgs): Uint8Array {
    let totalLength = 0;
    for (const arr of varArgs) {
      totalLength += arr.byteLength;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of varArgs) {
      result.set(BufferUtils.toUint8(arr), offset);
      offset += arr.byteLength;
    }
    return result;
  }
}
