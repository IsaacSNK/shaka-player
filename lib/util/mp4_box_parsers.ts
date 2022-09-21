/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{DataViewReader}from './data_view_reader';
import*as DataViewReaderExports from './data_view_reader';
 
export 
class Mp4BoxParsers {
   
  /**
     * Parses a TFHD Box.
     */ 
  static parseTFHD(reader: DataViewReader, flags: number): ParsedTFHDBox {
    let defaultSampleDuration = null;
    let defaultSampleSize = null;
    const trackId =  
    // Read "track_ID" 
    reader.readUint32();
     
    // Skip "base_data_offset" if present. 
    if (flags & 1) {
      reader.skip(8);
    }
     
    // Skip "sample_description_index" if present. 
    if (flags & 2) {
      reader.skip(4);
    }
     
    // Read "default_sample_duration" if present. 
    if (flags & 8) {
      defaultSampleDuration = reader.readUint32();
    }
     
    // Read "default_sample_size" if present. 
    if (flags & 16) {
      defaultSampleSize = reader.readUint32();
    }
    return {trackId, defaultSampleDuration, defaultSampleSize};
  }
   
  /**
     * Parses a TFDT Box.
     */ 
  static parseTFDT(reader: DataViewReader, version: number): ParsedTFDTBox {
    const baseMediaDecodeTime = version == 1 ? reader.readUint64() : reader.readUint32();
    return {baseMediaDecodeTime};
  }
   
  /**
     * Parses a MDHD Box.
     */ 
  static parseMDHD(reader: DataViewReader, version: number): ParsedMDHDBox {
    if (version == 1) {
      reader.skip( 
      // Skip "creation_time" 
      8);
      reader.skip( 
      // Skip "modification_time" 
      8);
    } else {
      reader.skip( 
      // Skip "creation_time" 
      4);
      reader.skip( 
      // Skip "modification_time" 
      4);
    }
    const timescale = reader.readUint32();
    return {timescale};
  }
   
  /**
     * Parses a TREX Box.
     */ 
  static parseTREX(reader: DataViewReader): ParsedTREXBox {
    reader.skip( 
    // Skip "track_ID" 
    4);
    reader.skip( 
    // Skip "default_sample_description_index" 
    4);
    const defaultSampleDuration = reader.readUint32();
    const defaultSampleSize = reader.readUint32();
    return {defaultSampleDuration, defaultSampleSize};
  }
   
  /**
     * Parses a TRUN Box.
     */ 
  static parseTRUN(reader: DataViewReader, version: number, flags: number): ParsedTRUNBox {
    const sampleCount = reader.readUint32();
    const sampleData = [];
     
    // Skip "data_offset" if present. 
    if (flags & 1) {
      reader.skip(4);
    }
     
    // Skip "first_sample_flags" if present. 
    if (flags & 4) {
      reader.skip(4);
    }
    for (let i = 0; i < sampleCount; i++) {
      const sample: ParsedTRUNSample = {sampleDuration:null, sampleSize:null, sampleCompositionTimeOffset:null};
       
      // Read "sample duration" if present. 
      if (flags & 256) {
        sample.sampleDuration = reader.readUint32();
      }
       
      // Read "sample_size" if present. 
      if (flags & 512) {
        sample.sampleSize = reader.readUint32();
      }
       
      // Skip "sample_flags" if present. 
      if (flags & 1024) {
        reader.skip(4);
      }
       
      // Read "sample_time_offset" if present. 
      if (flags & 2048) {
        sample.sampleCompositionTimeOffset = version == 0 ? reader.readUint32() : reader.readInt32();
      }
      sampleData.push(sample);
    }
    return {sampleCount, sampleData};
  }
   
  /**
     * Parses a TKHD Box.
     */ 
  static parseTKHD(reader: DataViewReader, version: number): ParsedTKHDBox {
    let trackId = 0;
    if (version == 1) {
      reader.skip( 
      // Skip "creation_time" 
      8);
      reader.skip( 
      // Skip "modification_time" 
      8);
      trackId = reader.readUint32();
    } else {
      reader.skip( 
      // Skip "creation_time" 
      4);
      reader.skip( 
      // Skip "modification_time" 
      4);
      trackId = reader.readUint32();
    }
    return {trackId};
  }
}
 
export 
interface ParsedTFHDBox {
  trackId: number;
  defaultSampleDuration: number | null;
  defaultSampleSize: number | null;
}
 
export 
interface ParsedTFDTBox {
  baseMediaDecodeTime: number;
}
 
export 
interface ParsedMDHDBox {
  timescale: number;
}
 
export 
interface ParsedTREXBox {
  defaultSampleDuration: number;
  defaultSampleSize: number;
}
 
export 
interface ParsedTRUNBox {
  sampleCount: number;
  sampleData: ParsedTRUNSample[];
}
 
export 
interface ParsedTRUNSample {
  sampleDuration: number | null;
  sampleSize: number | null;
  sampleCompositionTimeOffset: number | null;
}
 
export 
interface ParsedTKHDBox {
  trackId: number;
}
