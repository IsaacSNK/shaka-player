/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{log}from './log';
import*as logExports from './log';
import{InitSegmentReference}from './segment_reference';
import{SegmentReference}from './segment_reference';
import*as SegmentReferenceExports from './segment_reference';
import{Error}from './error';
import*as ErrorExports from './error';
import{Mp4Parser}from './mp4_parser';
import*as Mp4ParserExports from './mp4_parser';
 
export 
class Mp4SegmentIndexParser {
   
  /**
     * Parses SegmentReferences from an ISO BMFF SIDX structure.
     * @param sidxData The MP4's container's SIDX.
     * @param sidxOffset The SIDX's offset, in bytes, from the start of
     *   the MP4 container.
     * @param uris The possible locations of the MP4 file that
     *   contains the segments.
     */ 
  static parse(sidxData: BufferSource, sidxOffset: number, uris: string[], initSegmentReference: InitSegmentReference, timestampOffset: number, appendWindowStart: number, appendWindowEnd: number): SegmentReference[] {
    const Mp4SegmentIndexParser = Mp4SegmentIndexParser;
    let references;
    const parser = (new Mp4Parser()).fullBox('sidx',  
    (box) => {
      references = Mp4SegmentIndexParser.parseSIDX_(sidxOffset, initSegmentReference, timestampOffset, appendWindowStart, appendWindowEnd, uris, box);
    });
    if (sidxData) {
      parser.parse(sidxData);
    }
    if (references) {
      return references;
    } else {
      log.error('Invalid box type, expected "sidx".');
      throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA, ErrorExports.Code.MP4_SIDX_WRONG_BOX_TYPE);
    }
  }
   
  /**
     * Parse a SIDX box from the given reader.
     *
     * @param uris The possible locations of the MP4 file that
     *   contains the segments.
     */ 
  private static parseSIDX_(sidxOffset: number, initSegmentReference: InitSegmentReference, timestampOffset: number, appendWindowStart: number, appendWindowEnd: number, uris: string[], box: shaka.extern.ParsedBox): SegmentReference[] {
    asserts.assert(box.version != null, 'SIDX is a full box and should have a valid version.');
    const references = [];
     
    // Parse the SIDX structure.
    // Skip reference_ID (32 bits). 
    box.reader.skip(4);
    const timescale = box.reader.readUint32();
    if (timescale == 0) {
      log.error('Invalid timescale.');
      throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA, ErrorExports.Code.MP4_SIDX_INVALID_TIMESCALE);
    }
    let earliestPresentationTime;
    let firstOffset;
    if (box.version == 0) {
      earliestPresentationTime = box.reader.readUint32();
      firstOffset = box.reader.readUint32();
    } else {
      earliestPresentationTime = box.reader.readUint64();
      firstOffset = box.reader.readUint64();
    }
     
    // Skip reserved (16 bits). 
    box.reader.skip(2);
     
    // Add references. 
    const referenceCount = box.reader.readUint16();
     
    // Subtract the presentation time offset 
    let unscaledStartTime = earliestPresentationTime;
    let startByte = sidxOffset + box.size + firstOffset;
    for (let i = 0; i < referenceCount; i++) {
       
      // |chunk| is 1 bit for |referenceType|, and 31 bits for |referenceSize|. 
      const chunk = box.reader.readUint32();
      const referenceType = (chunk & 2147483648) >>> 31;
      const referenceSize = chunk & 2147483647;
      const subsegmentDuration = box.reader.readUint32();
       
      // Skipping 1 bit for |startsWithSap|, 3 bits for |sapType|, and 28 bits
      // for |sapDelta|. 
      box.reader.skip(4);
       
      // If |referenceType| is 1 then the reference is to another SIDX.
      // We do not support this. 
      if (referenceType == 1) {
        log.error('Heirarchical SIDXs are not supported.');
        throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.MEDIA, ErrorExports.Code.MP4_SIDX_TYPE_NOT_SUPPORTED);
      }
       
      // The media timestamps inside the container. 
      const nativeStartTime = unscaledStartTime / timescale;
      const nativeEndTime = (unscaledStartTime + subsegmentDuration) / timescale;
      references.push(new SegmentReference(nativeStartTime + timestampOffset, nativeEndTime + timestampOffset,  
      () => {
        return uris;
      }, startByte, startByte + referenceSize - 1, initSegmentReference, timestampOffset, appendWindowStart, appendWindowEnd));
      unscaledStartTime += subsegmentDuration;
      startByte += referenceSize;
    }
    box.parser.stop();
    return references;
  }
}
