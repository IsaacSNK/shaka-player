/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
declare namespace shaka.extern {
  export class AbrManager {
    /**
     * Initializes the AbrManager.
     *
     * @exportDoc
     */
    init(switchCallback: shaka.extern.AbrManager.SwitchCallback);

    /**
     * Stops any background timers and frees any objects held by this instance.
     * This will only be called after a call to init.
     *
     * @exportDoc
     */
    stop();

    /**
     * Updates manager's variants collection.
     *
     * @exportDoc
     */
    setVariants(variants: shaka.extern.Variant[]);

    /**
     * Chooses one variant to switch to.  Called by the Player.
     * @exportDoc
     */
    chooseVariant(): shaka.extern.Variant;

    /**
     * Enables automatic Variant choices from the last ones passed to setVariants.
     * After this, the AbrManager may call switchCallback() at any time.
     *
     * @exportDoc
     */
    enable();

    /**
     * Disables automatic Stream suggestions. After this, the AbrManager may not
     * call switchCallback().
     *
     * @exportDoc
     */
    disable();

    /**
     * Notifies the AbrManager that a segment has been downloaded (includes MP4
     * SIDX data, WebM Cues data, initialization segments, and media segments).
     *
     * @param deltaTimeMs The duration, in milliseconds, that the request
     *     took to complete.
     * @param numBytes The total number of bytes transferred.
     * @exportDoc
     */
    segmentDownloaded(deltaTimeMs: number, numBytes: number);

    /**
     * Gets an estimate of the current bandwidth in bit/sec.  This is used by the
     * Player to generate stats.
     *
     * @exportDoc
     */
    getBandwidthEstimate(): number;

    /**
     * Updates manager playback rate.
     *
     * @exportDoc
     */
    playbackRateChanged(rate: number);

    /**
     * Set media element.
     *
     * @exportDoc
     */
    setMediaElement(mediaElement: HTMLMediaElement);

    /**
     * Sets the ABR configuration.
     *
     * It is the responsibility of the AbrManager implementation to implement the
     * restrictions behavior described in shaka.extern.AbrConfiguration.
     *
     * @exportDoc
     */
    configure(config: shaka.extern.AbrConfiguration);
  }
}

/**
 * A callback into the Player that should be called when the AbrManager decides
 * it's time to change to a different variant.
 *
 * The first argument is a variant to switch to.
 *
 * The second argument is an optional boolean. If true, all data will be removed
 * from the buffer, which will result in a buffering event. Unless a third
 * argument is passed.
 *
 * The third argument in an optional number that specifies how much data (in
 * seconds) should be retained when clearing the buffer. This can help achieve
 * a fast switch that doesn't involve a buffering event. A minimum of two video
 * segments should always be kept buffered to avoid temporary hiccups.
 *
 * @exportDoc
 */
declare namespace shaka.extern.AbrManager {
  type SwitchCallback = (
    p1: shaka.extern.Variant,
    p2?: boolean,
    p3?: number
  ) => any;
}
/**
 * A factory for creating the abr manager.
 *
 * @exportDoc
 */
declare namespace shaka.extern.AbrManager {
  type Factory = () => shaka.extern.AbrManager;
}
