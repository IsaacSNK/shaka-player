/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{log}from './log';
import*as logExports from './log';
import{Cue}from './cue';
import*as CueExports from './cue';
import{CueRegion}from './cue';
import*as CueRegionExports from './cue';
import{TextEngine}from './text_engine';
import*as TextEngineExports from './text_engine';
import{Error}from './error';
import*as ErrorExports from './error';
import{StringUtils}from './string_utils';
import*as StringUtilsExports from './string_utils';
import{TextParser}from './text_parser';
import{XmlUtils}from './xml_utils';
 
/**
 * @export
 */ 
export class VttTextParser implements shaka.extern.TextParser {
  private sequenceMode_: boolean = false;
   
  /** Constructs a VTT parser. */ 
  constructor() {
  }
   
  /**
     * @override
     * @export
     */ 
  parseInit(data) {
    asserts.assert(false, 'VTT does not have init segments');
  }
   
  /**
     * @override
     * @export
     */ 
  setSequenceMode(sequenceMode) {
    this.sequenceMode_ = sequenceMode;
  }
   
  /**
     * @override
     * @export
     */ 
  parseMedia(data, time) {
    const VttTextParser = VttTextParser;
     
    // Get the input as a string.  Normalize newlines to \n. 
    let str = StringUtils.fromUTF8(data);
    str = str.replace(/\r\n|\r(?=[^\n]|$)/gm, '\n');
    const blocks = str.split(/\n{2,}/m);
    if (!/^WEBVTT($|[ \t\n])/m.test(blocks[0])) {
      throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT, ErrorExports.Code.INVALID_TEXT_HEADER);
    }
     
    // Depending on "segmentRelativeVttTiming" configuration,
    // "vttOffset" will correspond to either "periodStart" (default)
    // or "segmentStart", for segmented VTT where timings are relative
    // to the beginning of each segment.
    // NOTE: "periodStart" is the timestamp offset applied via TextEngine.
    // It is no longer closely tied to periods, but the name stuck around.
    // NOTE: This offset and the flag choosing its meaning have no effect on
    // HLS content, which should use X-TIMESTAMP-MAP and periodStart instead. 
    let offset = time.vttOffset;
     
    // Only use 'X-TIMESTAMP-MAP' in sequence mode, as that is currently
    // shorthand for HLS.  Note that an offset based on the first video
    // timestamp has already been extracted, and appears in periodStart.
    // The relative offset from X-TIMESTAMP-MAP will be added to that for HLS. 
    if (blocks[0].includes('X-TIMESTAMP-MAP') && this.sequenceMode_) {
       
      // https://bit.ly/2K92l7y
      // The 'X-TIMESTAMP-MAP' header is used in HLS to align text with
      // the rest of the media.
      // The header format is 'X-TIMESTAMP-MAP=MPEGTS:n,LOCAL:m'
      // (the attributes can go in any order)
      // where n is MPEG-2 time and m is cue time it maps to.
      // For example 'X-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:900000'
      // means an offset of 10 seconds
      // 900000/MPEG_TIMESCALE - cue time. 
      const cueTimeMatch = blocks[0].match(/LOCAL:((?:(\d{1,}):)?(\d{2}):(\d{2})\.(\d{3}))/m);
      const mpegTimeMatch = blocks[0].match(/MPEGTS:(\d+)/m);
      if (cueTimeMatch && mpegTimeMatch) {
        const parser = new TextParser(cueTimeMatch[1]);
        const cueTime = VttTextParser.parseTime_(parser);
        if (cueTime == null) {
          throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT, ErrorExports.Code.INVALID_TEXT_HEADER);
        }
        let mpegTime = Number(mpegTimeMatch[1]);
        const mpegTimescale = MPEG_TIMESCALE_;
        const rolloverSeconds = TS_ROLLOVER_ / mpegTimescale;
        let segmentStart = time.segmentStart;
        while (segmentStart >= rolloverSeconds) {
          segmentStart -= rolloverSeconds;
          mpegTime += TS_ROLLOVER_;
        }
        offset = time.periodStart + mpegTime / mpegTimescale - cueTime;
      }
    }
     
    // Parse VTT regions.
    /* !Array.<!shaka.extern.CueRegion> */ 
    const regions = [];
    for (const line of blocks[0].split('\n')) {
      if (/^Region:/.test(line)) {
        const region = VttTextParser.parseRegion_(line);
        regions.push(region);
      }
    }
    const styles: Map<string, Cue> = new Map();
    VttTextParser.addDefaultTextColor_(styles);
     
    // Parse cues. 
    const ret = [];
    for (const block of blocks.slice(1)) {
      const lines = block.split('\n');
      VttTextParser.parseStyle_(lines, styles);
      const cue = VttTextParser.parseCue_(lines, offset, regions, styles);
      if (cue) {
        ret.push(cue);
      }
    }
    return ret;
  }
   
  /**
     * Add default color
     *
     */ 
  private static addDefaultTextColor_(styles: Map<string, Cue>) {
    const textColor = CueExports.defaultTextColor;
    for (const [key, value] of Object.entries(textColor)) {
      const cue = new Cue(0, 0, '');
      cue.color = value;
      styles.set(key, cue);
    }
    const bgColor = CueExports.defaultTextBackgroundColor;
    for (const [key, value] of Object.entries(bgColor)) {
      const cue = new Cue(0, 0, '');
      cue.backgroundColor = value;
      styles.set(key, cue);
    }
  }
   
  /**
     * Parses a string into a Region object.
     *
     */ 
  private static parseRegion_(text: string): shaka.extern.CueRegion {
    const VttTextParser = VttTextParser;
    const parser = new TextParser(text);
     
    // The region string looks like this:
    // Region: id=fred width=50% lines=3 regionanchor=0%,100%
    //         viewportanchor=10%,90% scroll=up 
    const region = new CueRegion();
     
    // Skip 'Region:' 
    parser.readWord();
    parser.skipWhitespace();
    let word = parser.readWord();
    while (word) {
      if (!VttTextParser.parseRegionSetting_(region, word)) {
        log.warning('VTT parser encountered an invalid VTTRegion setting: ', word, ' The setting will be ignored.');
      }
      parser.skipWhitespace();
      word = parser.readWord();
    }
    return region;
  }
   
  /**
     * Parses a style block into a Cue object.
     *
     */ 
  private static parseStyle_(text: string[], styles: Map<string, Cue>) {
     
    // Skip empty blocks. 
    if (text.length == 1 && !text[0]) {
      return;
    }
     
    // Skip comment blocks. 
    if (/^NOTE($|[ \t])/.test(text[0])) {
      return;
    }
     
    // Only style block are allowed. 
    if (text[0] != 'STYLE') {
      return;
    }
    if (!text[1].includes('::cue')) {
      return;
    }
    let styleSelector = 'global';
     
    // Look for what is within parentisesis. For example:
    // <code>:: cue (b) {</code>, what we are looking for is <code>b</code> 
    const selector = text[1].match(/\((.*)\)/);
    if (selector) {
      styleSelector = selector.pop();
    }
     
    // We start at 2 to avoid '::cue' and end earlier to avoid '}' 
    let propertyLines = text.slice(2, -1);
    if (text[1].includes('}')) {
      const payload = /\{(.*?)\}/.exec(text[1]);
      if (payload) {
        propertyLines = payload[1].split(';');
      }
    }
    const cue = new Cue(0, 0, '');
    let validStyle = false;
    for (let i = 0; i < propertyLines.length; i++) {
       
      // We look for CSS properties. As a general rule they are separated by
      // <code>:</code>. Eg: <code>color: red;</code> 
      const lineParts = /^\s*([^:]+):\s*(.*)/.exec(propertyLines[i]);
      if (lineParts) {
        const name = lineParts[1].trim();
        const value = lineParts[2].trim().replace(';', '');
        switch(name) {
          case 'background-color':
            validStyle = true;
            cue.backgroundColor = value;
            break;
          case 'color':
            validStyle = true;
            cue.color = value;
            break;
          case 'font-family':
            validStyle = true;
            cue.fontFamily = value;
            break;
          case 'font-size':
            validStyle = true;
            cue.fontSize = value;
            break;
          case 'font-weight':
            if (parseInt(value, 10) >= 700) {
              validStyle = true;
              cue.fontWeight = CueExports.fontWeight.BOLD;
            }
            break;
          case 'font-style':
            switch(value) {
              case 'normal':
                validStyle = true;
                cue.fontStyle = CueExports.fontStyle.NORMAL;
                break;
              case 'italic':
                validStyle = true;
                cue.fontStyle = CueExports.fontStyle.ITALIC;
                break;
              case 'oblique':
                validStyle = true;
                cue.fontStyle = CueExports.fontStyle.OBLIQUE;
                break;
            }break;
          case 'opacity':
            validStyle = true;
            cue.opacity = parseFloat(value);
            break;
          case 'text-shadow':
            validStyle = true;
            cue.textShadow = value;
            break;
          case 'white-space':
            validStyle = true;
            cue.wrapLine = value != 'noWrap';
            break;
          default:
            log.warning('VTT parser encountered an unsupported style: ', lineParts);
            break;
        }
      }
    }
    if (validStyle) {
      styles.set(styleSelector, cue);
    }
  }
   
  /**
     * Parses a text block into a Cue object.
     *
     */ 
  private static parseCue_(text: string[], timeOffset: number, regions: shaka.extern.CueRegion[], styles: Map<string, Cue>): Cue {
    const VttTextParser = VttTextParser;
     
    // Skip empty blocks. 
    if (text.length == 1 && !text[0]) {
      return null;
    }
     
    // Skip comment blocks. 
    if (/^NOTE($|[ \t])/.test(text[0])) {
      return null;
    }
     
    // Skip style blocks. 
    if (text[0] == 'STYLE') {
      return null;
    }
    let id = null;
    if (!text[0].includes('--\x3e')) {
      id = text[0];
      text.splice(0, 1);
    }
     
    // Parse the times. 
    const parser = new TextParser(text[0]);
    let start = VttTextParser.parseTime_(parser);
    const expect = parser.readRegex(/[ \t]+--\x3e[ \t]+/g);
    let end = VttTextParser.parseTime_(parser);
    if (start == null || expect == null || end == null) {
      throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT, ErrorExports.Code.INVALID_TEXT_CUE, 'Could not parse cue time range in WebVTT');
    }
    start += timeOffset;
    end += timeOffset;
     
    // Get the payload. 
    const payload = text.slice(1).join('\n').trim();
    let cue = null;
    if (styles.has('global')) {
      cue = styles.get('global').clone();
      cue.startTime = start;
      cue.endTime = end;
      cue.payload = '';
    } else {
      cue = new Cue(start, end, '');
    }
    VttTextParser.parseCueStyles(payload, cue, styles);
     
    // Parse optional settings. 
    parser.skipWhitespace();
    let word = parser.readWord();
    while (word) {
      if (!VttTextParser.parseCueSetting(cue, word, regions)) {
        log.warning('VTT parser encountered an invalid VTT setting: ', word, ' The setting will be ignored.');
      }
      parser.skipWhitespace();
      word = parser.readWord();
    }
    if (id != null) {
      cue.id = id;
    }
    return cue;
  }
   
  /**
     * Parses a WebVTT styles from the given payload.
     *
     */ 
  static parseCueStyles(payload: string, rootCue: Cue, styles: Map<string, Cue>) {
    const VttTextParser = VttTextParser;
    if (styles.size === 0) {
      VttTextParser.addDefaultTextColor_(styles);
    }
    payload = VttTextParser.replaceColorPayload_(payload);
    payload = VttTextParser.replaceKaraokeStylePayload_(payload);
    const xmlPayload = '<span>' + payload + '</span>';
    const element = XmlUtils.parseXmlString(xmlPayload, 'span');
    if (element) {
      const cues: shaka.extern.Cue[] = [];
      const childNodes = element.childNodes;
      if (childNodes.length == 1) {
        const childNode = childNodes[0];
        if (childNode.nodeType == Node.TEXT_NODE || childNode.nodeType == Node.CDATA_SECTION_NODE) {
          rootCue.payload = payload;
          return;
        }
      }
      for (const childNode of childNodes) {
        VttTextParser.generateCueFromElement_(childNode, rootCue, cues, styles);
      }
      rootCue.nestedCues = cues;
    } else {
      log.warning("The cue's markup could not be parsed: ", payload);
      rootCue.payload = payload;
    }
  }
   
  /**
     * Converts karaoke style tag to be valid for xml parsing
     * For example,
     * input: Text <00:00:00.450> time <00:00:01.450> 1
     * output: Text <div time="00:00:00.450"> time
     *         <div time="00:00:01.450"> 1</div></div>
     *
     * @return processed payload
     */ 
  private static replaceKaraokeStylePayload_(payload: string): string {
    const names = [];
    let nameStart = -1;
    for (let i = 0; i < payload.length; i++) {
      if (payload[i] === '<') {
        nameStart = i + 1;
      } else {
        if (payload[i] === '>') {
          if (nameStart > 0) {
            const name = payload.substr(nameStart, i - nameStart);
            if (name.match(timeFormat_)) {
              names.push(name);
            }
            nameStart = -1;
          }
        }
      }
    }
    let newPayload = payload;
    for (const name of names) {
      const replaceTag = '<' + name + '>';
      const startTag = '<div time="' + name + '">';
      const endTag = '</div>';
      newPayload = newPayload.replace(replaceTag, startTag);
      newPayload += endTag;
    }
    return newPayload;
  }
   
  /**
     * Converts color end tag to be valid for xml parsing
     * For example,
     * input: <c.yellow.bg_blue>Yellow text on blue bg</c>
     * output: <c.yellow.bg_blue>Yellow text on blue bg</c.yellow.bg_blue>
     *
     * Returns original payload if invalid tag is found.
     * Invalid tag example: <c.yellow><b>Example</c></b>
     *
     * @return processed payload
     */ 
  private static replaceColorPayload_(payload: string): string {
    const names = [];
    let nameStart = -1;
    let newPayload = '';
    for (let i = 0; i < payload.length; i++) {
      if (payload[i] === '/') {
        const end = payload.indexOf('>', i);
        if (end <= i) {
          return payload;
        }
        const tagEnd = payload.substring(i + 1, end);
        const tagStart = names.pop();
        if (!tagEnd || !tagStart) {
          return payload;
        } else {
          if (tagStart === tagEnd) {
            newPayload += '/' + tagEnd + '>';
            i += tagEnd.length + 1;
          } else {
            if (!tagStart.startsWith('c.') || tagEnd !== 'c') {
              return payload;
            }
            newPayload += '/' + tagStart + '>';
            i += tagEnd.length + 1;
          }
        }
      } else {
        if (payload[i] === '<') {
          nameStart = i + 1;
        } else {
          if (payload[i] === '>') {
            if (nameStart > 0) {
              names.push(payload.substr(nameStart, i - nameStart));
              nameStart = -1;
            }
          }
        }
        newPayload += payload[i];
      }
    }
    return newPayload;
  }
   
  private static getOrDefault_(value: string, defaultValue: string) {
    if (value && value.length > 0) {
      return value;
    }
    return defaultValue;
  }
   
  /**
     * Merges values created in parseStyle_
     */ 
  private static mergeStyle_(cue: shaka.extern.Cue, refCue: shaka.extern.Cue) {
    if (!refCue) {
      return;
    }
    const VttTextParser = VttTextParser;
     
    // Overwrites if new value string length > 0 
    cue.backgroundColor = VttTextParser.getOrDefault_(refCue.backgroundColor, cue.backgroundColor);
    cue.color = VttTextParser.getOrDefault_(refCue.color, cue.color);
    cue.fontFamily = VttTextParser.getOrDefault_(refCue.fontFamily, cue.fontFamily);
    cue.fontSize = VttTextParser.getOrDefault_(refCue.fontSize, cue.fontSize);
     
    // Overwrite with new values as unable to determine
    // if new value is set or not 
    cue.fontWeight = refCue.fontWeight;
    cue.fontStyle = refCue.fontStyle;
    cue.opacity = refCue.opacity;
    cue.wrapLine = refCue.wrapLine;
  }
   
  private static generateCueFromElement_(element: Node, rootCue: Cue, cues: shaka.extern.Cue[], styles: Map<string, Cue>) {
    const VttTextParser = VttTextParser;
    const nestedCue = rootCue.clone();
    if (element.nodeType === Node.ELEMENT_NODE && element.nodeName) {
      const bold = CueExports.fontWeight.BOLD;
      const italic = CueExports.fontStyle.ITALIC;
      const underline = CueExports.textDecoration.UNDERLINE;
      const tags = element.nodeName.split(/[ .]+/);
      for (const tag of tags) {
        if (styles.has(tag)) {
          VttTextParser.mergeStyle_(nestedCue, styles.get(tag));
        }
        switch(tag) {
          case 'b':
            nestedCue.fontWeight = bold;
            break;
          case 'i':
            nestedCue.fontStyle = italic;
            break;
          case 'u':
            nestedCue.textDecoration.push(underline);
            break;
          case 'div':
            {
              const time = (element as Element).getAttribute('time');
              if (!time) {
                break;
              }
              const parser = new TextParser(time);
              const cueTime = VttTextParser.parseTime_(parser);
              if (cueTime) {
                nestedCue.startTime = cueTime;
              }
              break;
            }
          default:
            break;
        }
      }
    }
    const isTextNode = XmlUtils.isText(element);
    if (isTextNode) {
       
      // Trailing line breaks may lost when convert cue to HTML tag
      // Need to insert line break cue to preserve line breaks 
      const textArr = element.textContent.split('\n');
      let isFirst = true;
      for (const text of textArr) {
        if (!isFirst) {
          const lineBreakCue = rootCue.clone();
          lineBreakCue.lineBreak = true;
          cues.push(lineBreakCue);
        }
        if (text.length > 0) {
          const textCue = nestedCue.clone();
          textCue.payload = text;
          cues.push(textCue);
        }
        isFirst = false;
      }
    } else {
      for (const childNode of element.childNodes) {
        VttTextParser.generateCueFromElement_(childNode, nestedCue, cues, styles);
      }
    }
  }
   
  /**
     * Parses a WebVTT setting from the given word.
     *
     * @return True on success.
     */ 
  static parseCueSetting(cue: Cue, word: string, regions: CueRegion[]): boolean {
    const VttTextParser = VttTextParser;
    let results = null;
    if (results = /^align:(start|middle|center|end|left|right)$/.exec(word)) {
      VttTextParser.setTextAlign_(cue, results[1]);
    } else {
      if (results = /^vertical:(lr|rl)$/.exec(word)) {
        VttTextParser.setVerticalWritingMode_(cue, results[1]);
      } else {
        if (results = /^size:([\d.]+)%$/.exec(word)) {
          cue.size = Number(results[1]);
        } else {
          if (results = /^position:([\d.]+)%(?:,(line-left|line-right|center|start|end))?$/.exec(word)) {
            cue.position = Number(results[1]);
            if (results[2]) {
              VttTextParser.setPositionAlign_(cue, results[2]);
            }
          } else {
            if (results = /^region:(.*)$/.exec(word)) {
              const region = VttTextParser.getRegionById_(regions, results[1]);
              if (region) {
                cue.region = region;
              }
            } else {
              return VttTextParser.parsedLineValueAndInterpretation_(cue, word);
            }
          }
        }
      }
    }
    return true;
  }
   
  private static getRegionById_(regions: CueRegion[], id: string): CueRegion | null {
    const regionsWithId = regions.filter( 
    (region) => {
      return region.id == id;
    });
    if (!regionsWithId.length) {
      log.warning('VTT parser could not find a region with id: ', id, ' The region will be ignored.');
      return null;
    }
    asserts.assert(regionsWithId.length == 1, 'VTTRegion ids should be unique!');
    return regionsWithId[0];
  }
   
  /**
     * Parses a WebVTTRegion setting from the given word.
     *
     * @return True on success.
     */ 
  private static parseRegionSetting_(region: CueRegion, word: string): boolean {
    let results = null;
    if (results = /^id=(.*)$/.exec(word)) {
      region.id = results[1];
    } else {
      if (results = /^width=(\d{1,2}|100)%$/.exec(word)) {
        region.width = Number(results[1]);
      } else {
        if (results = /^lines=(\d+)$/.exec(word)) {
          region.height = Number(results[1]);
          region.heightUnits = CueRegionExports.units.LINES;
        } else {
          if (results = /^regionanchor=(\d{1,2}|100)%,(\d{1,2}|100)%$/.exec(word)) {
            region.regionAnchorX = Number(results[1]);
            region.regionAnchorY = Number(results[2]);
          } else {
            if (results = /^viewportanchor=(\d{1,2}|100)%,(\d{1,2}|100)%$/.exec(word)) {
              region.viewportAnchorX = Number(results[1]);
              region.viewportAnchorY = Number(results[2]);
            } else {
              if (results = /^scroll=up$/.exec(word)) {
                region.scroll = CueRegionExports.scrollMode.UP;
              } else {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  }
   
  private static setTextAlign_(cue: Cue, align: string) {
    const Cue = Cue;
    if (align == 'middle') {
      cue.textAlign = Cue.textAlign.CENTER;
    } else {
      asserts.assert(align.toUpperCase() in Cue.textAlign, align.toUpperCase() + ' Should be in Cue.textAlign values!');
      cue.textAlign = Cue.textAlign[align.toUpperCase()];
    }
  }
   
  private static setPositionAlign_(cue: Cue, align: string) {
    const Cue = Cue;
    if (align == 'line-left' || align == 'start') {
      cue.positionAlign = Cue.positionAlign.LEFT;
    } else {
      if (align == 'line-right' || align == 'end') {
        cue.positionAlign = Cue.positionAlign.RIGHT;
      } else {
        cue.positionAlign = Cue.positionAlign.CENTER;
      }
    }
  }
   
  private static setVerticalWritingMode_(cue: Cue, value: string) {
    const Cue = Cue;
    if (value == 'lr') {
      cue.writingMode = Cue.writingMode.VERTICAL_LEFT_TO_RIGHT;
    } else {
      cue.writingMode = Cue.writingMode.VERTICAL_RIGHT_TO_LEFT;
    }
  }
   
  private static parsedLineValueAndInterpretation_(cue: Cue, word: string): boolean {
    const Cue = Cue;
    let results = null;
    if (results = /^line:([\d.]+)%(?:,(start|end|center))?$/.exec(word)) {
      cue.lineInterpretation = Cue.lineInterpretation.PERCENTAGE;
      cue.line = Number(results[1]);
      if (results[2]) {
        asserts.assert(results[2].toUpperCase() in Cue.lineAlign, results[2].toUpperCase() + ' Should be in Cue.lineAlign values!');
        cue.lineAlign = Cue.lineAlign[results[2].toUpperCase()];
      }
    } else {
      if (results = /^line:(-?\d+)(?:,(start|end|center))?$/.exec(word)) {
        cue.lineInterpretation = Cue.lineInterpretation.LINE_NUMBER;
        cue.line = Number(results[1]);
        if (results[2]) {
          asserts.assert(results[2].toUpperCase() in Cue.lineAlign, results[2].toUpperCase() + ' Should be in Cue.lineAlign values!');
          cue.lineAlign = Cue.lineAlign[results[2].toUpperCase()];
        }
      } else {
        return false;
      }
    }
    return true;
  }
   
  /**
     * Parses a WebVTT time from the given parser.
     *
     */ 
  private static parseTime_(parser: TextParser): number | null {
    const results = parser.readRegex(timeFormat_);
    if (results == null) {
      return null;
    }
     
    // This capture is optional, but will still be in the array as undefined,
    // in which case it is 0. 
    const hours = Number(results[1]) || 0;
    const minutes = Number(results[2]);
    const seconds = Number(results[3]);
    const milliseconds = Number(results[4]);
    if (minutes > 59 || seconds > 59) {
      return null;
    }
    return milliseconds / 1000 + seconds + minutes * 60 + hours * 3600;
  }
}
 
export const MPEG_TIMESCALE_: number = 90000;
 
/**
 * At this value, timestamps roll over in TS content.
 */ 
export const TS_ROLLOVER_: number = 8589934592;
 
/**
 * @example 00:00.000 or 00:00:00.000 or 0:00:00.000 or
 * 00:00.00 or 00:00:00.00 or 0:00:00.00
 */ 
export const timeFormat_: RegExp = /(?:(\d{1,}):)?(\d{2}):(\d{2})\.(\d{2,3})/g;
TextEngine.registerParser('text/vtt',  
() => new VttTextParser());
TextEngine.registerParser('text/vtt; codecs="vtt"',  
() => new VttTextParser());
TextEngine.registerParser('text/vtt; codecs="wvtt"',  
() => new VttTextParser());
