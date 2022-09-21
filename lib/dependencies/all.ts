/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
 
/**
 * @export
 */ 
export class dependencies {
   
  /**
     * Registers a new dependency.
     *
     * @param key which is used for retrieving a
     *   dependency
     * @param dep a dependency
     * @export
     */ 
  static add(key: Allowed, dep: any) {
    if (!Allowed[key]) {
      throw new Error(`${key} is not supported`);
    }
    dependencies_.set(key,  
    () => dep);
  }
   
  /**
     * Check if we have a dependency for the key.
     *
     * @param key key
     * @export
     */ 
  static has(key: Allowed): boolean {
    return dependencies_.has(key);
  }
   
  static muxjs(): muxjs | null {
    return (dependencies_.get(Allowed.muxjs)() as muxjs | null);
  }
}
 
/**
 * @export
 */ 
export enum Allowed {
  muxjs = 'muxjs'
}
 
/**
 * Contains accessor functions to shared dependencies that could be used by
 * other components.  The default accessors can be overridden.
 *
 */ 
export const dependencies_: Map<Allowed, () => any> = new Map([[Allowed.muxjs,  
() => window.muxjs]]);
