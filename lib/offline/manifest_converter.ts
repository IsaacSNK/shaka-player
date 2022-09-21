/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {PresentationTimeline} from './dev-workspace.shaka-player-fork.lib.media.presentation_timeline';
import {SegmentIndex} from './dev-workspace.shaka-player-fork.lib.media.segment_index';
import * as SegmentReferenceExports from './dev-workspace.shaka-player-fork.lib.media.segment_reference';
import {InitSegmentReference, SegmentReference} from './dev-workspace.shaka-player-fork.lib.media.segment_reference';
import {OfflineUri} from './dev-workspace.shaka-player-fork.lib.offline.offline_uri';
import * as ManifestParserUtilsExports from './dev-workspace.shaka-player-fork.lib.util.manifest_parser_utils';
import {ManifestParserUtils} from './dev-workspace.shaka-player-fork.lib.util.manifest_parser_utils';

/**
 * Utility class for converting database manifest objects back to normal
 * player-ready objects. Used by the offline system to convert on-disk
 * objects back to the in-memory objects.
 */
export class ManifestConverter {
  private mechanism_: string;
  private cell_: string;

  /**
   * Create a new manifest converter. Need to know the mechanism and cell that
   * the manifest is from so that all segments paths can be created.
   *
   */
  constructor(mechanism: string, cell: string) {
    this.mechanism_ = mechanism;
    this.cell_ = cell;
  }

  /**
   * Convert a |shaka.extern.ManifestDB| object to a |shaka.extern.Manifest|
   * object.
   *
   */
  fromManifestDB(manifestDB: shaka.extern.ManifestDB): shaka.extern.Manifest {
    const timeline = new PresentationTimeline(null, 0);
    timeline.setDuration(manifestDB.duration);
    const audioStreams: shaka.extern.StreamDB[] =
        manifestDB.streams.filter((streamDB) => this.isAudio_(streamDB));
    const videoStreams: shaka.extern.StreamDB[] =
        manifestDB.streams.filter((streamDB) => this.isVideo_(streamDB));
    const variants: Map<number, shaka.extern.Variant> =
        this.createVariants(audioStreams, videoStreams, timeline);
    const textStreams: shaka.extern.Stream[] =
        manifestDB.streams.filter((streamDB) => this.isText_(streamDB))
            .map((streamDB) => this.fromStreamDB_(streamDB, timeline));
    const imageStreams: shaka.extern.Stream[] =
        manifestDB.streams.filter((streamDB) => this.isImage_(streamDB))
            .map((streamDB) => this.fromStreamDB_(streamDB, timeline));
    const drmInfos = manifestDB.drmInfo ? [manifestDB.drmInfo] : [];
    if (manifestDB.drmInfo) {
      for (const variant of variants.values()) {
        if (variant.audio && variant.audio.encrypted) {
          variant.audio.drmInfos = drmInfos;
        }
        if (variant.video && variant.video.encrypted) {
          variant.video.drmInfos = drmInfos;
        }
      }
    }
    return {
      presentationTimeline: timeline,
      minBufferTime: 2,
      offlineSessionIds: manifestDB.sessionIds,
      variants: Array.from(variants.values()),
      textStreams: textStreams,
      imageStreams: imageStreams,
      sequenceMode: manifestDB.sequenceMode || false
    };
  }

  /**
   * Recreates Variants from audio and video StreamDB collections.
   *
   */
  createVariants(
      audios: shaka.extern.StreamDB[], videos: shaka.extern.StreamDB[],
      timeline: PresentationTimeline): Map<number, shaka.extern.Variant> {
    // Get all the variant ids from all audio and video streams.
    const variantIds: Set<number> = new Set();
    for (const streamDB of audios) {
      for (const id of streamDB.variantIds) {
        variantIds.add(id);
      }
    }
    for (const streamDB of videos) {
      for (const id of streamDB.variantIds) {
        variantIds.add(id);
      }
    }
    const variantMap: Map<number, shaka.extern.Variant> = new Map();
    for (const id of variantIds) {
      variantMap.set(id, this.createEmptyVariant_(id));
    }

    // Assign each audio stream to its variants.
    for (const audio of audios) {
      const stream: shaka.extern.Stream = this.fromStreamDB_(audio, timeline);
      for (const variantId of audio.variantIds) {
        const variant = variantMap.get(variantId);
        asserts.assert(
            !variant.audio, 'A variant should only have one audio stream');
        variant.language = stream.language;
        variant.primary = variant.primary || stream.primary;
        variant.audio = stream;
      }
    }

    // Assign each video stream to its variants.
    for (const video of videos) {
      const stream: shaka.extern.Stream = this.fromStreamDB_(video, timeline);
      for (const variantId of video.variantIds) {
        const variant = variantMap.get(variantId);
        asserts.assert(
            !variant.video, 'A variant should only have one video stream');
        variant.primary = variant.primary || stream.primary;
        variant.video = stream;
      }
    }
    return variantMap;
  }

  private fromStreamDB_(
      streamDB: shaka.extern.StreamDB,
      timeline: PresentationTimeline): shaka.extern.Stream {
    const segments: SegmentReference[] = streamDB.segments.map(
        (segment, index) => this.fromSegmentDB_(index, segment));
    timeline.notifySegments(segments);
    const segmentIndex: SegmentIndex = new SegmentIndex(segments);
    const stream: shaka.extern.Stream = {
      id: streamDB.id,
      originalId: streamDB.originalId,
      createSegmentIndex: () => Promise.resolve(),
      segmentIndex,
      mimeType: streamDB.mimeType,
      codecs: streamDB.codecs,
      width: streamDB.width || undefined,
      height: streamDB.height || undefined,
      frameRate: streamDB.frameRate,
      pixelAspectRatio: streamDB.pixelAspectRatio,
      hdr: streamDB.hdr,
      kind: streamDB.kind,
      encrypted: streamDB.encrypted,
      drmInfos: [],
      keyIds: streamDB.keyIds,
      language: streamDB.language,
      label: streamDB.label,
      type: streamDB.type,
      primary: streamDB.primary,
      trickModeVideo: null,
      emsgSchemeIdUris: null,
      roles: streamDB.roles,
      forced: streamDB.forced,
      channelsCount: streamDB.channelsCount,
      audioSamplingRate: streamDB.audioSamplingRate,
      spatialAudio: streamDB.spatialAudio,
      closedCaptions: streamDB.closedCaptions,
      tilesLayout: streamDB.tilesLayout
    };
    return stream;
  }

  private fromSegmentDB_(index: number, segmentDB: shaka.extern.SegmentDB):
      SegmentReference {
    const uri: OfflineUri =
        OfflineUri.segment(this.mechanism_, this.cell_, segmentDB.dataKey);
    const initSegmentReference = segmentDB.initSegmentKey != null ?
        this.fromInitSegmentDB_(segmentDB.initSegmentKey) :
        null;
    return new SegmentReference(
        segmentDB.startTime, segmentDB.endTime, () => [uri.toString()],
        /* startByte= */
        0,
        /* endByte= */
        null, initSegmentReference, segmentDB.timestampOffset,
        segmentDB.appendWindowStart, segmentDB.appendWindowEnd,
        /* partialReferences= */
        [], segmentDB.tilesLayout || '');
  }

  private fromInitSegmentDB_(key: number): InitSegmentReference {
    const uri: OfflineUri =
        OfflineUri.segment(this.mechanism_, this.cell_, key);
    return new InitSegmentReference(
        () => [uri.toString()],
        /* startBytes= */
        0,
        /* endBytes= */
        null);
  }

  private isAudio_(streamDB: shaka.extern.StreamDB): boolean {
    const ContentType = ManifestParserUtilsExports.ContentType;
    return streamDB.type == ContentType.AUDIO;
  }

  private isVideo_(streamDB: shaka.extern.StreamDB): boolean {
    const ContentType = ManifestParserUtilsExports.ContentType;
    return streamDB.type == ContentType.VIDEO;
  }

  private isText_(streamDB: shaka.extern.StreamDB): boolean {
    const ContentType = ManifestParserUtilsExports.ContentType;
    return streamDB.type == ContentType.TEXT;
  }

  private isImage_(streamDB: shaka.extern.StreamDB): boolean {
    const ContentType = ManifestParserUtilsExports.ContentType;
    return streamDB.type == ContentType.IMAGE;
  }

  /**
   * Creates an empty Variant.
   *
   */
  private createEmptyVariant_(id: number): shaka.extern.Variant {
    return {
      id: id,
      language: '',
      disabledUntilTime: 0,
      primary: false,
      audio: null,
      video: null,
      bandwidth: 0,
      allowedByApplication: true,
      allowedByKeySystem: true,
      decodingInfos: []
    };
  }
}
