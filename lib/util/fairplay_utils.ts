/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.require('goog.Uri');
import {asserts} from './debug___asserts';
import * as assertsExports from './debug___asserts';
import {NetworkingEngine} from './net___networking_engine';
import * as NetworkingEngineExports from './net___networking_engine';
import {BufferUtils} from './util___buffer_utils';
import {Error} from './util___error';
import * as ErrorExports from './util___error';
import {StringUtils} from './util___string_utils';
import * as StringUtilsExports from './util___string_utils';
import {Uint8ArrayUtils} from './util___uint8array_utils';

/**
 * @summary A set of FairPlay utility functions.
 * @export
 */
export class FairPlayUtils {
  /**
   * Check if FairPlay is supported.
   *
   * @export
   */
  static async isFairPlaySupported(): Promise<boolean> {
    const config = {
      initDataTypes: ['cenc', 'sinf', 'skd'],
      videoCapabilities: [{contentType: 'video/mp4; codecs="avc1.42E01E"'}]
    };
    try {
      await navigator.requestMediaKeySystemAccess('com.apple.fps', [config]);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Using the default method, extract a content ID from the init data.  This is
   * based on the FairPlay example documentation.
   *
   * @export
   */
  static defaultGetContentId(initData: BufferSource): string {
    const uriString = StringUtils.fromBytesAutoDetect(initData);

    // The domain of that URI is the content ID according to Apple's FPS
    // sample.
    const uri = new goog.Uri(uriString);
    return uri.getDomain();
  }

  /**
   * Transforms the init data buffer using the given data.  The format is:
   *
   * <pre>
   * [4 bytes] initDataSize
   * [initDataSize bytes] initData
   * [4 bytes] contentIdSize
   * [contentIdSize bytes] contentId
   * [4 bytes] certSize
   * [certSize bytes] cert
   * </pre>
   *
   * @param cert  The server certificate; this will throw if not
   *   provided.
   * @export
   */
  static initDataTransform(
      initData: BufferSource, contentId: BufferSource|string,
      cert: BufferSource|null): Uint8Array {
    if (!cert || !cert.byteLength) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.DRM,
          ErrorExports.Code.SERVER_CERTIFICATE_REQUIRED);
    }

    // From that, we build a new init data to use in the session.  This is
    // composed of several parts.  First, the init data as a UTF-16 sdk:// URL.
    // Second, a 4-byte LE length followed by the content ID in UTF-16-LE.
    // Third, a 4-byte LE length followed by the certificate.
    let contentIdArray: BufferSource;
    if (typeof contentId == 'string') {
      contentIdArray = StringUtils.toUTF16(
          contentId,
          /* littleEndian= */
          true);
    } else {
      contentIdArray = contentId;
    }

    // The init data we get is a UTF-8 string; convert that to a UTF-16 string.
    const sdkUri = StringUtils.fromBytesAutoDetect(initData);
    const utf16 = StringUtils.toUTF16(
        sdkUri,
        /* littleEndian= */
        true);
    const rebuiltInitData = new Uint8Array(
        12 + utf16.byteLength + contentIdArray.byteLength + cert.byteLength);
    let offset = 0;
    const append = (array: BufferSource) => {
      rebuiltInitData.set(BufferUtils.toUint8(array), offset);
      offset += array.byteLength;
    };
    const appendWithLength = (array: BufferSource) => {
      const view = BufferUtils.toDataView(rebuiltInitData);
      const value = array.byteLength;
      view.setUint32(
          offset, value,
          /* littleEndian= */
          true);
      offset += 4;
      append(array);
    };
    appendWithLength(utf16);
    appendWithLength(contentIdArray);
    appendWithLength(cert);
    asserts.assert(
        offset == rebuiltInitData.length, 'Inconsistent init data length');
    return rebuiltInitData;
  }

  /**
   * Verimatrix initDataTransform configuration.
   *
   * @export
   */
  static verimatrixInitDataTransform(
      initData: Uint8Array, initDataType: string,
      drmInfo: shaka.extern.DrmInfo|null) {
    if (initDataType !== 'skd') {
      return initData;
    }
    const StringUtils = StringUtils;
    const FairPlayUtils = FairPlayUtils;
    const cert = drmInfo.serverCertificate;
    const initDataAsString = StringUtils.fromBytesAutoDetect(initData);
    const contentId = initDataAsString.split('skd://').pop();
    return FairPlayUtils.initDataTransform(initData, contentId, cert);
  }

  /**
   * EZDRM initDataTransform configuration.
   *
   * @export
   */
  static ezdrmInitDataTransform(
      initData: Uint8Array, initDataType: string,
      drmInfo: shaka.extern.DrmInfo|null) {
    if (initDataType !== 'skd') {
      return initData;
    }
    const StringUtils = StringUtils;
    const FairPlayUtils = FairPlayUtils;
    const cert = drmInfo.serverCertificate;
    const initDataAsString = StringUtils.fromBytesAutoDetect(initData);
    const contentId = initDataAsString.split(';').pop();
    return FairPlayUtils.initDataTransform(initData, contentId, cert);
  }

  /**
   * Conax initDataTransform configuration.
   *
   * @export
   */
  static conaxInitDataTransform(
      initData: Uint8Array, initDataType: string,
      drmInfo: shaka.extern.DrmInfo|null) {
    if (initDataType !== 'skd') {
      return initData;
    }
    const StringUtils = StringUtils;
    const FairPlayUtils = FairPlayUtils;
    const cert = drmInfo.serverCertificate;
    const initDataAsString = StringUtils.fromBytesAutoDetect(initData);
    const skdValue = initDataAsString.split('skd://').pop().split('?').shift();
    const stringToArray = (string) => {
      // 2 bytes for each char
      const buffer = new ArrayBuffer(string.length * 2);
      const array = new Uint16Array(buffer);
      for (let i = 0, strLen = string.length; i < strLen; i++) {
        array[i] = string.charCodeAt(i);
      }
      return array;
    };
    const contentId = stringToArray(window.atob(skdValue));
    return FairPlayUtils.initDataTransform(initData, contentId, cert);
  }

  /**
   * Verimatrix FairPlay request.
   *
   * @export
   */
  static verimatrixFairPlayRequest(
      type: NetworkingEngineExports.RequestType,
      request: shaka.extern.Request) {
    if (type !== NetworkingEngineExports.RequestType.LICENSE) {
      return;
    }
    const body = (request.body as ArrayBuffer | ArrayBufferView);
    const originalPayload = BufferUtils.toUint8(body);
    const base64Payload = Uint8ArrayUtils.toBase64(originalPayload);
    request.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    request.body = StringUtils.toUTF8('spc=' + base64Payload);
  }

  /**
   * EZDRM FairPlay request.
   *
   * @export
   */
  static ezdrmFairPlayRequest(
      type: NetworkingEngineExports.RequestType,
      request: shaka.extern.Request) {
    if (type !== NetworkingEngineExports.RequestType.LICENSE) {
      return;
    }
    request.headers['Content-Type'] = 'application/octet-stream';
  }

  /**
   * Conax FairPlay request.
   *
   * @export
   */
  static conaxFairPlayRequest(
      type: NetworkingEngineExports.RequestType,
      request: shaka.extern.Request) {
    if (type !== NetworkingEngineExports.RequestType.LICENSE) {
      return;
    }
    request.headers['Content-Type'] = 'application/octet-stream';
  }

  /**
   * Common FairPlay response transform for some DRMs providers.
   *
   * @export
   */
  static commonFairPlayResponse(
      type: NetworkingEngineExports.RequestType,
      response: shaka.extern.Response) {
    if (type !== NetworkingEngineExports.RequestType.LICENSE) {
      return;
    }

    // In Apple's docs, responses can be of the form:
    //   '\n<ckc>base64encoded</ckc>\n' or 'base64encoded'
    // We have also seen responses in JSON format from some of our partners.
    // In all of these text-based formats, the CKC data is base64-encoded.
    let responseText;
    try {
      // Convert it to text for further processing.
      responseText = StringUtils.fromUTF8(response.data);
    } catch (error) {
      // Assume it's not a text format of any kind and leave it alone.
      return;
    }
    let licenseProcessing = false;

    // Trim whitespace.
    responseText = responseText.trim();

    // Look for <ckc> wrapper and remove it.
    if (responseText.substr(0, 5) === '<ckc>' &&
        responseText.substr(-6) === '</ckc>') {
      responseText = responseText.slice(5, -6);
      licenseProcessing = true;
    }

    // Look for a JSON wrapper and remove it.
    try {
      const responseObject = (JSON.parse(responseText) as Object);
      if (responseObject['ckc']) {
        responseText = responseObject['ckc'];
        licenseProcessing = true;
      }
      if (responseObject['CkcMessage']) {
        responseText = responseObject['CkcMessage'];
        licenseProcessing = true;
      }
      if (responseObject['License']) {
        responseText = responseObject['License'];
        licenseProcessing = true;
      }
    } catch (err) {
    }

    // It wasn't JSON.  Fall through with other transformations.
    if (licenseProcessing) {
      // Decode the base64-encoded data into the format the browser expects.
      // It's not clear why FairPlay license servers don't just serve this
      // directly.
      response.data =
          BufferUtils.toArrayBuffer(Uint8ArrayUtils.fromBase64(responseText));
    }
  }
}
