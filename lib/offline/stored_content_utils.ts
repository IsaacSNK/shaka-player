/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {ManifestConverter} from './dev-workspace.shaka-player-fork.lib.offline.manifest_converter';
import {OfflineUri} from './dev-workspace.shaka-player-fork.lib.offline.offline_uri';
import * as StreamUtilsExports from './dev-workspace.shaka-player-fork.lib.util.stream_utils';
import {StreamUtils} from './dev-workspace.shaka-player-fork.lib.util.stream_utils';

/**
 * A utility class used to create |shaka.extern.StoredContent| from different
 * types of input.
 */
export class StoredContentUtils {
  static fromManifest(
      originalUri: string, manifest: shaka.extern.Manifest, size: number,
      metadata: Object): shaka.extern.StoredContent {
    asserts.assert(
        manifest.variants.length,
        'Cannot create stored content from manifest with no variants.');
    const duration: number = manifest.presentationTimeline.getDuration();
    const tracks: shaka.extern.Track[] =
        StoredContentUtils.getTracks_(manifest);
    const content: shaka.extern.StoredContent = {
      offlineUri: null,
      originalManifestUri: originalUri,
      duration: duration,
      size: size,
      // This expiration value is temporary and will be used in progress reports
      // during the storage process.  The real value would have to come from
      // DrmEngine.
      expiration: Infinity,
      tracks: tracks,
      appMetadata: metadata,
      isIncomplete: false
    };
    return content;
  }

  static fromManifestDB(
      offlineUri: OfflineUri,
      manifestDB: shaka.extern.ManifestDB): shaka.extern.StoredContent {
    asserts.assert(
        manifestDB.streams.length,
        'Cannot create stored content from manifestDB with no streams.');
    const converter =
        new ManifestConverter(offlineUri.mechanism(), offlineUri.cell());
    const manifest: shaka.extern.Manifest =
        converter.fromManifestDB(manifestDB);
    const metadata: Object = manifestDB.appMetadata || {};
    const tracks: shaka.extern.Track[] =
        StoredContentUtils.getTracks_(manifest);
    asserts.assert(
        manifestDB.expiration != null,
        'Manifest expiration must be set by now!');
    const content: shaka.extern.StoredContent = {
      offlineUri: offlineUri.toString(),
      originalManifestUri: manifestDB.originalManifestUri,
      duration: manifestDB.duration,
      size: manifestDB.size,
      expiration: manifestDB.expiration,
      tracks: tracks,
      appMetadata: metadata,
      isIncomplete: manifestDB.isIncomplete || false
    };
    return content;
  }

  /**
   * Gets track representations of all playable variants and all text streams.
   *
   */
  private static getTracks_(manifest: shaka.extern.Manifest):
      shaka.extern.Track[] {
    const StreamUtils = StreamUtils;
    const tracks = [];
    const variants = StreamUtils.getPlayableVariants(manifest.variants);
    for (const variant of variants) {
      tracks.push(StreamUtils.variantToTrack(variant));
    }
    const textStreams = manifest.textStreams;
    for (const stream of textStreams) {
      tracks.push(StreamUtils.textStreamToTrack(stream));
    }
    return tracks;
  }
}
