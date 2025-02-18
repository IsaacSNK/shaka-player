/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary A set of utility functions for dealing with MIME types.
   * @export
   */
  export class MimeUtils {
    /**
     * Takes a MIME type and optional codecs string and produces the full MIME
     * type.
     *
     * @export
     */
    static getFullType(mimeType: string, codecs?: string): string {
      let fullMimeType = mimeType;
      if (codecs) {
        fullMimeType += '; codecs="' + codecs + '"';
      }
      return fullMimeType;
    }

    /**
     * Takes a MIME type and a codecs string and produces the full MIME
     * type. If it's a transport stream, convert its codecs to MP4 codecs.
     * Otherwise for multiplexed content, convert the video MIME types to
     * their audio equivalents if the content type is audio.
     *
     */
    static getFullOrConvertedType(
      mimeType: string,
      codecs: string,
      contentType: string
    ): string {
      const fullMimeType = shaka.util.MimeUtils.getFullType(mimeType, codecs);
      const ContentType = shaka.util.ManifestParserUtils.ContentType;
      if (shaka.media.Transmuxer.isTsContainer(fullMimeType)) {
        if (shaka.dependencies.muxjs()) {
          return shaka.media.Transmuxer.convertTsCodecs(
            contentType,
            fullMimeType
          );
        }
      } else {
        if (contentType == ContentType.AUDIO) {
          // video/mp2t is the correct mime type for TS audio, so only replace the
          // word "video" with "audio" for non-TS audio content.
          return fullMimeType.replace("video", "audio");
        }
      }
      return fullMimeType;
    }

    /**
     * Takes a Stream object and produces an extended MIME type with information
     * beyond the container and codec type, when available.
     *
     */
    static getExtendedType(stream: shaka.extern.Stream): string {
      const components = [stream.mimeType];
      const extendedMimeParams = shaka.util.MimeUtils.EXTENDED_MIME_PARAMETERS_;
      extendedMimeParams.forEach((mimeKey, streamKey) => {
        const value = stream[streamKey];
        if (value) {
          components.push(mimeKey + '="' + value + '"');
        }
      });
      if (stream.hdr == "PQ") {
        components.push('eotf="smpte2084"');
      }
      return components.join(";");
    }

    /**
     * Takes a full MIME type (with codecs) or basic MIME type (without codecs)
     * and returns a container type string ("mp2t", "mp4", "webm", etc.)
     *
     */
    static getContainerType(mimeType: string): string {
      return mimeType.split(";")[0].split("/")[1];
    }

    /**
     * Split a list of codecs encoded in a string into a list of codecs.
     */
    static splitCodecs(codecs: string): string[] {
      return codecs.split(",");
    }

    /**
     * Get the normalized codec from a codec string,
     * independently of their container.
     *
     */
    static getNormalizedCodec(codecString: string): string {
      const parts = shaka.util.MimeUtils.getCodecParts_(codecString);
      const base = parts[0];
      const profile = parts[1].toLowerCase();
      switch (true) {
        case base === "mp4a" && profile === "69":
        case base === "mp4a" && profile === "6b":
          return "mp3";
        case base === "mp4a" && profile === "66":
        case base === "mp4a" && profile === "67":
        case base === "mp4a" && profile === "68":
        case base === "mp4a" && profile === "40.2":
        case base === "mp4a" && profile === "40.02":
        case base === "mp4a" && profile === "40.5":
        case base === "mp4a" && profile === "40.05":
        case base === "mp4a" && profile === "40.29":
        case base === "mp4a" && profile === "40.42":
          // Extended HE-AAC
          return "aac";
        case base === "mp4a" && profile === "a5":
          return "ac-3";

        // Dolby Digital
        case base === "mp4a" && profile === "a6":
          return "ec-3";

        // Dolby Digital Plus
        case base === "mp4a" && profile === "b2":
          return "dtsx";

        // DTS:X
        case base === "mp4a" && profile === "a9":
          return "dtsc";

        // DTS Digital Surround
        case base === "avc1":
        case base === "avc3":
          return "avc";

        // H264
        case base === "hvc1":
        case base === "hev1":
          return "hevc";

        // H265
        case base === "dvh1":
        case base === "dvhe":
          return "dovi";
      }

      // Dolby Vision
      return base;
    }

    /**
     * Get the base codec from a codec string.
     *
     */
    static getCodecBase(codecString: string): string {
      const parts = shaka.util.MimeUtils.getCodecParts_(codecString);
      return parts[0];
    }

    /**
     * Takes a full MIME type (with codecs) or basic MIME type (without codecs)
     * and returns a basic MIME type (without codecs or other parameters).
     *
     */
    static getBasicType(mimeType: string): string {
      return mimeType.split(";")[0];
    }

    /**
     * Takes a MIME type and returns the codecs parameter, or an empty string if
     * there is no codecs parameter.
     *
     */
    static getCodecs(mimeType: string): string {
      // Parse the basic MIME type from its parameters.
      const pieces = mimeType.split(/ *; */);

      // Remove basic MIME type from pieces.
      pieces.shift();
      const codecs = pieces.find((piece) => piece.startsWith("codecs="));
      if (!codecs) {
        return "";
      }

      // The value may be quoted, so remove quotes at the beginning or end.
      const value = codecs.split("=")[1].replace(/^"|"$/g, "");
      return value;
    }

    /**
     * Get the base and profile of a codec string. Where [0] will be the codec
     * base and [1] will be the profile.
     */
    private static getCodecParts_(codecString: string): string[] {
      const parts = codecString.split(".");
      const base = parts[0];
      parts.shift();
      const profile = parts.join(".");

      // Make sure that we always return a "base" and "profile".
      return [base, profile];
    }
  }
}

namespace shaka.util.MimeUtils {
  /**
   * A map from Stream object keys to MIME type parameters.  These should be
   * ignored by platforms that do not recognize them.
   *
   * This initial set of parameters are all recognized by Chromecast.
   *
   */
  export const EXTENDED_MIME_PARAMETERS_: Map<string, string> = new Map()
    .set("codecs", "codecs")
    .set(
      "frameRate",
      // Ours is camelCase, theirs is lowercase.
      "framerate"
    )
    .set(
      "bandwidth",
      // They are in the same units: bits/sec.
      "bitrate"
    )
    .set("width", "width")
    .set("height", "height")
    .set("channelsCount", "channels");
}

namespace shaka.util.MimeUtils {
  /**
   * A mimetype created for CEA-608 closed captions.
   */
  export const CEA608_CLOSED_CAPTION_MIMETYPE: string = "application/cea-608";
}

namespace shaka.util.MimeUtils {
  /**
   * A mimetype created for CEA-708 closed captions.
   */
  export const CEA708_CLOSED_CAPTION_MIMETYPE: string = "application/cea-708";
}
