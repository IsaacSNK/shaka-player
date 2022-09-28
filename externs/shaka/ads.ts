/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  skipped
 *   The number of ads skipped.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface AdsStats {
    loadTimes: number[];
    started: number;
    playedCompletely: number;
    skipped: number;
  }
}
/**
 *  end
 *   The end time of the range, in milliseconds.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface AdCuePoint {
    start: number;
    end: number | null;
  }
}
declare namespace shaka.extern {
  class IAdManager extends EventTarget {
    setLocale(locale: string);

    release();

    onAssetUnload();

    initClientSide(adContainer: HTMLElement, video: HTMLMediaElement);

    requestClientSideAds(imaRequest: google.ima.AdsRequest);

    initServerSide(adContainer: HTMLElement, video: HTMLMediaElement);

    requestServerSideStream(
      imaRequest: google.ima.dai.api.StreamRequest,
      backupUrl?: string
    ): Promise<string>;

    replaceServerSideAdTagParameters(adTagParameters: Object);

    getServerSideCuePoints(): shaka.extern.AdCuePoint[];

    /**
     * Get statistics for the current playback session. If the player is not
     * playing content, this will return an empty stats object.
     */
    getStats();

    onDashTimedMetadata(region: shaka.extern.TimelineRegionInfo);

    onHlsTimedMetadata(
      metadata: shaka.extern.ID3Metadata,
      timestampOffset: number
    );

    onCueMetadataChange(value: shaka.extern.ID3Metadata);
  }
}

/**
 * A factory for creating the ad manager.
 *
 * @exportDoc
 */
declare namespace shaka.extern.IAdManager {
  type Factory = () => shaka.extern.IAdManager;
}
declare namespace shaka.extern {
  class IAd {
    getDuration(): number;

    /**
     * Gets the minimum suggested duration.  Defaults to being equivalent to
     * getDuration() for server-side ads.
     * @see http://bit.ly/3q3U6hI
     */
    getMinSuggestedDuration(): number;

    getRemainingTime(): number;

    getTimeUntilSkippable(): number;

    isPaused(): boolean;

    isSkippable(): boolean;

    canSkipNow(): boolean;

    skip();

    play();

    pause();

    getVolume(): number;

    setVolume(volume: number);

    isMuted(): boolean;

    setMuted(muted: boolean);

    isLinear(): boolean;

    resize(width: number, height: number);

    getSequenceLength(): number;

    getPositionInSequence(): number;
  }
}
