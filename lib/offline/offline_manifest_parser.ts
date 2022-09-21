/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as ManifestParserExports from './dev-workspace.shaka-player-fork.lib.media.manifest_parser';
import {ManifestParser} from './dev-workspace.shaka-player-fork.lib.media.manifest_parser';
import {ManifestConverter} from './dev-workspace.shaka-player-fork.lib.offline.manifest_converter';
import {OfflineUri} from './dev-workspace.shaka-player-fork.lib.offline.offline_uri';
import * as StorageMuxerExports from './dev-workspace.shaka-player-fork.lib.offline.storage_muxer';
import {StorageMuxer} from './dev-workspace.shaka-player-fork.lib.offline.storage_muxer';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';

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
