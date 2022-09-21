/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import {BaseStorageCell} from './dev-workspace.shaka-player-fork.lib.offline.indexeddb.base_storage_cell';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import * as ManifestParserUtilsExports from './dev-workspace.shaka-player-fork.lib.util.manifest_parser_utils';
import {ManifestParserUtils} from './dev-workspace.shaka-player-fork.lib.util.manifest_parser_utils';
import * as PeriodCombinerExports from './dev-workspace.shaka-player-fork.lib.util.periods';
import {PeriodCombiner} from './dev-workspace.shaka-player-fork.lib.util.periods';
import {PublicPromise} from './dev-workspace.shaka-player-fork.lib.util.public_promise';

/**
 * The V1StorageCell is for all stores that follow the shaka.externs V1 offline
 * types, introduced in Shaka Player v2.0 and deprecated in v2.3.
 *
 */
export class V1StorageCell extends BaseStorageCell implements shaka.
extern.StorageCell {
  /** @override */
  async updateManifestExpiration(key, newExpiration) {
    const op = this.connection_.startReadWriteOperation(this.manifestStore_);
    const store: IDBObjectStore = op.store();
    const p: PublicPromise = new PublicPromise();
    store.get(key).onsuccess = (event) => {
      // Make sure a defined value was found. Indexeddb treats "no value found"
      // as a success with an undefined result.
      const manifest = (event.target.result as shaka.extern.ManifestDBV1);

      // Indexeddb does not fail when you get a value that is not in the
      // database. It will return an undefined value. However, we expect
      // the value to never be null, so something is wrong if we get a
      // falsey value.
      if (manifest) {
        // Since this store's scheme uses in-line keys, we don't specify the key
        // with |put|.  This difference is why we must override the base class.
        asserts.assert(
            manifest.key == key, 'With in-line keys, the keys should match');
        manifest.expiration = newExpiration;
        store.put(manifest);
        p.resolve();
      } else {
        p.reject(new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
            ErrorExports.Code.KEY_NOT_FOUND,
            'Could not find values for ' + key));
      }
    };
    await Promise.all([op.promise(), p]);
  }

  /**
   * @override
   */
  async convertManifest(old: shaka.extern.ManifestDBV1):
      Promise<shaka.extern.ManifestDB> {
    const V1StorageCell = V1StorageCell;
    const streamsPerPeriod = [];
    for (let i = 0; i < old.periods.length; ++i) {
      // The last period ends at the end of the presentation.
      const periodEnd = i == old.periods.length - 1 ?
          old.duration :
          old.periods[i + 1].startTime;
      const duration = periodEnd - old.periods[i].startTime;
      const streams = V1StorageCell.convertPeriod_(old.periods[i], duration);
      streamsPerPeriod.push(streams);
    }
    const streams = await PeriodCombiner.combineDbStreams(streamsPerPeriod);
    return {
      creationTime: 0,
      originalManifestUri: old.originalManifestUri,
      duration: old.duration,
      size: old.size,
      expiration: old.expiration == null ? Infinity : old.expiration,
      streams,
      sessionIds: old.sessionIds,
      drmInfo: old.drmInfo,
      appMetadata: old.appMetadata,
      sequenceMode: false
    };
  }

  private static convertPeriod_(
      old: shaka.extern.PeriodDBV1,
      periodDuration: number): shaka.extern.StreamDB[] {
    const V1StorageCell = V1StorageCell;

    // In the case that this is really old (like really old, like dinosaurs
    // roaming the Earth old) there may be no variants, so we need to add those.
    V1StorageCell.fillMissingVariants_(old);
    for (const stream of old.streams) {
      const message = 'After filling in missing variants, ' +
          'each stream should have variant ids';
      asserts.assert(stream.variantIds, message);
    }
    return old.streams.map(
        (stream) => V1StorageCell.convertStream_(
            stream, old.startTime, periodDuration));
  }

  private static convertStream_(
      old: shaka.extern.StreamDBV1, periodStart: number,
      periodDuration: number): shaka.extern.StreamDB {
    const V1StorageCell = V1StorageCell;
    const initSegmentKey = old.initSegmentUri ?
        V1StorageCell.getKeyFromSegmentUri_(old.initSegmentUri) :
        null;

    // timestampOffset in the new format is the inverse of
    // presentationTimeOffset in the old format.  Also, PTO did not include the
    // period start, while TO does.
    const timestampOffset = periodStart + old.presentationTimeOffset;
    const appendWindowStart = periodStart;
    const appendWindowEnd = periodStart + periodDuration;
    return {
      id: old.id,
      originalId: null,
      primary: old.primary,
      type: old.contentType,
      mimeType: old.mimeType,
      codecs: old.codecs,
      frameRate: old.frameRate,
      pixelAspectRatio: undefined,
      hdr: undefined,
      kind: old.kind,
      language: old.language,
      label: old.label,
      width: old.width,
      height: old.height,
      initSegmentKey: initSegmentKey,
      encrypted: old.encrypted,
      keyIds: new Set([old.keyId]),
      segments: old.segments.map(
          (segment) => V1StorageCell.convertSegment_(
              segment, initSegmentKey, appendWindowStart, appendWindowEnd,
              timestampOffset)),
      variantIds: old.variantIds,
      roles: [],
      forced: false,
      audioSamplingRate: null,
      channelsCount: null,
      spatialAudio: false,
      closedCaptions: null,
      tilesLayout: undefined
    };
  }

  private static convertSegment_(
      old: shaka.extern.SegmentDBV1, initSegmentKey: number|null,
      appendWindowStart: number, appendWindowEnd: number,
      timestampOffset: number): shaka.extern.SegmentDB {
    const V1StorageCell = V1StorageCell;

    // Since we don't want to use the uri anymore, we need to parse the key
    // from it.
    const dataKey = V1StorageCell.getKeyFromSegmentUri_(old.uri);
    return {
      startTime: appendWindowStart + old.startTime,
      endTime: appendWindowStart + old.endTime,
      dataKey,
      initSegmentKey,
      appendWindowStart,
      appendWindowEnd,
      timestampOffset,
      tilesLayout: ''
    };
  }

  /**
   * @override
   */
  convertSegmentData(old: shaka.extern.SegmentDataDBV1):
      shaka.extern.SegmentDataDB {
    return {data: old.data};
  }

  private static getKeyFromSegmentUri_(uri: string): number {
    let parts = null;

    // Try parsing the uri as the original Shaka Player 2.0 uri.
    parts = /^offline:[0-9]+\/[0-9]+\/([0-9]+)$/.exec(uri);
    if (parts) {
      return Number(parts[1]);
    }

    // Just before Shaka Player 2.3 the uri format was changed to remove some
    // of the un-used information from the uri and make the segment uri and
    // manifest uri follow a similar format. However the old storage system
    // was still in place, so it is possible for Storage V1 Cells to have
    // Storage V2 uris.
    parts = /^offline:segment\/([0-9]+)$/.exec(uri);
    if (parts) {
      return Number(parts[1]);
    }
    throw new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.STORAGE,
        ErrorExports.Code.MALFORMED_OFFLINE_URI, 'Could not parse uri ' + uri);
  }

  /**
   * Take a period and check if the streams need to have variants generated.
   * Before Shaka Player moved to its variants model, there were no variants.
   * This will fill missing variants into the given object.
   *
   */
  private static fillMissingVariants_(period: shaka.extern.PeriodDBV1) {
    const AUDIO = ManifestParserUtilsExports.ContentType.AUDIO;
    const VIDEO = ManifestParserUtilsExports.ContentType.VIDEO;

    // There are three cases:
    //  1. All streams' variant ids are null
    //  2. All streams' variant ids are non-null
    //  3. Some streams' variant ids are null and other are non-null
    // Case 3 is invalid and should never happen in production.
    const audio = period.streams.filter((s) => s.contentType == AUDIO);
    const video = period.streams.filter((s) => s.contentType == VIDEO);

    // Case 2 - There is nothing we need to do, so let's just get out of here.
    if (audio.every((s) => s.variantIds) && video.every((s) => s.variantIds)) {
      return;
    }

    // Case 3... We don't want to be in case three.
    asserts.assert(
        audio.every((s) => !s.variantIds),
        'Some audio streams have variant ids and some do not.');
    asserts.assert(
        video.every((s) => !s.variantIds),
        'Some video streams have variant ids and some do not.');

    // Case 1 - Populate all the variant ids (putting us back to case 2).
    // Since all the variant ids are null, we need to first make them into
    // valid arrays.
    for (const s of audio) {
      s.variantIds = [];
    }
    for (const s of video) {
      s.variantIds = [];
    }
    let nextId = 0;

    // It is not possible in Shaka Player's pre-variant world to have audio-only
    // and video-only content mixed in with audio-video content. So we can
    // assume that there is only audio-only or video-only if one group is empty.

    // Everything is video-only content - so each video stream gets to be its
    // own variant.
    if (video.length && !audio.length) {
      log.debug('Found video-only content. Creating variants for video.');
      const variantId = nextId++;
      for (const s of video) {
        s.variantIds.push(variantId);
      }
    }

    // Everything is audio-only content - so each audio stream gets to be its
    // own variant.
    if (!video.length && audio.length) {
      log.debug('Found audio-only content. Creating variants for audio.');
      const variantId = nextId++;
      for (const s of audio) {
        s.variantIds.push(variantId);
      }
    }

    // Everything is audio-video content.
    if (video.length && audio.length) {
      log.debug('Found audio-video content. Creating variants.');
      for (const a of audio) {
        for (const v of video) {
          const variantId = nextId++;
          a.variantIds.push(variantId);
          v.variantIds.push(variantId);
        }
      }
    }
  }
}
