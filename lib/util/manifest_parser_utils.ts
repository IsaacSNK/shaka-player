/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.require('goog.Uri');
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Functional} from './dev-workspace.shaka-player-fork.lib.util.functional';

/**
 * @summary Utility functions for manifest parsing.
 */
export class ManifestParserUtils {
  /**
   * Resolves an array of relative URIs to the given base URIs. This will result
   * in M*N number of URIs.
   *
   */
  static resolveUris(baseUris: string[], relativeUris: string[]): string[] {
    const Functional = Functional;
    if (relativeUris.length == 0) {
      return baseUris;
    }
    const relativeAsGoog = relativeUris.map((uri) => new goog.Uri(uri));

    // Resolve each URI relative to each base URI, creating an Array of Arrays.
    // Then flatten the Arrays into a single Array.
    return baseUris.map((uri) => new goog.Uri(uri))
        .map((base) => relativeAsGoog.map((i) => base.resolve(i)))
        .reduce(Functional.collapseArrays, [])
        .map((uri) => uri.toString());
  }

  /**
   * Creates a DrmInfo object from the given info.
   *
   */
  static createDrmInfo(
      keySystem: string,
      initData: shaka.extern.InitDataOverride[]): shaka.extern.DrmInfo {
    return {
      keySystem: keySystem,
      licenseServerUri: '',
      distinctiveIdentifierRequired: false,
      persistentStateRequired: false,
      audioRobustness: '',
      videoRobustness: '',
      serverCertificate: null,
      serverCertificateUri: '',
      sessionType: '',
      initData: initData || [],
      keyIds: new Set()
    };
  }

  /**
   * Attempts to guess which codecs from the codecs list belong to a given
   * content type.
   * Assumes that at least one codec is correct, and throws if none are.
   *
   */
  static guessCodecs(contentType: string, codecs: string[]): string {
    if (codecs.length == 1) {
      return codecs[0];
    }
    const match = ManifestParserUtils.guessCodecsSafe(contentType, codecs);

    // A failure is specifically denoted by null; an empty string represents a
    // valid match of no codec.
    if (match != null) {
      return match;
    }

    // Unable to guess codecs.
    throw new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
        ErrorExports.Code.HLS_COULD_NOT_GUESS_CODECS, codecs);
  }

  /**
   * Attempts to guess which codecs from the codecs list belong to a given
   * content type. Does not assume a single codec is anything special, and does
   * not throw if it fails to match.
   *
   * @return or null if no match is found
   */
  static guessCodecsSafe(contentType: string, codecs: string[]): string|null {
    const formats = CODEC_REGEXPS_BY_CONTENT_TYPE_[contentType];
    for (const format of formats) {
      for (const codec of codecs) {
        if (format.test(codec.trim())) {
          return codec.trim();
        }
      }
    }

    // Text does not require a codec string.
    if (contentType == ContentType.TEXT) {
      return '';
    }
    return null;
  }
}

export enum ContentType {
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text',
  IMAGE = 'image',
  APPLICATION = 'application'
}

export enum TextStreamKind {
  SUBTITLE = 'subtitle',
  CLOSED_CAPTION = 'caption'
}

/**
 * Specifies how tolerant the player is of inaccurate segment start times and
 * end times within a manifest. For example, gaps or overlaps between segments
 * in a SegmentTimeline which are greater than or equal to this value will
 * result in a warning message.
 *
 */
export const GAP_OVERLAP_TOLERANCE_SECONDS: number = 1 / 15;

/**
 * A list of regexps to detect well-known video codecs.
 *
 */
export const VIDEO_CODEC_REGEXPS_: RegExp[] =
    [/^avc/, /^hev/, /^hvc/, /^vp0?[89]/, /^av01/];

/**
 * A list of regexps to detect well-known audio codecs.
 *
 */
export const AUDIO_CODEC_REGEXPS_: RegExp[] =
    [/^vorbis$/, /^opus$/, /^flac$/, /^mp4a/, /^[ae]c-3$/];

/**
 * A list of regexps to detect well-known text codecs.
 *
 */
export const TEXT_CODEC_REGEXPS_: RegExp[] = [/^vtt$/, /^wvtt/, /^stpp/];

export const CODEC_REGEXPS_BY_CONTENT_TYPE_: {[key: string]: RegExp[]} = {
  'audio': AUDIO_CODEC_REGEXPS_,
  'video': VIDEO_CODEC_REGEXPS_,
  'text': TEXT_CODEC_REGEXPS_
};
