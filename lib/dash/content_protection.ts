/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DrmInfo, InitDataOverride } from '../../externs/shaka/manifest';
import * as assertsExports from './../debug/asserts';
import {asserts} from './../debug/asserts';
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import {BufferUtils} from './../util/buffer_utils';
import * as ErrorExports from './../util/error';
import {Error} from './../util/error';
import * as ManifestParserUtilsExports from './../util/manifest_parser_utils';
import {ManifestParserUtils} from './../util/manifest_parser_utils';
import {Pssh} from './../util/pssh';
import * as StringUtilsExports from './../util/string_utils';
import {StringUtils} from './../util/string_utils';
import {Uint8ArrayUtils} from './../util/uint8array_utils';
import {XmlUtils} from './../util/xml_utils';

/**
 * @summary A set of functions for parsing and interpreting ContentProtection
 *   elements.
 */
export class ContentProtection {
  /**
   * Parses info from the ContentProtection elements at the AdaptationSet level.
   *
   */
  static parseFromAdaptationSet(
      elems: Element[], ignoreDrmInfo: boolean,
      keySystemsByURI: {[key: string]: string}): Context {
    const ContentProtection = ContentProtection;
    const ManifestParserUtils = ManifestParserUtils;
    const parsed = ContentProtection.parseElements_(elems);
    let defaultInit: InitDataOverride[] = null;
    let drmInfos: DrmInfo[] = [];
    let parsedNonCenc = [];

    // Get the default key ID; if there are multiple, they must all match.
    const keyIds = new Set(parsed.map((element) => element.keyId));

    // Remove any possible null value (elements may have no key ids).
    keyIds.delete(null);
    if (keyIds.size > 1) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.DASH_CONFLICTING_KEY_IDS);
    }
    if (!ignoreDrmInfo) {
      // Find the default key ID and init data.  Create a new array of all the
      // non-CENC elements.
      parsedNonCenc = parsed.filter((elem) => {
        if (elem.schemeUri == ContentProtection.MP4Protection_) {
          asserts.assert(
              !elem.init || elem.init.length,
              'Init data must be null or non-empty.');
          defaultInit = elem.init || defaultInit;
          return false;
        } else {
          return true;
        }
      });
      if (parsedNonCenc.length) {
        drmInfos = ContentProtection.convertElements_(
            defaultInit, parsedNonCenc, keySystemsByURI, keyIds);

        // If there are no drmInfos after parsing, then add a dummy entry.
        // This may be removed in parseKeyIds.
        if (drmInfos.length == 0) {
          drmInfos = [ManifestParserUtils.createDrmInfo('', defaultInit)];
        }
      }
    }

    // If there are only CENC element(s) or ignoreDrmInfo flag is set, assume
    // all key-systems are supported.
    if (parsed.length && (ignoreDrmInfo || !parsedNonCenc.length)) {
      drmInfos = [];
      for (const keySystem of Object.values(keySystemsByURI)) {
        // If the manifest doesn't specify any key systems, we shouldn't
        // put clearkey in this list.  Otherwise, it may be triggered when
        // a real key system should be used instead.
        if (keySystem != 'org.w3.clearkey') {
          const info =
              ManifestParserUtils.createDrmInfo(keySystem, defaultInit);
          drmInfos.push(info);
        }
      }
    }

    // If we have a default key id, apply it to every initData.
    const defaultKeyId = Array.from(keyIds)[0] || null;
    if (defaultKeyId) {
      for (const info of drmInfos) {
        for (const initData of info.initData) {
          initData.keyId = defaultKeyId;
        }
      }
    }
    return {
      defaultKeyId: defaultKeyId,
      defaultInit: defaultInit,
      drmInfos: drmInfos,
      firstRepresentation: true
    };
  }

  /**
   * Parses the given ContentProtection elements found at the Representation
   * level.  This may update the |context|.
   *
   * @return The parsed key ID
   */
  static parseFromRepresentation(
      elems: Element[], context: Context, ignoreDrmInfo: boolean,
      keySystemsByURI: {[key: string]: string}): string|null {
    const ContentProtection = ContentProtection;
    const repContext = ContentProtection.parseFromAdaptationSet(
        elems, ignoreDrmInfo, keySystemsByURI);
    if (context.firstRepresentation) {
      const asUnknown =
          context.drmInfos.length == 1 && !context.drmInfos[0].keySystem;
      const asUnencrypted = context.drmInfos.length == 0;
      const repUnencrypted = repContext.drmInfos.length == 0;

      // There are two cases where we need to replace the |drmInfos| in the
      // context with those in the Representation:
      //   1. The AdaptationSet does not list any ContentProtection.
      //   2. The AdaptationSet only lists unknown key-systems.
      if (asUnencrypted || asUnknown && !repUnencrypted) {
        context.drmInfos = repContext.drmInfos;
      }
      context.firstRepresentation = false;
    } else {
      if (repContext.drmInfos.length > 0) {
        // If this is not the first Representation, then we need to remove
        // entries from the context that do not appear in this Representation.
        context.drmInfos = context.drmInfos.filter((asInfo) => {
          return repContext.drmInfos.some((repInfo) => {
            return repInfo.keySystem == asInfo.keySystem;
          });
        });

        // If we have filtered out all key-systems, throw an error.
        if (context.drmInfos.length == 0) {
          throw new Error(
              ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
              ErrorExports.Code.DASH_NO_COMMON_KEY_SYSTEM);
        }
      }
    }
    return repContext.defaultKeyId || context.defaultKeyId;
  }

  /**
   * Gets a Widevine license URL from a content protection element
   * containing a custom `ms:laurl` element
   *
   */
  static getWidevineLicenseUrl(element: Element): string {
    const mslaurlNode =
        XmlUtils.findChildNS(element.node, 'urn:microsoft', 'laurl');
    if (mslaurlNode) {
      return mslaurlNode.getAttribute('licenseUrl') || '';
    }
    return '';
  }

  /**
   * Gets a ClearKey license URL from a content protection element
   * containing a custom `clearkey::Laurl` element
   *
   */
  static getClearKeyLicenseUrl(element: Element): string {
    const clearKeyLaurlNode =
        XmlUtils.findChildNS(element.node, ClearKeyNamespaceUri_, 'Laurl');
    if (clearKeyLaurlNode &&
        clearKeyLaurlNode.getAttribute('Lic_type') === 'EME-1.0') {
      if (clearKeyLaurlNode.textContent) {
        return clearKeyLaurlNode.textContent;
      }
    }
    return '';
  }

  /**
   * Parses an Array buffer starting at byteOffset for PlayReady Object Records.
   * Each PRO Record is preceded by its PlayReady Record type and length in
   * bytes.
   *
   * PlayReady Object Record format: https://goo.gl/FTcu46
   *
   */
  private static parseMsProRecords_(view: DataView, byteOffset: number):
      PlayReadyRecord[] {
    const records = [];
    while (byteOffset < view.byteLength - 1) {
      const type = view.getUint16(byteOffset, true);
      byteOffset += 2;
      const byteLength = view.getUint16(byteOffset, true);
      byteOffset += 2;
      if ((byteLength & 1) != 0 || byteLength + byteOffset > view.byteLength) {
        log.warning('Malformed MS PRO object');
        return [];
      }
      const recordValue = BufferUtils.toUint8(view, byteOffset, byteLength);
      records.push({type: type, value: recordValue});
      byteOffset += byteLength;
    }
    return records;
  }

  /**
   * Parses a buffer for PlayReady Objects.  The data
   * should contain a 32-bit integer indicating the length of
   * the PRO in bytes.  Following that, a 16-bit integer for
   * the number of PlayReady Object Records in the PRO.  Lastly,
   * a byte array of the PRO Records themselves.
   *
   * PlayReady Object format: https://goo.gl/W8yAN4
   *
   */
  private static parseMsPro_(data: BufferSource): PlayReadyRecord[] {
    let byteOffset = 0;
    const view = BufferUtils.toDataView(data);

    // First 4 bytes is the PRO length (DWORD)
    const byteLength = view.getUint32(
        byteOffset,
        /* littleEndian= */
        true);
    byteOffset += 4;
    if (byteLength != data.byteLength) {
      // Malformed PRO
      log.warning('PlayReady Object with invalid length encountered.');
      return [];
    }

    // Skip PRO Record count (WORD)
    byteOffset += 2;

    // Rest of the data contains the PRO Records
    const ContentProtection = ContentProtection;
    return ContentProtection.parseMsProRecords_(view, byteOffset);
  }

  /**
   * PlayReady Header format: https://goo.gl/dBzxNA
   *
   */
  private static getLaurl_(xml: Element): string {
    // LA_URL element is optional and no more than one is
    // allowed inside the DATA element. Only absolute URLs are allowed.
    // If the LA_URL element exists, it must not be empty.
    for (const elem of xml.getElementsByTagName('DATA')) {
      for (const child of elem.childNodes) {
        if (child instanceof Element && child.tagName == 'LA_URL') {
          return child.textContent;
        }
      }
    }

    // Not found
    return '';
  }

  /**
   * Gets a PlayReady license URL from a content protection element
   * containing a PlayReady Header Object
   *
   */
  static getPlayReadyLicenseUrl(element: Element): string {
    const proNode =
        XmlUtils.findChildNS(element.node, 'urn:microsoft:playready', 'pro');
    if (!proNode) {
      return '';
    }
    const ContentProtection = ContentProtection;
    const PLAYREADY_RECORD_TYPES = ContentProtection.PLAYREADY_RECORD_TYPES;
    const bytes = Uint8ArrayUtils.fromBase64(proNode.textContent);
    const records = ContentProtection.parseMsPro_(bytes);
    const record = records.filter((record) => {
      return record.type === PLAYREADY_RECORD_TYPES.RIGHTS_MANAGEMENT;
    })[0];
    if (!record) {
      return '';
    }
    const xml = StringUtils.fromUTF16(record.value, true);
    const rootElement = XmlUtils.parseXmlString(xml, 'WRMHEADER');
    if (!rootElement) {
      return '';
    }
    return ContentProtection.getLaurl_(rootElement);
  }

  /**
   * Gets a PlayReady initData from a content protection element
   * containing a PlayReady Pro Object
   *
   */
  private static getInitDataFromPro_(element: Element):
      shaka.extern.InitDataOverride[]|null {
    const proNode =
        XmlUtils.findChildNS(element.node, 'urn:microsoft:playready', 'pro');
    if (!proNode) {
      return null;
    }
    const Uint8ArrayUtils = Uint8ArrayUtils;
    const data = Uint8ArrayUtils.fromBase64(proNode.textContent);
    const systemId = new Uint8Array([
      154, 4, 240, 121, 152, 64, 66, 134, 171, 146, 230, 91, 224, 136, 95, 149
    ]);
    const keyIds = new Set();
    const psshVersion = 0;
    const pssh = Pssh.createPssh(data, systemId, keyIds, psshVersion);
    return [{initData: pssh, initDataType: 'cenc', keyId: element.keyId}];
  }

  /**
   * Creates ClearKey initData from Default_KID value retrieved from previously
   * parsed ContentProtection tag.
   */
  private static getInitDataClearKey_(element: Element, keyIds: Set<string>):
      shaka.extern.InitDataOverride[]|null {
    if (keyIds.size == 0) {
      return null;
    }
    const systemId = new Uint8Array([
      16, 119, 239, 236, 192, 178, 77, 2, 172, 227, 60, 30, 82, 226, 251, 75
    ]);
    const data = new Uint8Array([]);
    const psshVersion = 1;
    const pssh = Pssh.createPssh(data, systemId, keyIds, psshVersion);
    return [{initData: pssh, initDataType: 'cenc', keyId: element.keyId}];
  }

  /**
   * Creates DrmInfo objects from the given element.
   *
   */
  private static convertElements_(
      defaultInit: shaka.extern.InitDataOverride[], elements: Element[],
      keySystemsByURI: {[key: string]: string},
      keyIds: Set<string>): shaka.extern.DrmInfo[] {
    const ContentProtection = ContentProtection;
    const ManifestParserUtils = ManifestParserUtils;
    const licenseUrlParsers = ContentProtection.licenseUrlParsers_;
    const out: shaka.extern.DrmInfo[] = [];
    for (const element of elements) {
      const keySystem = keySystemsByURI[element.schemeUri];
      if (keySystem) {
        asserts.assert(
            !element.init || element.init.length,
            'Init data must be null or non-empty.');
        const proInitData = ContentProtection.getInitDataFromPro_(element);
        let clearKeyInitData = null;
        if (element.schemeUri === ClearKeySchemeUri_) {
          clearKeyInitData =
              ContentProtection.getInitDataClearKey_(element, keyIds);
        }
        const initData =
            element.init || defaultInit || proInitData || clearKeyInitData;
        const info = ManifestParserUtils.createDrmInfo(keySystem, initData);
        const licenseParser = licenseUrlParsers.get(keySystem);
        if (licenseParser) {
          info.licenseServerUri = licenseParser(element);
        }
        out.push(info);
      }
    }
    return out;
  }

  /**
   * Parses the given ContentProtection elements.  If there is an error, it
   * removes those elements.
   *
   */
  private static parseElements_(elems: Element[]): Element[] {
    const out: Element[] = [];
    for (const elem of elems) {
      const parsed = ContentProtection.parseElement_(elem);
      if (parsed) {
        out.push(parsed);
      }
    }
    return out;
  }

  /**
   * Parses the given ContentProtection element.
   *
   */
  private static parseElement_(elem: Element): Element|null {
    const NS = CencNamespaceUri_;
    let schemeUri: string|null = elem.getAttribute('schemeIdUri');
    let keyId: string|null = XmlUtils.getAttributeNS(elem, NS, 'default_KID');
    const psshs: string[] =
        XmlUtils.findChildrenNS(elem, NS, 'pssh').map(XmlUtils.getContents);
    if (!schemeUri) {
      log.error(
          'Missing required schemeIdUri attribute on',
          'ContentProtection element', elem);
      return null;
    }
    schemeUri = schemeUri.toLowerCase();
    if (keyId) {
      keyId = keyId.replace(/-/g, '').toLowerCase();
      if (keyId.includes(' ')) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
            ErrorExports.Code.DASH_MULTIPLE_KEY_IDS_NOT_SUPPORTED);
      }
    }
    let init: shaka.extern.InitDataOverride[] = [];
    try {
      // Try parsing PSSH data.
      init = psshs.map((pssh) => {
        return {
          initDataType: 'cenc',
          initData: Uint8ArrayUtils.fromBase64(pssh),
          keyId: null
        };
      });
    } catch (e) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.DASH_PSSH_BAD_ENCODING);
    }
    return {
      node: elem,
      schemeUri: schemeUri,
      keyId: keyId,
      init: init.length > 0 ? init : null
    };
  }
}
type PlayReadyRecord = {
  type: number,
  value: Uint8Array
};

export {PlayReadyRecord};

/**
 * Enum for PlayReady record types.
 */
export enum PLAYREADY_RECORD_TYPES {
  RIGHTS_MANAGEMENT = 1,
  RESERVED,
  EMBEDDED_LICENSE
}
type Context = {
  defaultKeyId: string|null,
  defaultInit: shaka.extern.InitDataOverride[],
  drmInfos: shaka.extern.DrmInfo[],
  firstRepresentation: boolean
};

export {Context};
type Element = {
  node: Element,
  schemeUri: string,
  keyId: string|null,
  init: shaka.extern.InitDataOverride[]
};

export {Element};

/**
 * A map of key system name to license server url parser.
 *
 */
export const licenseUrlParsers_: Map<string, (p1: Element) => any> =
    (new Map())
        .set('com.widevine.alpha', ContentProtection.getWidevineLicenseUrl)
        .set(
            'com.microsoft.playready', ContentProtection.getPlayReadyLicenseUrl)
        .set(
            'com.microsoft.playready.recommendation',
            ContentProtection.getPlayReadyLicenseUrl)
        .set(
            'com.microsoft.playready.software',
            ContentProtection.getPlayReadyLicenseUrl)
        .set(
            'com.microsoft.playready.hardware',
            ContentProtection.getPlayReadyLicenseUrl)
        .set('org.w3.clearkey', ContentProtection.getClearKeyLicenseUrl);

export const MP4Protection_: string = 'urn:mpeg:dash:mp4protection:2011';

export const CencNamespaceUri_: string = 'urn:mpeg:cenc:2013';

export const ClearKeyNamespaceUri_: string =
    'http://dashif.org/guidelines/clearKey';

export const ClearKeySchemeUri_: string =
    'urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e';
