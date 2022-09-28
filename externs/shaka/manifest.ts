/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *  sequenceMode
 *   If true, we will append the media segments using sequence mode; that is to
 *   say, ignoring any timestamps inside the media files.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Manifest {
    presentationTimeline: shaka.media.PresentationTimeline;
    variants: shaka.extern.Variant[];
    textStreams: shaka.extern.Stream[];
    imageStreams: shaka.extern.Stream[];
    offlineSessionIds: string[];
    minBufferTime: number;
    sequenceMode: boolean;
  }
}
/**
 *  keyId
 *   The key Id that corresponds to this initData.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface InitDataOverride {
    initData: Uint8Array;
    initDataType: string;
    keyId: string | null;
  }
}
/**
 *  keyIds
 *   <i>Defaults to the empty Set</i> <br>
 *   If not empty, contains the default key IDs for this key system, as
 *   lowercase hex strings.
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface DrmInfo {
    keySystem: string;
    licenseServerUri: string;
    distinctiveIdentifierRequired: boolean;
    persistentStateRequired: boolean;
    audioRobustness: string;
    videoRobustness: string;
    serverCertificate: Uint8Array;
    serverCertificateUri: string;
    sessionType: string;
    initData: shaka.extern.InitDataOverride[];
    keyIds: Set<string>;
  }
}
/**
 *  decodingInfos
 *   <i>Defaults to [].</i><br>
 *   Set by StreamUtils to indicate the results from MediaCapabilities
 *   decodingInfo.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Variant {
    id: number;
    language: string;
    disabledUntilTime: number;
    primary: boolean;
    audio: shaka.extern.Stream | null;
    video: shaka.extern.Stream | null;
    bandwidth: number;
    allowedByApplication: boolean;
    allowedByKeySystem: boolean;
    decodingInfos: MediaCapabilitiesDecodingInfo[];
  }
}
/**
 * Creates a SegmentIndex; returns a Promise that resolves after the
 * SegmentIndex has been created.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  type CreateSegmentIndexFunction = () => Promise;
}
/**
 *  firstMediaSequenceNumber
 *   The starting Media Sequence Number of the playlist, used when IV is
 *   undefined.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface HlsAes128Key {
    method: string;
    cryptoKey: webCrypto.CryptoKey | undefined;
    fetchKey: shaka.extern.CreateSegmentIndexFunction | undefined;
    iv: Uint8Array | undefined;
    firstMediaSequenceNumber: number;
  }
}
/**
 * A function that fetches the crypto keys for AES-128.
 * Returns a promise that resolves when the keys have been fetched.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  type FetchCryptoKeysFunction = () => Promise;
}
/**
 *  matchedStreams
 *   The streams in all periods which match the stream. Used for Dash.
 *
 * @exportDoc
 */
declare namespace shaka.extern {
  export interface Stream {
    id: number;
    originalId: string | null;
    createSegmentIndex: shaka.extern.CreateSegmentIndexFunction;
    closeSegmentIndex: (() => any) | undefined;
    segmentIndex: shaka.media.SegmentIndex;
    mimeType: string;
    codecs: string;
    frameRate: number | undefined;
    pixelAspectRatio: string | undefined;
    hdr: string | undefined;
    bandwidth: number | undefined;
    width: number | undefined;
    height: number | undefined;
    kind: string | undefined;
    encrypted: boolean;
    drmInfos: shaka.extern.DrmInfo[];
    keyIds: Set<string>;
    language: string;
    label: string | null;
    type: string;
    primary: boolean;
    trickModeVideo: shaka.extern.Stream | null;
    emsgSchemeIdUris: string[] | null;
    roles: string[];
    forced: boolean;
    channelsCount: number | null;
    audioSamplingRate: number | null;
    spatialAudio: boolean;
    closedCaptions: Map<string, string>;
    tilesLayout: string | undefined;
    matchedStreams: shaka.extern.Stream[] | shaka.extern.StreamDB[] | undefined;
  }
}
