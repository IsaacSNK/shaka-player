/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
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
      const Functional = shaka.util.Functional;
      if (relativeUris.length == 0) {
        return baseUris;
      }
      const relativeAsGoog = relativeUris.map((uri) => new goog.Uri(uri));

      // Resolve each URI relative to each base URI, creating an Array of Arrays.
      // Then flatten the Arrays into a single Array.
      return baseUris
        .map((uri) => new goog.Uri(uri))
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
      initData: shaka.extern.InitDataOverride[]
    ): shaka.extern.DrmInfo {
      return {
        keySystem: keySystem,
        licenseServerUri: "",
        distinctiveIdentifierRequired: false,
        persistentStateRequired: false,
        audioRobustness: "",
        videoRobustness: "",
        //@ts-ignore
        serverCertificate: null,
        serverCertificateUri: "",
        sessionType: "",
        initData: initData || [],
        keyIds: new Set(),
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
      const match = shaka.util.ManifestParserUtils.guessCodecsSafe(
        contentType,
        codecs
      );

      // A failure is specifically denoted by null; an empty string represents a
      // valid match of no codec.
      if (match != null) {
        return match;
      }

      // Unable to guess codecs.
      throw new shaka.util.Error(
        shaka.util.Error.Severity.CRITICAL,
        shaka.util.Error.Category.MANIFEST,
        shaka.util.Error.Code.HLS_COULD_NOT_GUESS_CODECS,
        codecs
      );
    }

    /**
     * Attempts to guess which codecs from the codecs list belong to a given
     * content type. Does not assume a single codec is anything special, and does
     * not throw if it fails to match.
     *
     * @return or null if no match is found
     */
    static guessCodecsSafe(
      contentType: string,
      codecs: string[]
    ): string | null {
      const formats =
        shaka.util.ManifestParserUtils.CODEC_REGEXPS_BY_CONTENT_TYPE_[
          contentType
        ];
      for (const format of formats) {
        for (const codec of codecs) {
          if (format.test(codec.trim())) {
            return codec.trim();
          }
        }
      }

      // Text does not require a codec string.
      if (contentType == shaka.util.ManifestParserUtils.ContentType.TEXT) {
        return "";
      }
      return null;
    }
  }
}

namespace shaka.util.ManifestParserUtils {
  export enum ContentType {
    VIDEO = "video",
    AUDIO = "audio",
    TEXT = "text",
    IMAGE = "image",
    APPLICATION = "application",
  }
}

namespace shaka.util.ManifestParserUtils {
  export enum TextStreamKind {
    SUBTITLE = "subtitle",
    CLOSED_CAPTION = "caption",
  }
}

namespace shaka.util.ManifestParserUtils {
  /**
   * Specifies how tolerant the player is of inaccurate segment start times and
   * end times within a manifest. For example, gaps or overlaps between segments
   * in a SegmentTimeline which are greater than or equal to this value will
   * result in a warning message.
   *
   */
  export const GAP_OVERLAP_TOLERANCE_SECONDS: number = 1 / 15;
}

namespace shaka.util.ManifestParserUtils {
  /**
   * A list of regexps to detect well-known video codecs.
   *
   */
  export const VIDEO_CODEC_REGEXPS_: RegExp[] = [
    /^avc/,
    /^hev/,
    /^hvc/,
    /^vp0?[89]/,
    /^av01/,
  ];
}

namespace shaka.util.ManifestParserUtils {
  /**
   * A list of regexps to detect well-known audio codecs.
   *
   */
  export const AUDIO_CODEC_REGEXPS_: RegExp[] = [
    /^vorbis$/,
    /^opus$/,
    /^flac$/,
    /^mp4a/,
    /^[ae]c-3$/,
  ];
}

namespace shaka.util.ManifestParserUtils {
  /**
   * A list of regexps to detect well-known text codecs.
   *
   */
  export const TEXT_CODEC_REGEXPS_: RegExp[] = [/^vtt$/, /^wvtt/, /^stpp/];
}

namespace shaka.util.ManifestParserUtils {
  export const CODEC_REGEXPS_BY_CONTENT_TYPE_: { [key: string]: RegExp[] } = {
    audio: shaka.util.ManifestParserUtils.AUDIO_CODEC_REGEXPS_,
    video: shaka.util.ManifestParserUtils.VIDEO_CODEC_REGEXPS_,
    text: shaka.util.ManifestParserUtils.TEXT_CODEC_REGEXPS_,
  };
}
