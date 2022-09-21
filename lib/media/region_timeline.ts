/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{FakeEvent}from './fake_event';
import*as FakeEventExports from './fake_event';
import{FakeEventTarget}from './fake_event_target';
import*as FakeEventTargetExports from './fake_event_target';
import{IReleasable}from './i_releasable';
import{Timer}from './timer';
 
/**
 * The region timeline is a set of unique timeline region info entries. When
 * a new entry is added, the 'regionadd' event will be fired.  When an entry is
 * deleted, the 'regionremove' event will be fired.
 *
 * @final
 */ 
export class RegionTimeline extends FakeEventTarget implements IReleasable {
  private regions_: Set<shaka.extern.TimelineRegionInfo>;
  private getSeekRange_: () => {start:number, end:number};
   
  /**
       * Make sure all of the regions we're tracking are within the
       * seek range or further in the future. We don't want to store
       * regions that fall before the start of the seek range.
       *
       */ 
  private filterTimer_: Timer;
   
  constructor(getSeekRange: () => {start:number, end:number}) {
    super();
    this.regions_ = new Set();
    this.getSeekRange_ = getSeekRange;
    this.filterTimer_ = (new Timer( 
    () => {
      this.filterBySeekRange_();
    })).tickEvery(REGION_FILTER_INTERVAL);
  }
   
  /** @override */ 
  release() {
    this.regions_.clear();
    this.filterTimer_.stop();
    super.release();
  }
   
  addRegion(region: shaka.extern.TimelineRegionInfo) {
    const similarRegion = this.findSimilarRegion_(region);
     
    // Make sure we don't add duplicate regions. We keep track of this here
    // instead of making the parser track it. 
    if (similarRegion == null) {
      this.regions_.add(region);
      const event = new FakeEvent('regionadd', new Map([['region', region]]));
      this.dispatchEvent(event);
    }
  }
   
  private filterBySeekRange_() {
    const seekRange = this.getSeekRange_();
    for (const region of this.regions_) {
       
      // Only consider the seek range start here.
      // Future regions might become relevant eventually,
      // but regions that are in the past and can't ever be
      // seeked to will never come up again, and there's no
      // reson to store or process them. 
      if (region.endTime < seekRange.start) {
        this.regions_.delete(region);
        const event = new FakeEvent('regionremove', new Map([['region', region]]));
        this.dispatchEvent(event);
      }
    }
  }
   
  /**
     * Find a region in the timeline that has the same scheme id uri, event id,
     * start time and end time. If these four parameters match, we assume it
     * to be the same region. If no similar region can be found, |null| will be
     * returned.
     *
     */ 
  private findSimilarRegion_(region: shaka.extern.TimelineRegionInfo): shaka.extern.TimelineRegionInfo | null {
    for (const existing of this.regions_) {
       
      // The same scheme ID and time range means that it is similar-enough to
      // be the same region. 
      const isSimilar = existing.schemeIdUri == region.schemeIdUri && existing.id == region.id && existing.startTime == region.startTime && existing.endTime == region.endTime;
      if (isSimilar) {
        return existing;
      }
    }
    return null;
  }
   
  /**
     * Get an iterable for all the regions in the timeline. This will allow
     * others to see what regions are in the timeline while not being able to
     * change the collection.
     *
     */ 
  regions(): Iterable<shaka.extern.TimelineRegionInfo> {
    return this.regions_;
  }
}
 
export const REGION_FILTER_INTERVAL: number = 2;
 
// in seconds 
