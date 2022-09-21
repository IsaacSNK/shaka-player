/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{Error}from './error';
import*as ErrorExports from './error';
 
/**
 * HLS playlist class.
 */ 
export class Playlist {
  type: PlaylistType;
  tags: Tag[];
  segments: Segment[];
   
  /**
     * @param absoluteUri An absolute, final URI after redirects.
     */ 
  constructor(public readonly absoluteUri: string, type: PlaylistType, tags: Tag[], segments?: Segment[]) {
    this.type = type;
    this.tags = tags;
    this.segments = segments || null;
  }
}
 
export enum PlaylistType {
  MASTER,
  MEDIA
}
 
/**
 * HLS tag class.
 */ 
export class Tag {
  name: any;
   
  constructor(public readonly id: number, public name: string, public readonly attributes: Attribute[], public readonly value: string | null = null) {
  }
   
  /**
     * Create the string representation of the tag.
     *
     * For the DRM system - the full tag needs to be passed down to the CDM.
     * There are two ways of doing this (1) save the original tag or (2) recreate
     * the tag.
     * As in some cases (like in tests) the tag never existed in string form, it
     * is far easier to recreate the tag from the parsed form.
     *
     * @override
     */ 
  toString(): string {
    const attrToStr =  
    (attr: Attribute): string => {
      const isNumericAttr = !isNaN(Number(attr.value));
      const value = isNumericAttr ? attr.value : '"' + attr.value + '"';
      return attr.name + '=' + value;
    };
     
    // A valid tag can only follow 1 of 4 patterns.
    //  1) <NAME>:<VALUE>
    //  2) <NAME>:<ATTRIBUTE LIST>
    //  3) <NAME>
    //  4) <NAME>:<VALUE>,<ATTRIBUTE_LIST> 
    let tagStr = '#' + this.name;
    const appendages = this.attributes ? this.attributes.map(attrToStr) : [];
    if (this.value) {
      appendages.unshift(this.value);
    }
    if (appendages.length > 0) {
      tagStr += ':' + appendages.join(',');
    }
    return tagStr;
  }
   
  /**
     * Adds an attribute to an HLS Tag.
     *
     */ 
  addAttribute(attribute: Attribute) {
    this.attributes.push(attribute);
  }
   
  /**
     * Gets the first attribute of the tag with a specified name.
     *
     * @return attribute
     */ 
  getAttribute(name: string): Attribute | null {
    const attributes = this.attributes.filter( 
    (attr) => {
      return attr.name == name;
    });
    asserts.assert(attributes.length < 2, 'A tag should not have multiple attributes ' + 'with the same name!');
    if (attributes.length) {
      return attributes[0];
    } else {
      return null;
    }
  }
   
  /**
     * Gets the value of the first attribute of the tag with a specified name.
     * If not found, returns an optional default value.
     *
     */ 
  getAttributeValue(name: string, defaultValue?: string): string | null {
    const attribute = this.getAttribute(name);
    return attribute ? attribute.value : defaultValue || null;
  }
   
  /**
     * Finds the attribute and returns its value.
     * Throws an error if attribute was not found.
     *
     */ 
  getRequiredAttrValue(name: string): string {
    const attribute = this.getAttribute(name);
    if (!attribute) {
      throw new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST, ErrorExports.Code.HLS_REQUIRED_ATTRIBUTE_MISSING, name);
    }
    return attribute.value;
  }
   
  /**
     * Set the name of the tag. Used only for Preload hinted MAP tag.
     */ 
  setName(name: string) {
    this.name = name;
  }
}
 
/**
 * HLS segment class.
 */ 
export class Segment {
   
  /**
     * Creates an HLS segment object.
     *
     * @param absoluteUri An absolute URI.
     */ 
  constructor(public readonly absoluteUri: string, public readonly tags: Tag[], public partialSegments: Tag[] = []) {
  }
}
 
/**
 * HLS Attribute class.
 */ 
export class Attribute {
   
  /**
     * Creates an HLS attribute object.
     *
     */ 
  constructor(public readonly name: string, public readonly value: string) {
  }
}
