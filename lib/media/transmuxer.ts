/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as dependenciesExports from './dependencies___all';
import {dependencies} from './dependencies___all';
import {BufferUtils} from './util___buffer_utils';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import {IDestroyable} from './util___i_destroyable';
import * as ManifestParserUtilsExports from './util___manifest_parser_utils';
import {ManifestParserUtils} from './util___manifest_parser_utils';
import {PublicPromise} from './util___public_promise';
import {Uint8ArrayUtils} from './util___uint8array_utils';

/**
 * Transmuxer provides all operations for transmuxing from Transport
 * Stream to MP4.
 *
 */
export class Transmuxer implements IDestroyable {
  private muxjs_: muxjs|null;
  private muxTransmuxer_: muxjs.mp4.Transmuxer;
  private transmuxPromise_: PublicPromise = null;
  private transmuxedData_: Uint8Array[] = [];
  private captions_: muxjs.mp4.ClosedCaption[] = [];
  private metadata_: muxjs.mp4.Metadata[] = [];
  private isTransmuxing_: boolean = false;

  constructor() {
    this.muxjs_ = dependencies.muxjs();
    this.muxTransmuxer_ =
        new this.muxjs_.mp4.Transmuxer({'keepOriginalTimestamps': true});
    this.muxTransmuxer_.on('data', (segment) => this.onTransmuxed_(segment));
    this.muxTransmuxer_.on('done', () => this.onTransmuxDone_());
  }

  /**
   * @override
   */
  destroy() {
    this.muxTransmuxer_.dispose();
    this.muxTransmuxer_ = null;
    return Promise.resolve();
  }

  /**
   * Check if the content type is Transport Stream, and if muxjs is loaded.
   */
  static isSupported(mimeType: string, contentType?: string): boolean {
    const Transmuxer = Transmuxer;
    if (!dependencies.muxjs() || !Transmuxer.isTsContainer(mimeType)) {
      return false;
    }
    if (contentType) {
      return MediaSource.isTypeSupported(
          Transmuxer.convertTsCodecs(contentType, mimeType));
    }
    const ContentType = ManifestParserUtilsExports.ContentType;
    const audioMime = Transmuxer.convertTsCodecs(ContentType.AUDIO, mimeType);
    const videoMime = Transmuxer.convertTsCodecs(ContentType.VIDEO, mimeType);
    return MediaSource.isTypeSupported(audioMime) ||
        MediaSource.isTypeSupported(videoMime);
  }

  /**
   * Check if the mimetype contains 'mp2t'.
   */
  static isTsContainer(mimeType: string): boolean {
    return mimeType.toLowerCase().split(';')[0].split('/')[1] == 'mp2t';
  }

  /**
   * For transport stream, convert its codecs to MP4 codecs.
   */
  static convertTsCodecs(contentType: string, tsMimeType: string): string {
    const ContentType = ManifestParserUtilsExports.ContentType;
    let mp4MimeType = tsMimeType.replace(/mp2t/i, 'mp4');
    if (contentType == ContentType.AUDIO) {
      mp4MimeType = mp4MimeType.replace('video', 'audio');
    }

    // Handle legacy AVC1 codec strings (pre-RFC 6381).
    // Look for "avc1.<profile>.<level>", where profile is:
    //   66 (baseline => 0x42)
    //   77 (main => 0x4d)
    //   100 (high => 0x64)
    // Reference: https://bit.ly/2K9JI3x
    const match = /avc1\.(66|77|100)\.(\d+)/.exec(mp4MimeType);
    if (match) {
      let newCodecString = 'avc1.';
      const profile = match[1];
      if (profile == '66') {
        newCodecString += '4200';
      } else {
        if (profile == '77') {
          newCodecString += '4d00';
        } else {
          asserts.assert(
              profile == '100',
              'Legacy avc1 parsing code out of sync with regex!');
          newCodecString += '6400';
        }
      }

      // Convert the level to hex and append to the codec string.
      const level = Number(match[2]);
      asserts.assert(level < 256, 'Invalid legacy avc1 level number!');
      newCodecString += (level >> 4).toString(16);
      newCodecString += (level & 15).toString(16);
      mp4MimeType = mp4MimeType.replace(match[0], newCodecString);
    }
    return mp4MimeType;
  }

  /**
   * Transmux from Transport stream to MP4, using the mux.js library.
   * @return {!Promise.<{data: !Uint8Array,
   *                     captions: !Array.<!muxjs.mp4.ClosedCaption>,
   *                     metadata: !Array.<!Object>}>}
   */
  transmux(data: BufferSource): Promise<{
    data: Uint8Array,
    captions: muxjs.mp4.ClosedCaption[],
    metadata: Object[]
  }> {
    asserts.assert(
        !this.isTransmuxing_, 'No transmuxing should be in progress.');
    this.isTransmuxing_ = true;
    this.transmuxPromise_ = new PublicPromise();
    this.transmuxedData_ = [];
    this.captions_ = [];
    this.metadata_ = [];
    const dataArray = BufferUtils.toUint8(data);
    this.muxTransmuxer_.push(dataArray);
    this.muxTransmuxer_.flush();

    // Workaround for https://bit.ly/Shaka1449 mux.js not
    // emitting 'data' and 'done' events.
    // mux.js code is synchronous, so if onTransmuxDone_ has
    // not been called by now, it's not going to be.
    // Treat it as a transmuxing failure and reject the promise.
    if (this.isTransmuxing_) {
      this.transmuxPromise_.reject(new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA,
          ErrorExports.Code.TRANSMUXING_FAILED));
    }
    return this.transmuxPromise_;
  }

  /**
   * Handles the 'data' event of the transmuxer.
   * Extracts the cues from the transmuxed segment, and adds them to an array.
   * Stores the transmuxed data in another array, to pass it back to
   * MediaSourceEngine, and append to the source buffer.
   *
   */
  private onTransmuxed_(segment: muxjs.mp4.Transmuxer.Segment) {
    this.captions_ = segment.captions;
    this.metadata_ = segment.metadata;
    this.transmuxedData_.push(
        Uint8ArrayUtils.concat(segment.initSegment, segment.data));
  }

  /**
   * Handles the 'done' event of the transmuxer.
   * Resolves the transmux Promise, and returns the transmuxed data.
   */
  private onTransmuxDone_() {
    const output = {
      data: Uint8ArrayUtils.concat(...this.transmuxedData_),
      captions: this.captions_,
      metadata: this.metadata_
    };
    this.transmuxPromise_.resolve(output);
    this.isTransmuxing_ = false;
  }
}
