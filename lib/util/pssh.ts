/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as logExports from './debug___log';
import {log} from './debug___log';
import {BufferUtils} from './util___buffer_utils';
import * as Mp4ParserExports from './util___mp4_parser';
import {Mp4Parser} from './util___mp4_parser';
import {Uint8ArrayUtils} from './util___uint8array_utils';

/**
 * @summary
 * Parse a PSSH box and extract the system IDs.
 */
export class Pssh {
  /**
   * In hex.
   */
  systemIds: string[] = [];

  /**
   * In hex.
   */
  cencKeyIds: string[] = [];

  /**
   * Array with the pssh boxes found.
   */
  data: Uint8Array[] = [];

  constructor(psshBox: Uint8Array) {
    (new Mp4Parser())
        .box('moov', Mp4Parser.children)
        .fullBox('pssh', (box) => this.parsePsshBox_(box))
        .parse(psshBox);
    if (this.data.length == 0) {
      log.warning('No pssh box found!');
    }
  }

  private parsePsshBox_(box: shaka.extern.ParsedBox) {
    asserts.assert(
        box.version != null,
        'PSSH boxes are full boxes and must have a valid version');
    asserts.assert(
        box.flags != null,
        'PSSH boxes are full boxes and must have a valid flag');
    if (box.version > 1) {
      log.warning('Unrecognized PSSH version found!');
      return;
    }

    // The "reader" gives us a view on the payload of the box.  Create a new
    // view that contains the whole box.
    const dataView = box.reader.getDataView();
    asserts.assert(dataView.byteOffset >= 12, 'DataView at incorrect position');
    const pssh = BufferUtils.toUint8(dataView, -12, box.size);
    this.data.push(pssh);
    this.systemIds.push(Uint8ArrayUtils.toHex(box.reader.readBytes(16)));
    if (box.version > 0) {
      const numKeyIds = box.reader.readUint32();
      for (let i = 0; i < numKeyIds; i++) {
        const keyId = Uint8ArrayUtils.toHex(box.reader.readBytes(16));
        this.cencKeyIds.push(keyId);
      }
    }
  }

  /**
   * Creates a pssh blob from the given system ID, data, keyIds and version.
   *
   */
  static createPssh(
      data: Uint8Array, systemId: Uint8Array, keyIds: Set<string>,
      version: number): Uint8Array {
    asserts.assert(systemId.byteLength == 16, 'Invalid system ID length');
    const dataLength = data.length;
    let psshSize = 4 + 4 + 4 + systemId.length + 4 + dataLength;
    if (version > 0) {
      psshSize += 4 + 16 * keyIds.size;
    }
    const psshBox: Uint8Array = new Uint8Array(psshSize);
    const psshData: DataView = BufferUtils.toDataView(psshBox);
    let byteCursor = 0;
    psshData.setUint32(byteCursor, psshSize);
    byteCursor += 4;
    psshData.setUint32(
        byteCursor,
        // 'pssh'
        1886614376);
    byteCursor += 4;
    version < 1 ? psshData.setUint32(byteCursor, 0) :
                  psshData.setUint32(
                      byteCursor,
                      // version + flags
                      16777216);
    byteCursor += 4;
    psshBox.set(systemId, byteCursor);
    byteCursor += systemId.length;

    // if version > 0, add KID count and kid values.
    if (version > 0) {
      psshData.setUint32(
          byteCursor,
          // KID_count
          keyIds.size);
      byteCursor += 4;
      const Uint8ArrayUtils = Uint8ArrayUtils;
      for (const keyId of keyIds) {
        const KID = Uint8ArrayUtils.fromHex(keyId);
        psshBox.set(KID, byteCursor);
        byteCursor += KID.length;
      }
    }
    psshData.setUint32(byteCursor, dataLength);
    byteCursor += 4;
    psshBox.set(data, byteCursor);
    byteCursor += dataLength;
    asserts.assert(byteCursor === psshSize, 'PSSH invalid length.');
    return psshBox;
  }

  /**
   * Normalise the initData array. This is to apply browser specific
   * work-arounds, e.g. removing duplicates which appears to occur
   * intermittently when the native msneedkey event fires (i.e. event.initData
   * contains dupes).
   *
   */
  static normaliseInitData(initData: Uint8Array): Uint8Array {
    if (!initData) {
      return initData;
    }
    const pssh = new Pssh(initData);

    // If there is only a single pssh, return the original array.
    if (pssh.data.length <= 1) {
      return initData;
    }

    // Dedupe psshData.
    const dedupedInitDatas: Uint8Array[] = [];
    for (const initData of pssh.data) {
      const found = dedupedInitDatas.some((x) => {
        return BufferUtils.equal(x, initData);
      });
      if (!found) {
        dedupedInitDatas.push(initData);
      }
    }
    return Uint8ArrayUtils.concat(...dedupedInitDatas);
  }
}
