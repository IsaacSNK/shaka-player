/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.media.SegmentReference");

namespace shaka.offline {
  /**
   * A utility class to help estimate the size of streams based on stream and
   * variant bandwidths. This class's main purpose is to isolate the logic in
   * creating non-zero bandwidth estimates for all streams so that each stream
   * will have some influence over the progress of the download.
   */
  export class StreamBandwidthEstimator {
    private estimateByStreamId_: { [key: number]: number } = {};

    /**
     * Add a new variant to the estimator. This will update the estimates for all
     * streams in the variant.
     *
     */
    addVariant(variant: shaka.extern.Variant) {
      // Three cases:
      //  1 - Only Audio
      //  2 - Only Video
      //  3 - Audio and Video
      const audio = variant.audio;
      const video = variant.video;

      // Case 1
      if (audio && !video) {
        const audioBitRate = audio.bandwidth || variant.bandwidth;
        this.setBitrate_(audio.id, audioBitRate);
      }

      // Case 2
      if (!audio && video) {
        const videoBitRate = video.bandwidth || variant.bandwidth;
        this.setBitrate_(video.id, videoBitRate);
      }

      // Case 3
      if (audio && video) {
        // Get the audio's bandwidth. If it is missing, default to our default
        // audio bandwidth.
        const audioBitRate =
          audio.bandwidth ||
          shaka.offline.StreamBandwidthEstimator.DEFAULT_AUDIO_BITRATE_;

        // Get the video's bandwidth. If it is missing, use the variant bandwidth
        // less the audio. If we get a negative bit rate, fall back to our
        // default video bandwidth.
        let videoBitRate = video.bandwidth || variant.bandwidth - audioBitRate;
        if (videoBitRate <= 0) {
          shaka.log.warning(
            "Audio bit rate consumes variants bandwidth. Setting video " +
              "bandwidth to match variant's bandwidth."
          );
          videoBitRate = variant.bandwidth;
        }
        this.setBitrate_(audio.id, audioBitRate);
        this.setBitrate_(video.id, videoBitRate);
      }
    }

    private setBitrate_(stream: number, bitRate: number) {
      this.estimateByStreamId_[stream] = bitRate;
    }

    /**
     * Create an estimate for the text stream.
     *
     */
    addText(text: shaka.extern.Stream) {
      this.estimateByStreamId_[text.id] =
        shaka.offline.StreamBandwidthEstimator.DEFAULT_TEXT_BITRATE_;
    }

    /**
     * Create an estimate for the image stream.
     *
     */
    addImage(image: shaka.extern.Stream) {
      this.estimateByStreamId_[image.id] =
        image.bandwidth ||
        shaka.offline.StreamBandwidthEstimator.DEFAULT_IMAGE_BITRATE_;
    }

    /**
     * Get the estimate for a segment that is part of a stream that has already
     * added to the estimator.
     *
     */
    getSegmentEstimate(id: number, segment: SegmentReference): number {
      const duration = segment.endTime - segment.startTime;
      return this.getEstimate_(id) * duration;
    }

    /**
     * Get the estimate for an init segment for a stream that has already
     * added to the estimator.
     *
     */
    getInitSegmentEstimate(id: number): number {
      // Assume that the init segment is worth approximately half a second of
      // content.
      const duration = 0.5;
      return this.getEstimate_(id) * duration;
    }

    private getEstimate_(id: number): number {
      let bitRate = this.estimateByStreamId_[id];
      if (bitRate == null) {
        bitRate = 0;
        shaka.log.error(
          "Asking for bitrate of stream not given to the estimator"
        );
      }
      if (bitRate == 0) {
        shaka.log.warning(
          "Using bitrate of 0, this stream won't affect progress"
        );
      }
      return bitRate;
    }
  }
}

namespace shaka.offline.StreamBandwidthEstimator {
  /**
   * Since audio bandwidth does not vary much, we are going to use a constant
   * approximation for audio bit rate allowing use to more accurately guess at
   * the video bitrate.
   *
   * YouTube's suggested bitrate for stereo audio is 384 kbps so we are going to
   * assume that: https://support.google.com/youtube/answer/1722171?hl=en
   *
   */
  export const DEFAULT_AUDIO_BITRATE_: number = 393216;
}

namespace shaka.offline.StreamBandwidthEstimator {
  /**
   * Since we don't normally get the bitrate for text, we still want to create
   * some approximation so that it can influence progress. This will use the
   * bitrate from "Tears of Steal" to give some kind of data-driven result.
   *
   * The file size for English subtitles is 4.7 KB. The video is 12:14 long,
   * which means that the text's bit rate is around 52 bps.
   *
   */
  export const DEFAULT_TEXT_BITRATE_: number = 52;
}

namespace shaka.offline.StreamBandwidthEstimator {
  /**
   * Since we don't normally get the bitrate for image, we still want to create
   * some approximation so that it can influence progress.
   *
   * The size of the thumbnail usually is 2KB.
   *
   */
  export const DEFAULT_IMAGE_BITRATE_: number = 2048;
}
