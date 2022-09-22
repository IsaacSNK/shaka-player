/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as ICeaParserExports from './/i_cea_parser';
import {ICeaParser} from './/i_cea_parser';
import {SeiProcessor} from './/sei_processor';
import * as assertsExports from './../debug/asserts';
import {asserts} from './../debug/asserts';
import * as DataViewReaderExports from './../util/data_view_reader';
import {DataViewReader} from './../util/data_view_reader';
import * as ErrorExports from './../util/error';
import {Error} from './../util/error';
import {Mp4BoxParsers, ParsedTRUNSample} from './../util/mp4_box_parsers';
import * as Mp4ParserExports from './../util/mp4_parser';
import {Mp4Parser} from './../util/mp4_parser';

/**
 * MPEG4 stream parser used for extracting 708 closed captions data.
 */
export class Mp4CeaParser implements ICeaParser {
  /**
   * SEI data processor.
   */
  private seiProcessor_: SeiProcessor;

  /**
   * Map of track id to corresponding timescale.
   */
  private trackIdToTimescale_: Map<number, number>;

  /**
   * Default sample duration, as specified by the TREX box.
   */
  private defaultSampleDuration_: number = 0;

  /**
   * Default sample size, as specified by the TREX box.
   */
  private defaultSampleSize_: number = 0;

  constructor() {
    this.seiProcessor_ = new SeiProcessor();
    this.trackIdToTimescale_ = new Map();
  }

  /**
   * Parses the init segment. Gets Default Sample Duration and Size from the
   * TREX box, and constructs a map of Track IDs to timescales. Each TRAK box
   * contains a track header (TKHD) containing track ID, and a media header box
   * (MDHD) containing the timescale for the track
   * @override
   */
  init(initSegment) {
    const Mp4Parser = Mp4Parser;
    const trackIds = [];
    const timescales = [];
    (new Mp4Parser())
        .box('moov', Mp4Parser.children)
        .box('mvex', Mp4Parser.children)
        .fullBox(
            'trex',
            (box) => {
              const parsedTREXBox = Mp4BoxParsers.parseTREX(box.reader);
              this.defaultSampleDuration_ = parsedTREXBox.defaultSampleDuration;
              this.defaultSampleSize_ = parsedTREXBox.defaultSampleSize;
            })
        .box('trak', Mp4Parser.children)
        .fullBox(
            'tkhd',
            (box) => {
              asserts.assert(
                  box.version != null,
                  'TKHD is a full box and should have a valid version.');
              const parsedTKHDBox =
                  Mp4BoxParsers.parseTKHD(box.reader, box.version);
              trackIds.push(parsedTKHDBox.trackId);
            })
        .box('mdia', Mp4Parser.children)
        .fullBox(
            'mdhd',
            (box) => {
              asserts.assert(
                  box.version != null,
                  'MDHD is a full box and should have a valid version.');
              const parsedMDHDBox =
                  Mp4BoxParsers.parseMDHD(box.reader, box.version);
              timescales.push(parsedMDHDBox.timescale);
            })
        .parse(
            initSegment,
            /* partialOkay= */
            true);

    // At least one track should exist, and each track should have a
    // corresponding Id in TKHD box, and timescale in its MDHD box
    if (!trackIds.length || !timescales.length ||
        trackIds.length != timescales.length) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_MP4_CEA);
    }

    // Populate the map from track Id to timescale
    trackIds.forEach((trackId, idx) => {
      this.trackIdToTimescale_.set(trackId, timescales[idx]);
    });
  }

  /**
   * Parses each video segment. In fragmented MP4s, MOOF and MDAT come in
   * pairs. The following logic gets the necessary info from MOOFs to parse
   * MDATs (base media decode time, sample sizes/offsets/durations, etc),
   * and then parses the MDAT boxes for CEA-708 packets using this information.
   * CEA-708 packets are returned in the callback.
   * @override
   */
  parse(mediaSegment) {
    const Mp4Parser = Mp4Parser;
    const captionPackets: ICeaParserExports.CaptionPacket[] = [];

    // Fields that are found in MOOF boxes
    let defaultSampleDuration = this.defaultSampleDuration_;
    let defaultSampleSize = this.defaultSampleSize_;
    let sampleData = [];
    let baseMediaDecodeTime = null;
    let timescale = ICeaParserExports.DEFAULT_TIMESCALE_VALUE;
    (new Mp4Parser())
        .box('moof', Mp4Parser.children)
        .box('traf', Mp4Parser.children)
        .fullBox(
            'trun',
            (box) => {
              asserts.assert(
                  box.version != null && box.flags != null,
                  'TRUN is a full box and should have a valid version & flags.');
              const parsedTRUN =
                  Mp4BoxParsers.parseTRUN(box.reader, box.version, box.flags);
              sampleData = parsedTRUN.sampleData;
            })
        .fullBox(
            'tfhd',
            (box) => {
              asserts.assert(
                  box.flags != null,
                  'TFHD is a full box and should have valid flags.');
              const parsedTFHD = Mp4BoxParsers.parseTFHD(box.reader, box.flags);

              // If specified, defaultSampleDuration and defaultSampleSize
              // override the ones specified in the TREX box
              defaultSampleDuration = parsedTFHD.defaultSampleDuration ||
                  this.defaultSampleDuration_;
              defaultSampleSize =
                  parsedTFHD.defaultSampleSize || this.defaultSampleSize_;
              const trackId = parsedTFHD.trackId;

              // Get the timescale from the track Id
              if (this.trackIdToTimescale_.has(trackId)) {
                timescale = this.trackIdToTimescale_.get(trackId);
              }
            })
        .fullBox(
            'tfdt',
            (box) => {
              asserts.assert(
                  box.version != null,
                  'TFDT is a full box and should have a valid version.');
              const parsedTFDT =
                  Mp4BoxParsers.parseTFDT(box.reader, box.version);
              baseMediaDecodeTime = parsedTFDT.baseMediaDecodeTime;
            })
        .box(
            'mdat',
            (box) => {
              if (baseMediaDecodeTime === null) {
                // This field should have been populated by
                // the Base Media Decode time in the TFDT box
                throw new Error(
                    ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
                    ErrorExports.Code.INVALID_MP4_CEA);
              }
              this.parseMdat_(
                  box.reader, baseMediaDecodeTime, timescale,
                  defaultSampleDuration, defaultSampleSize, sampleData,
                  captionPackets);
            })
        .parse(
            mediaSegment,
            /* partialOkay= */
            false);
    return captionPackets;
  }

  /**
   * Parse MDAT box.
   */
  private parseMdat_(
      reader: DataViewReader, time: number, timescale: number,
      defaultSampleDuration: number, defaultSampleSize: number,
      sampleData: ParsedTRUNSample[],
      captionPackets: ICeaParserExports.CaptionPacket[]) {
    let sampleIndex = 0;

    // The fields in each ParsedTRUNSample contained in the sampleData
    // array are nullable. In the case of sample data and sample duration,
    // we use the defaults provided by the TREX/TFHD boxes. For sample
    // composition time offset, we default to 0.
    let sampleSize = defaultSampleSize;
    if (sampleData.length) {
      sampleSize = sampleData[0].sampleSize || defaultSampleSize;
    }
    while (reader.hasMoreData()) {
      const naluSize = reader.readUint32();
      const naluType = reader.readUint8() & 31;
      if (naluType == ICeaParserExports.NALU_TYPE_SEI) {
        let timeOffset = 0;
        if (sampleData.length > sampleIndex) {
          timeOffset = sampleData[sampleIndex].sampleCompositionTimeOffset || 0;
        }
        const pts = (time + timeOffset) / timescale;
        for (const packet of this.seiProcessor_.process(
                 reader.readBytes(naluSize - 1))) {
          captionPackets.push({packet, pts});
        }
      } else {
        try {
          reader.skip(naluSize - 1);
        } catch (e) {
          // It is necessary to ignore this error because it can break the start
          // of playback even if the user does not want to see the subtitles.
          break;
        }
      }
      sampleSize -= naluSize + 4;
      if (sampleSize == 0) {
        if (sampleData.length > sampleIndex) {
          time +=
              sampleData[sampleIndex].sampleDuration || defaultSampleDuration;
        } else {
          time += defaultSampleDuration;
        }
        sampleIndex++;
        if (sampleData.length > sampleIndex) {
          sampleSize = sampleData[sampleIndex].sampleSize || defaultSampleSize;
        } else {
          sampleSize = defaultSampleSize;
        }
      }
    }
  }
}
