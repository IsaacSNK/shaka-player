/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as CueExports from './dev-workspace.shaka-player-fork.lib.text.cue';
import {Cue} from './dev-workspace.shaka-player-fork.lib.text.cue';
import * as TextEngineExports from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import {TextEngine} from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import * as VttTextParserExports from './dev-workspace.shaka-player-fork.lib.text.vtt_text_parser';
import {VttTextParser} from './dev-workspace.shaka-player-fork.lib.text.vtt_text_parser';
import * as DataViewReaderExports from './dev-workspace.shaka-player-fork.lib.util.data_view_reader';
import {DataViewReader} from './dev-workspace.shaka-player-fork.lib.util.data_view_reader';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import {Functional} from './dev-workspace.shaka-player-fork.lib.util.functional';
import {Mp4BoxParsers, ParsedTRUNSample} from './dev-workspace.shaka-player-fork.lib.util.mp4_box_parsers';
import * as Mp4ParserExports from './dev-workspace.shaka-player-fork.lib.util.mp4_parser';
import {Mp4Parser} from './dev-workspace.shaka-player-fork.lib.util.mp4_parser';
import * as StringUtilsExports from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {StringUtils} from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {TextParser} from './dev-workspace.shaka-player-fork.lib.util.text_parser';

/**
 * @export
 */
export class Mp4VttParser implements shaka.
extern.TextParser {
  /**
   * The current time scale used by the VTT parser.
   *
   */
  private timescale_: number|null = null;

  /**
   * @override
   * @export
   */
  parseInit(data) {
    const Mp4Parser = Mp4Parser;
    let sawWVTT = false;
    (new Mp4Parser())
        .box('moov', Mp4Parser.children)
        .box('trak', Mp4Parser.children)
        .box('mdia', Mp4Parser.children)
        .fullBox(
            'mdhd',
            (box) => {
              asserts.assert(
                  box.version == 0 || box.version == 1,
                  'MDHD version can only be 0 or 1');
              const parsedMDHDBox =
                  Mp4BoxParsers.parseMDHD(box.reader, box.version);
              this.timescale_ = parsedMDHDBox.timescale;
            })
        .box('minf', Mp4Parser.children)
        .box('stbl', Mp4Parser.children)
        .fullBox('stsd', Mp4Parser.sampleDescription)
        .box(
            'wvtt',
            (box) => {
              // A valid vtt init segment, though we have no actual subtitles
              // yet.
              sawWVTT = true;
            })
        .parse(data);
    if (!this.timescale_) {
      // Missing timescale for VTT content. It should be located in the MDHD.
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_MP4_VTT);
    }
    if (!sawWVTT) {
      // A WVTT box should have been seen (a valid vtt init segment with no
      // actual subtitles).
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_MP4_VTT);
    }
  }

  /**
   * @override
   * @export
   */
  setSequenceMode(sequenceMode) {}

  // Unused.
  /**
   * @override
   * @export
   */
  parseMedia(data, time) {
    if (!this.timescale_) {
      // Missing timescale for VTT content. We should have seen the init
      // segment.
      log.error('No init segment for MP4+VTT!');
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_MP4_VTT);
    }
    const Mp4Parser = Mp4Parser;
    let baseTime = 0;
    let presentations: ParsedTRUNSample[] = [];
    let rawPayload: Uint8Array;
    const cues: Cue[] = [];
    let sawTFDT = false;
    let sawTRUN = false;
    let sawMDAT = false;
    let defaultDuration = null;
    const parser =
        (new Mp4Parser())
            .box('moof', Mp4Parser.children)
            .box('traf', Mp4Parser.children)
            .fullBox(
                'tfdt',
                (box) => {
                  sawTFDT = true;
                  asserts.assert(
                      box.version == 0 || box.version == 1,
                      'TFDT version can only be 0 or 1');
                  const parsedTFDTBox =
                      Mp4BoxParsers.parseTFDT(box.reader, box.version);
                  baseTime = parsedTFDTBox.baseMediaDecodeTime;
                })
            .fullBox(
                'tfhd',
                (box) => {
                  asserts.assert(
                      box.flags != null,
                      'A TFHD box should have a valid flags value');
                  const parsedTFHDBox =
                      Mp4BoxParsers.parseTFHD(box.reader, box.flags);
                  defaultDuration = parsedTFHDBox.defaultSampleDuration;
                })
            .fullBox(
                'trun',
                (box) => {
                  sawTRUN = true;
                  asserts.assert(
                      box.version != null,
                      'A TRUN box should have a valid version value');
                  asserts.assert(
                      box.flags != null,
                      'A TRUN box should have a valid flags value');
                  const parsedTRUNBox = Mp4BoxParsers.parseTRUN(
                      box.reader, box.version, box.flags);
                  presentations = parsedTRUNBox.sampleData;
                })
            .box('mdat', Mp4Parser.allData((data) => {
              asserts.assert(
                  !sawMDAT,
                  'VTT cues in mp4 with multiple MDAT are not currently supported');
              sawMDAT = true;
              rawPayload = data;
            }));
    parser.parse(
        data,
        /* partialOkay= */
        false);
    if (!sawMDAT && !sawTFDT && !sawTRUN) {
      // A required box is missing.
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_MP4_VTT);
    }
    let currentTime = baseTime;
    const reader: DataViewReader = new DataViewReader(
        rawPayload, DataViewReaderExports.Endianness.BIG_ENDIAN);
    for (const presentation of presentations) {
      // If one presentation corresponds to multiple payloads, it is assumed
      // that all of those payloads have the same start time and duration.
      const duration = presentation.sampleDuration || defaultDuration;
      const startTime = presentation.sampleCompositionTimeOffset ?
          baseTime + presentation.sampleCompositionTimeOffset :
          currentTime;
      currentTime = startTime + (duration || 0);

      // Read samples until it adds up to the given size.
      let totalSize = 0;
      do {
        // Read the payload size.
        const payloadSize = reader.readUint32();
        totalSize += payloadSize;

        // Skip the type.
        const payloadType = reader.readUint32();
        const payloadName = Mp4Parser.typeToString(payloadType);

        // Read the data payload.
        let payload: Uint8Array = null;
        if (payloadName == 'vttc') {
          if (payloadSize > 8) {
            payload = reader.readBytes(payloadSize - 8);
          }
        } else {
          if (payloadName == 'vtte') {
            // It's a vtte, which is a vtt cue that is empty. Ignore any data
            // that does exist.
            reader.skip(payloadSize - 8);
          } else {
            log.error('Unknown box ' + payloadName + '! Skipping!');
            reader.skip(payloadSize - 8);
          }
        }
        if (duration) {
          if (payload) {
            asserts.assert(
                this.timescale_ != null, 'Timescale should not be null!');
            const cue = Mp4VttParser.parseVTTC_(
                payload, time.periodStart + startTime / this.timescale_,
                time.periodStart + currentTime / this.timescale_);
            cues.push(cue);
          }
        } else {
          log.error('WVTT sample duration unknown, and no default found!');
        }
        asserts.assert(
            !presentation.sampleSize || totalSize <= presentation.sampleSize,
            'The samples do not fit evenly into the sample sizes given in ' +
                'the TRUN box!');
      } while (
          // If no sampleSize was specified, it's assumed that this presentation
          // corresponds to only a single cue.
          presentation.sampleSize && totalSize < presentation.sampleSize);
    }
    asserts.assert(
        !reader.hasMoreData(),
        'MDAT which contain VTT cues and non-VTT data are not currently ' +
            'supported!');
    return (cues.filter(Functional.isNotNull) as shaka.extern.Cue[]);
  }

  /**
   * Parses a vttc box into a cue.
   *
   */
  private static parseVTTC_(
      data: Uint8Array, startTime: number, endTime: number): Cue {
    let payload;
    let id;
    let settings;
    (new Mp4Parser())
        .box('payl', Mp4Parser.allData((data) => {
          payload = StringUtils.fromUTF8(data);
        }))
        .box('iden', Mp4Parser.allData((data) => {
          id = StringUtils.fromUTF8(data);
        }))
        .box('sttg', Mp4Parser.allData((data) => {
          settings = StringUtils.fromUTF8(data);
        }))
        .parse(data);
    if (payload) {
      return Mp4VttParser.assembleCue_(
          payload, id, settings, startTime, endTime);
    } else {
      return null;
    }
  }

  /**
   * Take the individual components that make a cue and create a vttc cue.
   *
   */
  private static assembleCue_(
      payload: string, id: string|null, settings: string|null,
      startTime: number, endTime: number): Cue {
    const cue = new Cue(startTime, endTime, '');
    const styles: Map<string, Cue> = new Map();
    VttTextParser.parseCueStyles(payload, cue, styles);
    if (id) {
      cue.id = id;
    }
    if (settings) {
      const parser = new TextParser(settings);
      let word = parser.readWord();
      while (word) {
        // TODO: Check WebVTTConfigurationBox for region info.
        if (!VttTextParser.parseCueSetting(
                cue, word,
                /* VTTRegions= */
                [])) {
          log.warning(
              'VTT parser encountered an invalid VTT setting: ', word,
              ' The setting will be ignored.');
        }
        parser.skipWhitespace();
        word = parser.readWord();
      }
    }
    return cue;
  }
}
TextEngine.registerParser(
    'application/mp4; codecs="wvtt"', () => new Mp4VttParser());
