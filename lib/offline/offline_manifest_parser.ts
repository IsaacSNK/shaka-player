/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as logExports from './debug___log';
import {log} from './debug___log';
import * as ManifestParserExports from './media___manifest_parser';
import {ManifestParser} from './media___manifest_parser';
import {ManifestConverter} from './offline___manifest_converter';
import {OfflineUri} from './offline___offline_uri';
import * as StorageMuxerExports from './offline___storage_muxer';
import {StorageMuxer} from './offline___storage_muxer';
import * as ErrorExports from './util___error';
import {Error} from './util___error';

/**
 * @summary Creates a new offline manifest parser.
 */
export class OfflineManifestParser implements shaka.
extern.ManifestParser {
  private uri_: OfflineUri = null;

  /** @override */
  configure(config) {}

  // No-op
  /** @override */
  async start(uriString, playerInterface) {
    const uri: OfflineUri = OfflineUri.parse(uriString);
    this.uri_ = uri;
    if (uri == null || !uri.isManifest()) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.NETWORK,
          ErrorExports.Code.MALFORMED_OFFLINE_URI, uriString);
    }
    const muxer: StorageMuxer = new StorageMuxer();
    try {
      await muxer.init();
      const cell = await muxer.getCell(uri.mechanism(), uri.cell());
      const manifests = await cell.getManifests([uri.key()]);
      const manifest = manifests[0];
      const converter = new ManifestConverter(uri.mechanism(), uri.cell());
      const finalManifest = converter.fromManifestDB(manifest);
      playerInterface.makeTextStreamsForClosedCaptions(finalManifest);
      return finalManifest;
    } finally {
      await muxer.destroy();
    }
  }

  /** @override */
  stop() {
    return Promise.resolve();
  }

  /** @override */
  update() {}

  // No-op
  /** @override */
  async onExpirationUpdated(sessionId, expiration) {
    asserts.assert(
        this.uri_, 'Should not get update event before start has been called');
    const uri: OfflineUri = this.uri_;
    const muxer: StorageMuxer = new StorageMuxer();
    try {
      await muxer.init();
      const cell = await muxer.getCell(uri.mechanism(), uri.cell());
      const manifests = await cell.getManifests([uri.key()]);
      const manifest = manifests[0];
      const foundSession = manifest.sessionIds.includes(sessionId);
      const newExpiration =
          manifest.expiration == undefined || manifest.expiration > expiration;
      if (foundSession && newExpiration) {
        log.debug('Updating expiration for stored content');
        await cell.updateManifestExpiration(uri.key(), expiration);
      }
    } catch (e) {
      // Ignore errors with update.
      log.error('There was an error updating', uri, e);
    } finally {
      await muxer.destroy();
    }
  }
}
ManifestParser.registerParserByMime(
    'application/x-offline-manifest', () => new OfflineManifestParser());
