/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{ArrayUtils}from './array_utils';
 
/**
 * @export
 */ 
export class Cue implements shaka.extern.Cue {
   
  /**
       * @override
       * @exportInterface
       */ 
  direction: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  region: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  position: any = null;
   
  /**
       * @override
       * @exportInterface
       */ 
  positionAlign: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  size: any = 0;
   
  /**
       * @override
       * @exportInterface
       */ 
  textAlign: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  writingMode: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  lineInterpretation: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  line: any = null;
   
  /**
       * @override
       * @exportInterface
       */ 
  lineHeight: any = '';
   
  /**
       * Line Alignment is set to start by default.
       * @override
       * @exportInterface
       */ 
  lineAlign: any;
   
  /**
       * Set the captions at the bottom of the text container by default.
       * @override
       * @exportInterface
       */ 
  displayAlign: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  color: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  backgroundColor: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  backgroundImage: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  border: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  textShadow: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  textStrokeColor: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  textStrokeWidth: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  fontSize: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  fontWeight: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  fontStyle: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  fontFamily: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  letterSpacing: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  linePadding: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  opacity: any = 1;
   
  /**
       * @override
       * @exportInterface
       */ 
  textDecoration: any = [];
   
  /**
       * @override
       * @exportInterface
       */ 
  wrapLine: any = true;
   
  /**
       * @override
       * @exportInterface
       */ 
  id: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  nestedCues: any = [];
   
  /**
       * @override
       * @exportInterface
       */ 
  isContainer: any = false;
   
  /**
       * @override
       * @exportInterface
       */ 
  lineBreak: any = false;
   
  /**
       * @override
       * @exportInterface
       */ 
  cellResolution: any = {columns:32, rows:15};
   
  constructor(public startTime: number, public endTime: number, public payload: string) {
    const Cue = Cue;
    this.direction = Cue.direction.HORIZONTAL_LEFT_TO_RIGHT;
    this.region = new CueRegion();
    this.positionAlign = Cue.positionAlign.AUTO;
    this.textAlign = Cue.textAlign.CENTER;
    this.writingMode = Cue.writingMode.HORIZONTAL_TOP_TO_BOTTOM;
    this.lineInterpretation = Cue.lineInterpretation.LINE_NUMBER;
    this.lineAlign = Cue.lineAlign.START;
    this.displayAlign = Cue.displayAlign.AFTER;
    this.fontWeight = Cue.fontWeight.NORMAL;
    this.fontStyle = Cue.fontStyle.NORMAL;
  }
   
  static lineBreak(start: number, end: number): Cue {
    const cue = new Cue(start, end, '');
    cue.lineBreak = true;
    return cue;
  }
   
  /**
     * Create a copy of the cue with the same properties.
     * @suppress {checkTypes} since we must use [] and "in" with a struct type.
     */ 
  clone(): Cue {
    const clone = new Cue(0, 0, '');
    for (const k in this) {
      clone[k] = this[k];
       
      // Make copies of array fields, but only one level deep.  That way, if we
      // change, for instance, textDecoration on the clone, we don't affect the
      // original. 
      if (clone[k] && clone[k].constructor == Array) {
        clone[k] = (clone[k] as Array).slice();
      }
    }
    return clone;
  }
   
  /**
     * Check if two Cues have all the same values in all properties.
     * @suppress {checkTypes} since we must use [] and "in" with a struct type.
     */ 
  static equal(cue1: Cue, cue2: Cue): boolean {
     
    // Compare the start time, end time and payload of the cues first for
    // performance optimization.  We can avoid the more expensive recursive
    // checks if the top-level properties don't match.
    // See: https://github.com/shaka-project/shaka-player/issues/3018 
    if (cue1.startTime != cue2.startTime || cue1.endTime != cue2.endTime || cue1.payload != cue2.payload) {
      return false;
    }
    for (const k in cue1) {
       
      // Already compared. 
      if (k == 'startTime' || k == 'endTime' || k == 'payload') {
      } else {
        if (k == 'nestedCues') {
           
          // This uses shaka.text.Cue.equal rather than just this.equal, since
          // otherwise recursing here will unbox the method and cause "this" to be
          // undefined in deeper recursion. 
          if (!ArrayUtils.equal(cue1.nestedCues, cue2.nestedCues, Cue.equal)) {
            return false;
          }
        } else {
          if (k == 'region' || k == 'cellResolution') {
            for (const k2 in cue1[k]) {
              if (cue1[k][k2] != cue2[k][k2]) {
                return false;
              }
            }
          } else {
            if (Array.isArray(cue1[k])) {
              if (!ArrayUtils.equal(cue1[k], cue2[k])) {
                return false;
              }
            } else {
              if (cue1[k] != cue2[k]) {
                return false;
              }
            }
          }
        }
      }
    }
    return true;
  }
}
 
/**
 * @export
 */ 
export enum positionAlign {
  LEFT = 'line-left',
  RIGHT = 'line-right',
  CENTER = 'center',
  AUTO = 'auto'
}
 
/**
 * @export
 */ 
export enum textAlign {
  LEFT = 'left',
  RIGHT = 'right',
  CENTER = 'center',
  START = 'start',
  END = 'end'
}
 
/**
 * Vertical alignments of the cues within their extents.
 * 'BEFORE' means displaying at the top of the captions container box, 'CENTER'
 *  means in the middle, 'AFTER' means at the bottom.
 * @export
 */ 
export enum displayAlign {
  BEFORE = 'before',
  CENTER = 'center',
  AFTER = 'after'
}
 
/**
 * @export
 */ 
export enum direction {
  HORIZONTAL_LEFT_TO_RIGHT = 'ltr',
  HORIZONTAL_RIGHT_TO_LEFT = 'rtl'
}
 
/**
 * @export
 */ 
export enum writingMode {
  HORIZONTAL_TOP_TO_BOTTOM = 'horizontal-tb',
  VERTICAL_LEFT_TO_RIGHT = 'vertical-lr',
  VERTICAL_RIGHT_TO_LEFT = 'vertical-rl'
}
 
/**
 * @export
 */ 
export enum lineInterpretation {
  LINE_NUMBER,
  PERCENTAGE
}
 
/**
 * @export
 */ 
export enum lineAlign {
  CENTER = 'center',
  START = 'start',
  END = 'end'
}
 
/**
 * Default text color according to
 * https://w3c.github.io/webvtt/#default-text-color
 * @export
 */ 
export enum defaultTextColor {
  white = '#FFF',
  lime = '#0F0',
  cyan = '#0FF',
  red = '#F00',
  yellow = '#FF0',
  magenta = '#F0F',
  blue = '#00F',
  black = '#000'
}
 
/**
 * Default text background color according to
 * https://w3c.github.io/webvtt/#default-text-background
 * @export
 */ 
export enum defaultTextBackgroundColor {
  bg_white = '#FFF',
  bg_lime = '#0F0',
  bg_cyan = '#0FF',
  bg_red = '#F00',
  bg_yellow = '#FF0',
  bg_magenta = '#F0F',
  bg_blue = '#00F',
  bg_black = '#000'
}
 
/**
 * In CSS font weight can be a number, where 400 is normal and 700 is bold.
 * Use these values for the enum for consistency.
 * @export
 */ 
export enum fontWeight {
  NORMAL = 400,
  BOLD = 700
}
 
/**
 * @export
 */ 
export enum fontStyle {
  NORMAL = 'normal',
  ITALIC = 'italic',
  OBLIQUE = 'oblique'
}
 
/**
 * @export
 */ 
export enum textDecoration {
  UNDERLINE = 'underline',
  LINE_THROUGH = 'lineThrough',
  OVERLINE = 'overline'
}
 
/**
 * @struct
 * @export
 */ 
export class CueRegion implements shaka.extern.CueRegion {
   
  /**
       * @override
       * @exportInterface
       */ 
  id: any = '';
   
  /**
       * @override
       * @exportInterface
       */ 
  viewportAnchorX: any = 0;
   
  /**
       * @override
       * @exportInterface
       */ 
  viewportAnchorY: any = 0;
   
  /**
       * @override
       * @exportInterface
       */ 
  regionAnchorX: any = 0;
   
  /**
       * @override
       * @exportInterface
       */ 
  regionAnchorY: any = 0;
   
  /**
       * @override
       * @exportInterface
       */ 
  width: any = 100;
   
  /**
       * @override
       * @exportInterface
       */ 
  height: any = 100;
   
  /**
       * @override
       * @exportInterface
       */ 
  heightUnits: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  widthUnits: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  viewportAnchorUnits: any;
   
  /**
       * @override
       * @exportInterface
       */ 
  scroll: any;
   
  constructor() {
    const CueRegion = CueRegion;
    this.heightUnits = CueRegion.units.PERCENTAGE;
    this.widthUnits = CueRegion.units.PERCENTAGE;
    this.viewportAnchorUnits = CueRegion.units.PERCENTAGE;
    this.scroll = CueRegion.scrollMode.NONE;
  }
}
 
/**
 * @export
 */ 
export enum units {
  PX,
  PERCENTAGE,
  LINES
}
 
/**
 * @export
 */ 
export enum scrollMode {
  NONE = '',
  UP = 'up'
}
