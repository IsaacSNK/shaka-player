/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /**
   * @summary
   * A CmcdManager maintains CMCD state as well as a collection of utility
   * functions.
   */
  export class CmcdManager {
    private playerInterface_: shaka.util.CmcdManager.PlayerInterface;
    private config_: shaka.extern.CmcdConfiguration | null;

    /**
     * Session ID
     *
     */
    private sid_: string = "";

    /**
     * Streaming format
     *
     */
    private sf_: shaka.util.CmcdManager.StreamingFormat | undefined = undefined;
    private playbackStarted_: boolean = false;
    private buffering_: boolean = true;
    private starved_: boolean = false;

    constructor(
      playerInterface: shaka.util.CmcdManager.PlayerInterface,
      config: shaka.extern.CmcdConfiguration
    ) {
      this.playerInterface_ = playerInterface;
      this.config_ = config;
    }

    /**
     * Set the buffering state
     *
     */
    setBuffering(buffering: boolean) {
      if (!buffering && !this.playbackStarted_) {
        this.playbackStarted_ = true;
      }
      if (this.playbackStarted_ && buffering) {
        this.starved_ = true;
      }
      this.buffering_ = buffering;
    }

    /**
     * Apply CMCD data to a manifest request.
     *
     *   The request to apply CMCD data to
     *   The manifest format
     */
    applyManifestData(
      request: shaka.extern.Request,
      manifestInfo: shaka.util.CmcdManager.ManifestInfo
    ) {
      try {
        //@ts-ignore
        if (!this.config_.enabled) {
          return;
        }
        this.sf_ = manifestInfo.format;
        //@ts-ignore
        this.apply_(request, {
          ot: shaka.util.CmcdManager.ObjectType.MANIFEST,
          su: !this.playbackStarted_,
        });
      } catch (error) {
        shaka.log.warnOnce(
          "CMCD_MANIFEST_ERROR",
          "Could not generate manifest CMCD data.",
          error
        );
      }
    }

    /**
     * Apply CMCD data to a segment request
     *
     */
    applySegmentData(
      request: shaka.extern.Request,
      segmentInfo: shaka.util.CmcdManager.SegmentInfo
    ) {
      try {
        //@ts-ignore
        if (!this.config_.enabled) {
          return;
        }
        const data = {
          d: segmentInfo.duration * 1000,
          st: this.getStreamType_(),
        };
        //@ts-ignore
        data.ot = this.getObjectType_(segmentInfo);
        const ObjectType = shaka.util.CmcdManager.ObjectType;
        const isMedia =
          //@ts-ignore
          data.ot === ObjectType.VIDEO ||
          //@ts-ignore
          data.ot === ObjectType.AUDIO ||
          //@ts-ignore
          data.ot === ObjectType.MUXED ||
          //@ts-ignore
          data.ot === ObjectType.TIMED_TEXT;
        if (isMedia) {
          //@ts-ignore
          data.bl = this.getBufferLength_(segmentInfo.type);
        }
        if (segmentInfo.bandwidth) {
          //@ts-ignore
          data.br = segmentInfo.bandwidth / 1000;
        }
        //@ts-ignore
        if (isMedia && data.ot !== ObjectType.TIMED_TEXT) {
          //@ts-ignore
          data.tb = this.getTopBandwidth_(data.ot) / 1000;
        }
        //@ts-ignore
        this.apply_(request, data);
      } catch (error) {
        shaka.log.warnOnce(
          "CMCD_SEGMENT_ERROR",
          "Could not generate segment CMCD data.",
          error
        );
      }
    }

    /**
     * Apply CMCD data to a text request
     *
     */
    applyTextData(request: shaka.extern.Request) {
      try {
        //@ts-ignore
        if (!this.config_.enabled) {
          return;
        }
        //@ts-ignore
        this.apply_(request, {
          ot: shaka.util.CmcdManager.ObjectType.CAPTION,
          su: true,
        });
      } catch (error) {
        shaka.log.warnOnce(
          "CMCD_TEXT_ERROR",
          "Could not generate text CMCD data.",
          error
        );
      }
    }

    /**
     * Apply CMCD data to streams loaded via src=.
     *
     */
    appendSrcData(uri: string, mimeType: string): string {
      try {
        //@ts-ignore
        if (!this.config_.enabled) {
          return uri;
        }
        const data = this.createData_();
        data.ot = this.getObjectTypeFromMimeType_(mimeType);
        data.su = true;
        const query = shaka.util.CmcdManager.toQuery(data);
        return shaka.util.CmcdManager.appendQueryToUri(uri, query);
      } catch (error) {
        shaka.log.warnOnce(
          "CMCD_SRC_ERROR",
          "Could not generate src CMCD data.",
          error
        );
        return uri;
      }
    }

    /**
     * Apply CMCD data to side car text track uri.
     *
     */
    appendTextTrackData(uri: string): string {
      try {
        //@ts-ignore
        if (!this.config_.enabled) {
          return uri;
        }
        const data = this.createData_();
        data.ot = shaka.util.CmcdManager.ObjectType.CAPTION;
        data.su = true;
        const query = shaka.util.CmcdManager.toQuery(data);
        return shaka.util.CmcdManager.appendQueryToUri(uri, query);
      } catch (error) {
        shaka.log.warnOnce(
          "CMCD_TEXT_TRACK_ERROR",
          "Could not generate text track CMCD data.",
          error
        );
        return uri;
      }
    }

    /**
     * Create baseline CMCD data
     *
     */
    private createData_(): CmcdData {
      if (!this.sid_) {
        //@ts-ignore
        this.sid_ = this.config_.sessionId || window.crypto.randomUUID();
      }
      //@ts-ignore
      return {
        v: shaka.util.CmcdManager.Version,
        sf: this.sf_,
        sid: this.sid_,
        //@ts-ignore
        cid: this.config_.contentId,
        mtp: this.playerInterface_.getBandwidthEstimate() / 1000,
      };
    }

    /**
     * Apply CMCD data to a request.
     *
     * @param request The request to apply CMCD data to
     * @param data The data object
     * @param useHeaders Send data via request headers
     */
    private apply_(
      request: shaka.extern.Request,
      //@ts-ignore
      data: CmcdData = {},
      //@ts-ignore
      useHeaders: boolean = this.config_.useHeaders
    ) {
      //@ts-ignore
      if (!this.config_.enabled) {
        return;
      }

      // apply baseline data
      Object.assign(data, this.createData_());
      data.pr = this.playerInterface_.getPlaybackRate();
      const isVideo =
        data.ot === shaka.util.CmcdManager.ObjectType.VIDEO ||
        data.ot === shaka.util.CmcdManager.ObjectType.MUXED;
      if (this.starved_ && isVideo) {
        data.bs = true;
        data.su = true;
        this.starved_ = false;
      }
      if (data.su == null) {
        data.su = this.buffering_;
      }

      // TODO: Implement rtp, nrr, nor, dl
      if (useHeaders) {
        const headers = shaka.util.CmcdManager.toHeaders(data);
        if (!Object.keys(headers).length) {
          return;
        }
        Object.assign(request.headers, headers);
      } else {
        const query = shaka.util.CmcdManager.toQuery(data);
        if (!query) {
          return;
        }
        request.uris = request.uris.map((uri) => {
          return shaka.util.CmcdManager.appendQueryToUri(uri, query);
        });
      }
    }

    /**
     * The CMCD object type.
     *
     */
    private getObjectType_(segmentInfo: shaka.util.CmcdManager.SegmentInfo) {
      const type = segmentInfo.type;
      if (segmentInfo.init) {
        return shaka.util.CmcdManager.ObjectType.INIT;
      }
      if (type == "video") {
        if (segmentInfo.codecs.includes(",")) {
          return shaka.util.CmcdManager.ObjectType.MUXED;
        }
        return shaka.util.CmcdManager.ObjectType.VIDEO;
      }
      if (type == "audio") {
        return shaka.util.CmcdManager.ObjectType.AUDIO;
      }
      if (type == "text") {
        if (segmentInfo.mimeType === "application/mp4") {
          return shaka.util.CmcdManager.ObjectType.TIMED_TEXT;
        }
        return shaka.util.CmcdManager.ObjectType.CAPTION;
      }
      return undefined;
    }

    /**
     * The CMCD object type from mimeType.
     *
     */
    private getObjectTypeFromMimeType_(
      mimeType: string
    ): shaka.util.CmcdManager.ObjectType | undefined {
      switch (mimeType) {
        case "video/webm":
        case "video/mp4":
          return shaka.util.CmcdManager.ObjectType.MUXED;
        case "application/x-mpegurl":
          return shaka.util.CmcdManager.ObjectType.MANIFEST;
        default:
          return undefined;
      }
    }

    /**
     * Get the buffer length for a media type in milliseconds
     *
     */
    private getBufferLength_(type: string): number {
      const ranges = this.playerInterface_.getBufferedInfo()[type];
      if (!ranges.length) {
        return NaN;
      }
      const start = this.playerInterface_.getCurrentTime();
      const range = ranges.find((r) => r.start <= start && r.end >= start);
      if (!range) {
        return NaN;
      }
      return (range.end - start) * 1000;
    }

    /**
     * Get the stream type
     *
     */
    private getStreamType_(): shaka.util.CmcdManager.StreamType {
      const isLive = this.playerInterface_.isLive();
      if (isLive) {
        return shaka.util.CmcdManager.StreamType.LIVE;
      } else {
        return shaka.util.CmcdManager.StreamType.VOD;
      }
    }

    /**
     * Get the highest bandwidth for a given type.
     *
     */
    private getTopBandwidth_(type: string): number {
      const variants = this.playerInterface_.getVariantTracks();
      if (!variants.length) {
        return NaN;
      }
      let top = variants[0];
      for (const variant of variants) {
        if (variant.type === "variant" && variant.bandwidth > top.bandwidth) {
          top = variant;
        }
      }
      const ObjectType = shaka.util.CmcdManager.ObjectType;
      switch (type) {
        case ObjectType.VIDEO:
          return top.videoBandwidth || NaN;
        case ObjectType.AUDIO:
          return top.audioBandwidth || NaN;
        default:
          return top.bandwidth;
      }
    }

    /**
     * Serialize a CMCD data object according to the rules defined in the
     * section 3.2 of
     * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
     *
     * @param data The CMCD data object
     */
    static serialize(data: CmcdData): string {
      const results = [];
      const isValid = (value) =>
        !Number.isNaN(value) &&
        value != null &&
        value !== "" &&
        value !== false;
      const toRounded = (value) => Math.round(value);
      const toHundred = (value) => toRounded(value / 100) * 100;
      const toUrlSafe = (value) => encodeURIComponent(value);
      const formatters = {
        br: toRounded,
        d: toRounded,
        bl: toHundred,
        dl: toHundred,
        mtp: toHundred,
        nor: toUrlSafe,
        rtp: toHundred,
        tb: toRounded,
      };
      const keys = Object.keys(data || {}).sort();
      for (const key of keys) {
        let value = data[key];

        // ignore invalid values
        if (!isValid(value)) {
          continue;
        }

        // Version should only be reported if not equal to 1.
        if (key === "v" && value === 1) {
          continue;
        }

        // Playback rate should only be sent if not equal to 1.
        if (key == "pr" && value === 1) {
          continue;
        }

        // Certain values require special formatting
        const formatter = formatters[key];
        if (formatter) {
          value = formatter(value);
        }

        // Serialize the key/value pair
        const type = typeof value;
        let result;
        if (type === "string" && key !== "ot" && key !== "sf" && key !== "st") {
          result = `${key}=${JSON.stringify(value)}`;
        } else {
          if (type === "boolean") {
            result = key;
          } else {
            if (type === "symbol") {
              result = `${key}=${value.description}`;
            } else {
              result = `${key}=${value}`;
            }
          }
        }
        //@ts-ignore
        results.push(result);
      }
      return results.join(",");
    }

    /**
     * Convert a CMCD data object to request headers according to the rules
     * defined in the section 2.1 and 3.2 of
     * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
     *
     * @param data The CMCD data object
     */
    static toHeaders(data: CmcdData): Object {
      const keys = Object.keys(data);
      const headers = {};
      const headerNames = ["Object", "Request", "Session", "Status"];
      const headerGroups = [{}, {}, {}, {}];
      const headerMap = {
        br: 0,
        d: 0,
        ot: 0,
        tb: 0,
        bl: 1,
        dl: 1,
        mtp: 1,
        nor: 1,
        nrr: 1,
        su: 1,
        cid: 2,
        pr: 2,
        sf: 2,
        sid: 2,
        st: 2,
        v: 2,
        bs: 3,
        rtp: 3,
      };
      for (const key of keys) {
        // Unmapped fields are mapped to the Request header
        const index = headerMap[key] != null ? headerMap[key] : 1;
        headerGroups[index][key] = data[key];
      }
      for (let i = 0; i < headerGroups.length; i++) {
        //@ts-ignore
        const value = shaka.util.CmcdManager.serialize(headerGroups[i]);
        if (value) {
          headers[`CMCD-${headerNames[i]}`] = value;
        }
      }
      return headers;
    }

    /**
     * Convert a CMCD data object to query args according to the rules
     * defined in the section 2.2 and 3.2 of
     * [CTA-5004](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf).
     *
     * @param data The CMCD data object
     */
    static toQuery(data: CmcdData): string {
      return shaka.util.CmcdManager.serialize(data);
    }

    /**
     * Append query args to a uri.
     *
     */
    static appendQueryToUri(uri: string, query: string): string {
      if (!query) {
        return uri;
      }
      if (uri.includes("offline:")) {
        return uri;
      }
      const url = new goog.Uri(uri);
      url.getQueryData().set("CMCD", query);
      return url.toString();
    }
  }
}

namespace shaka.util.CmcdManager {
  export interface PlayerInterface {
    getBandwidthEstimate: () => number;
    getBufferedInfo: () => shaka.extern.BufferedInfo;
    getCurrentTime: () => number;
    getVariantTracks: () => shaka.extern.Track[];
    getPlaybackRate: () => number;
    isLive: () => boolean;
  }

  export interface SegmentInfo {
    type: string;
    init: boolean;
    duration: number;
    mimeType: string;
    codecs: string;
    bandwidth: number | undefined;
  }

  export interface ManifestInfo {
    format: StreamingFormat;
  }

  export enum ObjectType {
    MANIFEST = "m",
    AUDIO = "a",
    VIDEO = "v",
    MUXED = "av",
    INIT = "i",
    CAPTION = "c",
    TIMED_TEXT = "tt",
    KEY = "k",
    OTHER = "o",
  }

  export enum StreamType {
    VOD = "v",
    LIVE = "l",
  }

  export enum StreamingFormat {
    DASH = "d",
    HLS = "h",
    SMOOTH = "s",
    OTHER = "o",
  }

  export const Version: number = 1;
}
