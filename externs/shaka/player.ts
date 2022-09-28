/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  bandwidth
 *   The bandwidth of the chosen track (<code>null</code> for text).
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface TrackChoice {
    timestamp: number;
    id: number;
    type: string;
    fromAdaptation: boolean;
    bandwidth: number | null;
  }
}
/**
 *  duration
 *   The number of seconds the player was in this state.  If this is the last
 *   entry in the list, the player is still in this state, so the duration will
 *   continue to increase.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface StateChange {
    timestamp: number;
    state: string;
    duration: number;
  }
}
/**
 *  stateHistory
 *   A history of the state changes.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Stats {
    width: number;
    height: number;
    streamBandwidth: number;
    decodedFrames: number;
    droppedFrames: number;
    corruptedFrames: number;
    estimatedBandwidth: number;
    completionPercent: number;
    loadLatency: number;
    manifestTimeSeconds: number;
    drmTimeSeconds: number;
    playTime: number;
    pauseTime: number;
    bufferingTime: number;
    licenseTime: number;
    liveLatency: number;
    maxSegmentDuration: number;
    gapsJumped: number;
    stallsDetected: number;
    switchHistory: shaka.extern.TrackChoice[];
    stateHistory: shaka.extern.StateChange[];
  }
}
/**
 *  end
 *   The end time of the range, in seconds.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface BufferedRange {
    start: number;
    end: number;
  }
}
/**
 *  text
 *   The buffered ranges for text content.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface BufferedInfo {
    total: shaka.extern.BufferedRange[];
    audio: shaka.extern.BufferedRange[];
    video: shaka.extern.BufferedRange[];
    text: shaka.extern.BufferedRange[];
  }
}
/**
 *  originalImageId
 *   (image tracks only) The original ID of the image track, if any, as it
 *   appeared in the original manifest.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Track {
    id: number;
    active: boolean;
    type: string;
    bandwidth: number;
    language: string;
    label: string | null;
    kind: string | null;
    width: number | null;
    height: number | null;
    frameRate: number | null;
    pixelAspectRatio: string | null;
    hdr: string | null;
    mimeType: string | null;
    audioMimeType: string | null;
    videoMimeType: string | null;
    codecs: string | null;
    audioCodec: string | null;
    videoCodec: string | null;
    primary: boolean;
    roles: string[];
    audioRoles: string[];
    forced: boolean;
    videoId: number | null;
    audioId: number | null;
    channelsCount: number | null;
    audioSamplingRate: number | null;
    tilesLayout: string | null;
    audioBandwidth: number | null;
    videoBandwidth: number | null;
    spatialAudio: boolean;
    originalVideoId: string | null;
    originalAudioId: string | null;
    originalTextId: string | null;
    originalImageId: string | null;
  }
}
declare namespace shaka.extern {
  type TrackList = shaka.extern.Track[];
}
/**
 *  maxBandwidth
 *   The maximum bandwidth of a variant track, in bit/sec.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Restrictions {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    minPixels: number;
    maxPixels: number;
    minFrameRate: number;
    maxFrameRate: number;
    minBandwidth: number;
    maxBandwidth: number;
  }
}
/**
 *  persistentState
 *   Whether this key system supports persistent state.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface DrmSupportType {
    persistentState: boolean;
  }
}
/**
 *  drm
 *   A map of supported key systems.
 *   The keys are the key system names.  The value is <code>null</code> if it is
 *   not supported.  Key systems not probed will not be in this dictionary.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface SupportType {
    manifest: { [key: string]: boolean };
    media: { [key: string]: boolean };
    drm: { [key: string]: shaka.extern.DrmSupportType | null };
  }
}
/**
 *
 * @description
 * ID3 metadata in format defined by
 * https://id3.org/id3v2.3.0#Declared_ID3v2_frames
 * The content of the field.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  type ID3Metadata = { [key: string]: any };
}
/**
 *  eventElement
 *   The XML element that defines the Event.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface TimelineRegionInfo {
    schemeIdUri: string;
    value: string;
    startTime: number;
    endTime: number;
    id: string;
    eventElement: Element;
  }
}
/**
 *  width
 *   The video width in pixels.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface MediaQualityInfo {
    audioSamplingRate: number | null;
    bandwidth: number;
    codecs: string;
    contentType: string;
    frameRate: number | null;
    height: number | null;
    mimeType: string | null;
    channelsCount: number | null;
    pixelAspectRatio: string | null;
    width: number | null;
  }
}
/**
 *  messageData
 *   Body of the message.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface EmsgInfo {
    schemeIdUri: string;
    value: string;
    startTime: number;
    endTime: number;
    timescale: number;
    presentationTimeDelta: number;
    eventDuration: number;
    id: number;
    messageData: Uint8Array;
  }
}
/**
 *  programStartDate
 *   The derived start date of the program.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface ProducerReferenceTime {
    wallClockTime: number;
    programStartDate: Date;
  }
}
/**
 *  sessionType
 *   <i>Defaults to <code>'temporary'</code> for streaming.</i> <br>
 *   The MediaKey session type to create streaming licenses with.  This doesn't
 *   affect offline storage.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface AdvancedDrmConfiguration {
    distinctiveIdentifierRequired: boolean;
    persistentStateRequired: boolean;
    videoRobustness: string;
    audioRobustness: string;
    serverCertificate: Uint8Array;
    serverCertificateUri: string;
    individualizationServer: string;
    sessionType: string;
  }
}
/**
 *  keySystemsMapping
 *   A map of key system name to key system name.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface DrmConfiguration {
    retryParameters: shaka.extern.RetryParameters;
    servers: { [key: string]: string };
    clearKeys: { [key: string]: string };
    delayLicenseRequestUntilPlayed: boolean;
    advanced: { [key: string]: shaka.extern.AdvancedDrmConfiguration };
    initDataTransform:
      | ((
          p1: Uint8Array,
          p2: string,
          p3: shaka.extern.DrmInfo | null
        ) => Uint8Array)
      | undefined;
    logLicenseExchange: boolean;
    updateExpirationTime: number;
    preferredKeySystems: string[];
    keySystemsMapping: { [key: string]: string };
  }
}
/**
 *  manifestPreprocessor
 *   Called immediately after the DASH manifest has been parsed into an
 *   XMLDocument. Provides a way for applications to perform efficient
 *   preprocessing of the manifest.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface DashManifestConfiguration {
    clockSyncUri: string;
    ignoreDrmInfo: boolean;
    disableXlinkProcessing: boolean;
    xlinkFailGracefully: boolean;
    ignoreMinBufferTime: boolean;
    autoCorrectDrift: boolean;
    initialSegmentLimit: number;
    ignoreSuggestedPresentationDelay: boolean;
    ignoreEmptyAdaptationSet: boolean;
    ignoreMaxSegmentDuration: boolean;
    keySystemsByURI: { [key: string]: string };
    manifestPreprocessor: (p1: Element) => any;
  }
}
/**
 *  mediaPlaylistFullMimeType
 *   A string containing a full mime type, including both the basic mime type
 *   and also the codecs. Used when the HLS parser parses a media playlist
 *   directly, required since all of the mime type and codecs information is
 *   contained within the master playlist.
 *   You can use the <code>shaka.util.MimeUtils.getFullType()</code> utility to
 *   format this value.
 *   <i>Defaults to
 *   <code>'video/mp2t; codecs="avc1.42E01E, mp4a.40.2"'</code>.</i>
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface HlsManifestConfiguration {
    ignoreTextStreamFailures: boolean;
    ignoreImageStreamFailures: boolean;
    defaultAudioCodec: string;
    defaultVideoCodec: string;
    ignoreManifestProgramDateTime: boolean;
    mediaPlaylistFullMimeType: string;
  }
}
/**
 *  hls
 *   Advanced parameters used by the HLS manifest parser.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface ManifestConfiguration {
    retryParameters: shaka.extern.RetryParameters;
    availabilityWindowOverride: number;
    disableAudio: boolean;
    disableVideo: boolean;
    disableText: boolean;
    disableThumbnails: boolean;
    defaultPresentationDelay: number;
    segmentRelativeVttTiming: boolean;
    dash: shaka.extern.DashManifestConfiguration;
    hls: shaka.extern.HlsManifestConfiguration;
  }
}
/**
 *  parsePrftBox
 *   If <code>true</code>, will raise a shaka.extern.ProducerReferenceTime
 *   player event (event name 'prft').
 *   The event will be raised only once per playback session as program
 *   start date will not change, and would save parsing the segment multiple
 *   times needlessly.
 *   Defaults to <code>false</code>.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface StreamingConfiguration {
    retryParameters: shaka.extern.RetryParameters;
    failureCallback: (p1: shaka.util.Error) => any;
    rebufferingGoal: number;
    bufferingGoal: number;
    bufferBehind: number;
    ignoreTextStreamFailures: boolean;
    alwaysStreamText: boolean;
    startAtSegmentBoundary: boolean;
    gapDetectionThreshold: number;
    durationBackoff: number;
    forceTransmuxTS: boolean;
    safeSeekOffset: number;
    stallEnabled: boolean;
    stallThreshold: number;
    stallSkip: number;
    useNativeHlsOnSafari: boolean;
    inaccurateManifestTolerance: number;
    lowLatencyMode: boolean;
    autoLowLatencyMode: boolean;
    forceHTTPS: boolean;
    preferNativeHls: boolean;
    updateIntervalSeconds: number;
    dispatchAllEmsgBoxes: boolean;
    observeQualityChanges: boolean;
    maxDisabledTime: number;
    parsePrftBox: boolean;
  }
}
/**
 *  ignoreDevicePixelRatio
 *   If true,device pixel ratio is ignored when restricting the quality to
 *   media element size.
 *   Defaults false.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface AbrConfiguration {
    enabled: boolean;
    useNetworkInformation: boolean;
    defaultBandwidthEstimate: number;
    restrictions: shaka.extern.Restrictions;
    switchInterval: number;
    bandwidthUpgradeTarget: number;
    bandwidthDowngradeTarget: number;
    advanced: shaka.extern.AdvancedAbrConfiguration;
    restrictToElementSize: boolean;
    ignoreDevicePixelRatio: boolean;
  }
}
/**
 *  slowHalfLife
 *   The quantity of prior samples (by weight) used when creating a new
 *   estimate, in seconds.  Those prior samples make up half of the
 *   new estimate.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface AdvancedAbrConfiguration {
    minTotalBytes: number;
    minBytes: number;
    fastHalfLife: number;
    slowHalfLife: number;
  }
}
/**
 *  contentId
 *   A unique string identifying the current content. Maximum length is 64
 *   characters. This value is consistent across multiple different sessions and
 *   devices and is defined and updated at the discretion of the service
 *   provider.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface CmcdConfiguration {
    enabled: boolean;
    useHeaders: boolean;
    sessionId: string;
    contentId: string;
  }
}
/**
 *  numberOfParallelDownloads
 *   Number of parallel downloads.
 *   Note: normally browsers limit to 5 request in parallel, so putting a
 *   number higher than this will not help it download faster.
 *   Defaults to <code>5</code>.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface OfflineConfiguration {
    trackSelectionCallback: (
      p1: shaka.extern.TrackList
    ) => Promise<shaka.extern.TrackList>;
    downloadSizeCallback: (p1: number) => Promise<boolean>;
    progressCallback: (p1: shaka.extern.StoredContent, p2: number) => any;
    usePersistentLicense: boolean;
    numberOfParallelDownloads: number;
  }
}
/**
 *  textDisplayFactory
 *   A factory to construct a text displayer. Note that, if this is changed
 *   during playback, it will cause the text tracks to be reloaded.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface PlayerConfiguration {
    autoShowText: shaka.config.AutoShowText;
    drm: shaka.extern.DrmConfiguration;
    manifest: shaka.extern.ManifestConfiguration;
    streaming: shaka.extern.StreamingConfiguration;
    abrFactory: shaka.extern.AbrManager.Factory;
    abr: shaka.extern.AbrConfiguration;
    cmcd: shaka.extern.CmcdConfiguration;
    offline: shaka.extern.OfflineConfiguration;
    preferredAudioLanguage: string;
    preferredTextLanguage: string;
    preferredVariantRole: string;
    preferredTextRole: string;
    preferredVideoCodecs: string[];
    preferredAudioCodecs: string[];
    preferredAudioChannelCount: number;
    preferredDecodingAttributes: string[];
    preferForcedSubs: boolean;
    restrictions: shaka.extern.Restrictions;
    playRangeStart: number;
    playRangeEnd: number;
    textDisplayFactory: shaka.extern.TextDisplayer.Factory;
  }
}
/**
 *  label
 *    The label of the audio stream, if it has one.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface LanguageRole {
    language: string;
    role: string;
    label: string | null;
  }
}
/**
 *  width
 *    The thumbnail width in px.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Thumbnail {
    imageHeight: number;
    imageWidth: number;
    height: number;
    positionX: number;
    positionY: number;
    startTime: number;
    duration: number;
    uris: string[];
    width: number;
  }
}
/**
 *  endTime
 *    The time that describes the end of the range of chapter.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Chapter {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
  }
}
