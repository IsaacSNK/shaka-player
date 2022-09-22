/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as Cea608DataChannelExports from './/cea608_data_channel';
import {Cea608DataChannel} from './/cea608_data_channel';
import * as Cea708ServiceExports from './/cea708_service';
import {Cea708Service} from './/cea708_service';
import * as DtvccPacketBuilderExports from './/dtvcc_packet_builder';
import {DtvccPacket, DtvccPacketBuilder} from './/dtvcc_packet_builder';
import * as ICaptionDecoderExports from './/i_caption_decoder';
import {ICaptionDecoder} from './/i_caption_decoder';
import * as logExports from './../debug/log';
import {log} from './../debug/log';
import * as DataViewReaderExports from './../util/data_view_reader';
import {DataViewReader} from './../util/data_view_reader';
import * as ErrorExports from './../util/error';
import {Error} from './../util/error';

/**
 * CEA-X08 captions decoder. Currently only CEA-608 supported.
 */
export class CeaDecoder implements ICaptionDecoder {
  /**
   * An array of CEA-608 closed caption data extracted for decoding.
   */
  private cea608DataArray_: Cea608DataChannelExports.Cea608Packet[] = [];

  /**
   * An array of CEA-708 closed caption data extracted for decoding.
   */
  private cea708DataArray_: Cea708ServiceExports.Cea708Byte[] = [];

  /**
   * A DTVCC Packet builder for CEA-708 data.
   */
  private dtvccPacketBuilder_: DtvccPacketBuilder;

  /**
   * Number of consecutive bad frames decoded on CEA-608.
   */
  private badFrames_: number = 0;

  /**
   * A map containing the stream for each mode.
   */
  private cea608ModeToStream_: Map<string, Cea608DataChannel>;

  /**
   * The current channel that is active on CEA-608 field 1.
   */
  private currentField1Channel_: number = 0;

  /**
   * The current channel that is active on CEA-608 field 2.
   */
  private currentField2Channel_: number = 0;

  /**
   * Map of service number to CEA-708 services, initially empty. Since there
   * can be up to 63 services, they are created dynamically only when needed.
   */
  private serviceNumberToService_: Map<number, Cea708Service>;

  constructor() {
    this.dtvccPacketBuilder_ = new DtvccPacketBuilder();
    this.cea608ModeToStream_ = new Map([
      ['CC1', new Cea608DataChannel(0, 0)],
      // F1 + C1 -> CC1
      ['CC2', new Cea608DataChannel(0, 1)],
      // F1 + C2 -> CC2
      ['CC3', new Cea608DataChannel(1, 0)],
      // F2 + C1 -> CC3
      ['CC4', new Cea608DataChannel(1, 1)]
    ]);

    // F2 + C2 -> CC4
    this.serviceNumberToService_ = new Map();
    this.reset();
  }

  /**
   * Clears the decoder.
   * @override
   */
  clear() {
    this.badFrames_ = 0;
    this.cea608DataArray_ = [];
    this.cea708DataArray_ = [];
    this.dtvccPacketBuilder_.clear();
    this.reset();

    // Clear all the CEA-708 services.
    for (const service of this.serviceNumberToService_.values()) {
      service.clear();
    }
  }

  /**
   * Resets the decoder.
   */
  reset() {
    this.currentField1Channel_ = 0;
    this.currentField2Channel_ = 0;
    for (const stream of this.cea608ModeToStream_.values()) {
      stream.reset();
    }
  }

  /**
   * Extracts closed caption bytes from CEA-X08 packets from the stream based on
   * ANSI/SCTE 128 and A/53, Part 4.
   * @override
   */
  extract(userDataSeiMessage, pts) {
    const reader = new DataViewReader(
        userDataSeiMessage, DataViewReaderExports.Endianness.BIG_ENDIAN);
    if (reader.readUint8() !== USA_COUNTRY_CODE) {
      return;
    }
    if (reader.readUint16() !== ATSC_PROVIDER_CODE) {
      return;
    }
    if (reader.readUint32() !== ATSC1_USER_IDENTIFIER) {
      return;
    }

    // user_data_type_code: 0x03 - cc_data()
    if (reader.readUint8() !== 3) {
      return;
    }

    // 1 bit reserved
    // 1 bit process_cc_data_flag
    // 1 bit zero_bit
    // 5 bits cc_count
    const captionData = reader.readUint8();

    // If process_cc_data_flag is not set, do not process this data.
    if ((captionData & 64) === 0) {
      return;
    }
    const count = captionData & 31;

    // 8 bits reserved
    reader.skip(1);
    for (let i = 0; i < count; i++) {
      const cc = reader.readUint8();

      // When ccValid is 0, the next two bytes should be discarded.
      const ccValid = (cc & 4) >> 2;
      const ccData1 = reader.readUint8();
      const ccData2 = reader.readUint8();
      if (ccValid) {
        const ccType = cc & 3;

        // Send the packet to the appropriate data array (CEA-608 or CEA-708).
        if (ccType === NTSC_CC_FIELD_1 || ccType === NTSC_CC_FIELD_2) {
          // CEA-608 NTSC (Line 21) Data.
          this.cea608DataArray_.push({
            pts,
            type: ccType,
            ccData1,
            ccData2,
            order: this.cea608DataArray_.length
          });
        } else {
          // CEA-708 DTVCC Data.
          this.cea708DataArray_.push({
            pts,
            type: ccType,
            value: ccData1,
            order: this.cea708DataArray_.length
          });

          // The second byte should always be labelled as DTVCC packet data.
          // Even if this pair was a DTVCC packet start, only the first byte
          // contains header info, and the second byte is just packet data.
          this.cea708DataArray_.push({
            pts,
            type: DtvccPacketBuilderExports.DTVCC_PACKET_DATA,
            value: ccData2,
            order: this.cea708DataArray_.length
          });
        }
      }
    }
  }

  /**
   * Decodes extracted closed caption data.
   * @override
   */
  decode() {
    const parsedClosedCaptions: ICaptionDecoderExports.ClosedCaption[] = [];

    // In some versions of Chrome, and other browsers, the default sorting
    // algorithm isn't stable. This comparator sorts on presentation
    // timestamp, and breaks ties on receive order (position in array).
    const stableComparator = (p1, p2) => p1.pts - p2.pts || p1.order - p2.order;
    this.cea608DataArray_.sort(stableComparator);
    this.cea708DataArray_.sort(stableComparator);

    // CEA-608 packets are just byte pairs. Decode all of them.
    for (const cea608Packet of this.cea608DataArray_) {
      const parsedClosedCaption = this.decodeCea608_(cea608Packet);
      if (parsedClosedCaption) {
        parsedClosedCaptions.push(parsedClosedCaption);
      }
    }

    // CEA-708 packets are DTVCC packets composed of many byte pairs. Add all
    // byte pairs to the packet builder, and process + clear any ready packets.
    for (const cea708Byte of this.cea708DataArray_) {
      this.dtvccPacketBuilder_.addByte(cea708Byte);
    }
    const dtvccPackets = this.dtvccPacketBuilder_.getBuiltPackets();
    for (const dtvccPacket of dtvccPackets) {
      const closedCaptions = this.decodeCea708_(dtvccPacket);
      parsedClosedCaptions.push(...closedCaptions);
    }

    // Clear all processed data.
    this.dtvccPacketBuilder_.clearBuiltPackets();
    this.cea608DataArray_ = [];
    this.cea708DataArray_ = [];
    return parsedClosedCaptions;
  }

  /**
   * Decodes a CEA-608 closed caption packet based on ANSI/CEA-608.
   */
  private decodeCea608_(ccPacket: Cea608DataChannelExports.Cea608Packet):
      ICaptionDecoderExports.ClosedCaption|null {
    const fieldNum = ccPacket.type;

    // If this packet is a control code, then it also sets the channel.
    // For control codes, cc_data_1 has the form |P|0|0|1|C|X|X|X|.
    // "C" is the channel bit. It indicates whether to set C2 active.
    if (Cea608DataChannel.isControlCode(ccPacket.ccData1)) {
      const channelNum = ccPacket.ccData1 >> 3 & 1;

      // Get channel bit.

      // Change the stream based on the field, and the new channel
      if (fieldNum === 0) {
        this.currentField1Channel_ = channelNum;
      } else {
        this.currentField2Channel_ = channelNum;
      }
    }

    // Get the correct stream for this caption packet (CC1, ..., CC4)
    const selectedChannel =
        fieldNum ? this.currentField2Channel_ : this.currentField1Channel_;
    const selectedMode = `CC${fieldNum << 1 | selectedChannel + 1}`;
    const selectedStream = this.cea608ModeToStream_.get(selectedMode);

    // Check for bad frames (bad pairs). This can be two 0xff, two 0x00, or any
    // byte of even parity. ccData1 and ccData2 should be uint8 of odd parity.
    if (ccPacket.ccData1 === 255 && ccPacket.ccData2 === 255 ||
        !ccPacket.ccData1 && !ccPacket.ccData2 ||
        !this.isOddParity_(ccPacket.ccData1) ||
        !this.isOddParity_(ccPacket.ccData2)) {
      // Per CEA-608-B C.21, reset the memory after 45 consecutive bad frames.
      if (++this.badFrames_ >= 45) {
        this.reset();
      }
      return null;
    }
    this.badFrames_ = 0;

    // Remove the MSB (parity bit).
    ccPacket.ccData1 &= 127;
    ccPacket.ccData2 &= 127;

    // Check for empty captions and skip them.
    if (!ccPacket.ccData1 && !ccPacket.ccData2) {
      return null;
    }

    // Process the clean CC data pair.
    let parsedClosedCaption = null;
    if (Cea608DataChannel.isControlCode(ccPacket.ccData1)) {
      parsedClosedCaption = selectedStream.handleControlCode(ccPacket);
    } else {
      // Handle as a Basic North American Character.
      selectedStream.handleBasicNorthAmericanChar(
          ccPacket.ccData1, ccPacket.ccData2);
    }
    return parsedClosedCaption;
  }

  /**
   * Decodes a CEA-708 DTVCC packet based on ANSI/CTA-708-E.
   */
  private decodeCea708_(dtvccPacket: DtvccPacket):
      ICaptionDecoderExports.ClosedCaption[] {
    const parsedClosedCaptions = [];

    // position < end of block
    // serviceNumber != 0
    // hasMoreData
    try {
      while (dtvccPacket.hasMoreData()) {
        // Process a service block.
        const serviceBlockHeader = dtvccPacket.readByte().value;

        // First 3 bits are service number, next 5 are block size,
        // representing the number of bytes coming in this block
        // (discluding a possible extended service block header byte)
        let serviceNumber = (serviceBlockHeader & 224) >> 5;
        const blockSize = serviceBlockHeader & 31;
        if (serviceNumber ===
                /* 0b111 */
                7 &&
            blockSize != 0) {
          // 2 bits null padding, 6 bits extended service number
          const extendedServiceBlockHeader = dtvccPacket.readByte().value;
          serviceNumber = extendedServiceBlockHeader & 63;
        }

        // As per CEA-708-E, service number 0 is invalid, and should be ignored.
        if (serviceNumber != 0) {
          // If the service doesn't already exist, create it.
          if (!this.serviceNumberToService_.has(serviceNumber)) {
            const service = new Cea708Service(serviceNumber);
            this.serviceNumberToService_.set(serviceNumber, service);
          }
          const service = this.serviceNumberToService_.get(serviceNumber);

          // Process all control codes.
          const startPos = dtvccPacket.getPosition();

          // Execute this loop `blockSize` times, to decode the control codes.
          while (dtvccPacket.getPosition() - startPos < blockSize) {
            const closedCaption = service.handleCea708ControlCode(dtvccPacket);
            if (closedCaption) {
              parsedClosedCaptions.push(closedCaption);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error &&
          error.code === ErrorExports.Code.BUFFER_READ_OUT_OF_BOUNDS) {
        log.warnOnce(
            'CEA708_INVALID_DATA',
            'Buffer read out of bounds / invalid CEA-708 Data.');
      } else {
        // This is an unexpected error, and should be rethrown.
        throw error;
      }
    }
    return parsedClosedCaptions;
  }

  /**
   * Checks if a byte has odd parity (Odd number of 1s in binary).
   * @return True if the byte has odd parity.
   */
  private isOddParity_(byte: number): boolean {
    let parity = 0;
    while (byte) {
      parity ^= byte & 1;

      // toggle parity if low bit is 1
      byte >>= 1;
    }

    // shift away the low bit
    return parity === 1;
  }
}

/**
 * itu_t_35_provider_code for ATSC user_data
 *  */
export const ATSC_PROVIDER_CODE: number = 49;

/**
 * When provider is ATSC user data, the ATSC_user_identifier code
 * for ATSC1_data is "GA94" (0x47413934)
 *  */
export const ATSC1_USER_IDENTIFIER: number = 1195456820;

export const NTSC_CC_FIELD_1: number = 0;

export const NTSC_CC_FIELD_2: number = 1;

/**
 * 0xB5 is USA's code (Rec. ITU-T T.35)
 *  */
export const USA_COUNTRY_CODE: number = 181;
