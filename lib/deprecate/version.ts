/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
 
/**
 * A class that defines what a library version is within the deprecation
 * system. Within deprecation we only care about the major and minor versions.
 *
 * @final
 */ 
export class Version {
  major_: any;
  minor_: any;
   
  constructor(major: number, minor: number) {
    this.major_ = major;
    this.minor_ = minor;
  }
   
  major(): number {
    return this.major_;
  }
   
  minor(): number {
    return this.minor_;
  }
   
  /**
     * Returns:
     *  - positive if |this| > |other|
     *  - zero if |this| == |other|
     *  - negative if |this| < |other|
     *
     */ 
  compareTo(other: Version): number {
    const majorCheck = this.major_ - other.major_;
    const minorCheck = this.minor_ - other.minor_;
    return majorCheck || minorCheck;
  }
   
  /** @override */ 
  toString() {
    return 'v' + this.major_ + '.' + this.minor_;
  }
   
  /**
     * Parse the major and minor values out of a version string that is assumed
     * to follow the grammar: "vMAJOR.MINOR.". What comes after the last "." we
     * will ignore.
     *
     */ 
  static parse(versionString: string): Version {
     
    // Make sure to drop the "v" from the front. We limit the number of splits
    // to two as we don't care what happens after the minor version number.
    // For example: 'a.b.c.d'.split('.', 2) == ['a', 'b'] 
    const components = versionString.substring( 
    /* limit= */ 
    1).split('.', 2);
    return new Version(Number(components[0]), Number(components[1]));
  }
}
