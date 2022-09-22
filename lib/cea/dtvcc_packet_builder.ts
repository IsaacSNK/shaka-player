/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as Cea708ServiceExports from './cea708_service';
import {Cea708Service} from './cea708_service';
import * as ErrorExports from './../util/error';
import {Error} from './../util/error';

/**
 * CEA-708 DTVCC Packet Builder.
 * Builds packets based on Figure 5 CCP State Table in 5.2 of CEA-708-E.
 * Initially, there is no packet. When a DTVCC_PACKET_START payload is received,
 * a packet begins construction. The packet is considered "built" once all bytes
 * indicated in the header are read, and ignored if a new packet starts building
 * before the current packet is finished being built.
 */
export class DtvccPacketBuilder {
  /**
   * An array containing built DTVCC packets that are ready to be processed.
   */
  private builtPackets_: DtvccPacket[] = [];

  /**
   * Stores the packet data for the current packet being processed, if any.
   */
  private currentPacketBeingBuilt_: Cea708ServiceExports.Cea708Byte[]|null =
      null;

  /**
   * Keeps track of the number of bytes left to add in the current packet.
   */
  private bytesLeftToAddInCurrentPacket_: number = 0;

  addByte(cea708Byte: Cea708ServiceExports.Cea708Byte) {
    if (cea708Byte.type === DTVCC_PACKET_START) {
      // If there was a packet being built that finished, it would have
      // already been added to the built packets when it finished. So if
      // there's an open packet at this point, it must be unfinished. As
      // per the spec, we don't deal with unfinished packets. So we ignore them.

      // A new packet should be opened.
      const packetSize = cea708Byte.value & 63;

      // As per spec, number of packet data bytes to follow is packetSize*2-1.
      this.bytesLeftToAddInCurrentPacket_ = packetSize * 2 - 1;
      this.currentPacketBeingBuilt_ = [];
      return;
    }
    if (!this.currentPacketBeingBuilt_) {
      // There is no packet open. Then an incoming byte should not
      // have come in at all. Ignore it.
      return;
    }
    if (this.bytesLeftToAddInCurrentPacket_ > 0) {
      this.currentPacketBeingBuilt_.push(cea708Byte);
      this.bytesLeftToAddInCurrentPacket_--;
    }
    if (this.bytesLeftToAddInCurrentPacket_ === 0) {
      // Current packet is complete and ready for processing.
      const packet = new DtvccPacket(this.currentPacketBeingBuilt_);
      this.builtPackets_.push(packet);
      this.currentPacketBeingBuilt_ = null;
      this.bytesLeftToAddInCurrentPacket_ = 0;
    }
  }

  getBuiltPackets(): DtvccPacket[] {
    return this.builtPackets_;
  }

  /** Clear built packets. */
  clearBuiltPackets() {
    this.builtPackets_ = [];
  }

  /** Clear built packets and packets in progress. */
  clear() {
    this.builtPackets_ = [];
    this.currentPacketBeingBuilt_ = [];
    this.bytesLeftToAddInCurrentPacket_ = 0;
  }
}

export class DtvccPacket {
  /**
   * Keeps track of the position to read the next byte from in the packet.
   */
  private pos_: number = 0;

  /**
   * Bytes that represent the data in the DTVCC packet.
   */
  private packetData_: Cea708ServiceExports.Cea708Byte[];

  constructor(packetData: Cea708ServiceExports.Cea708Byte[]) {
    this.packetData_ = packetData;
  }

  hasMoreData(): boolean {
    return this.pos_ < this.packetData_.length;
  }

  getPosition(): number {
    return this.pos_;
  }

  /**
   * Reads a byte from the packet. TODO CONSIDER RENAMING THIS TO BLOCK
   * @throws {!shaka.util.Error}
   */
  readByte(): Cea708ServiceExports.Cea708Byte {
    if (!this.hasMoreData()) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.BUFFER_READ_OUT_OF_BOUNDS);
    }
    return this.packetData_[this.pos_++];
  }

  /**
   * Skips the provided number of blocks in the buffer.
   * @throws {!shaka.util.Error}
   */
  skip(numBlocks: number) {
    if (this.pos_ + numBlocks > this.packetData_.length) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.BUFFER_READ_OUT_OF_BOUNDS);
    }
    this.pos_ += numBlocks;
  }
}

export const DTVCC_PACKET_DATA: number = 2;

export const DTVCC_PACKET_START: number = 3;
