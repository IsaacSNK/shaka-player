/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  /**
   * The region observer watches a region timeline and playhead, and fires events
   * ('enter', 'exit', 'skip') as the playhead moves.
   *
   * @final
   */
  export class RegionObserver
    extends shaka.util.FakeEventTarget
    implements IPlayheadObserver
  {
    private timeline_: RegionTimeline;

    /**
     * A mapping between a region and where we previously were relative to it.
     * When the value here differs from what we calculate, it means we moved and
     * should fire an event.
     *
     * {!Map.<shaka.extern.TimelineRegionInfo,
     *                 shaka.media.RegionObserver.RelativePosition_>}
     */
    private oldPosition_: Map<
      shaka.extern.TimelineRegionInfo,
      RelativePosition_
    >;

    /**
     * A read-only collection of rules for what to do when we change position
     * relative to a region.
     *
     */
    private rules_: Iterable<Rule_>;
    private eventManager_: EventManager;

    /**
     * Create a region observer for the given timeline. The observer does not
     * own the timeline, only uses it. This means that the observer should NOT
     * destroy the timeline.
     *
     */
    constructor(timeline: RegionTimeline) {
      super();
      this.timeline_ = timeline;
      this.oldPosition_ = new Map();

      // To make the rules easier to read, alias all the relative positions.
      const RelativePosition = shaka.media.RegionObserver.RelativePosition_;
      const BEFORE_THE_REGION = RelativePosition.BEFORE_THE_REGION;
      const IN_THE_REGION = RelativePosition.IN_THE_REGION;
      const AFTER_THE_REGION = RelativePosition.AFTER_THE_REGION;
      this.rules_ = [
        {
          weWere: null,
          weAre: IN_THE_REGION,
          invoke: (region, seeking) => this.onEvent_("enter", region, seeking),
        },
        {
          weWere: BEFORE_THE_REGION,
          weAre: IN_THE_REGION,
          invoke: (region, seeking) => this.onEvent_("enter", region, seeking),
        },
        {
          weWere: AFTER_THE_REGION,
          weAre: IN_THE_REGION,
          invoke: (region, seeking) => this.onEvent_("enter", region, seeking),
        },
        {
          weWere: IN_THE_REGION,
          weAre: BEFORE_THE_REGION,
          invoke: (region, seeking) => this.onEvent_("exit", region, seeking),
        },
        {
          weWere: IN_THE_REGION,
          weAre: AFTER_THE_REGION,
          invoke: (region, seeking) => this.onEvent_("exit", region, seeking),
        },
        {
          weWere: BEFORE_THE_REGION,
          weAre: AFTER_THE_REGION,
          invoke: (region, seeking) => this.onEvent_("skip", region, seeking),
        },
        {
          weWere: AFTER_THE_REGION,
          weAre: BEFORE_THE_REGION,
          invoke: (region, seeking) => this.onEvent_("skip", region, seeking),
        },
      ];
      this.eventManager_ = new shaka.util.EventManager();
      this.eventManager_.listen(this.timeline_, "regionremove", (event) => {
        const region: shaka.extern.TimelineRegionInfo = event["region"];
        this.oldPosition_.delete(region);
      });
    }

    /** @override */
    release() {
      this.timeline_ = null;

      // Clear our maps so that we are not holding onto any more information than
      // needed.
      this.oldPosition_.clear();
      this.eventManager_.release();
      this.eventManager_ = null;
      super.release();
    }

    /** @override */
    poll(positionInSeconds, wasSeeking) {
      const RegionObserver = shaka.media.RegionObserver;
      for (const region of this.timeline_.regions()) {
        const previousPosition = this.oldPosition_.get(region);
        const currentPosition = RegionObserver.determinePositionRelativeTo_(
          region,
          positionInSeconds
        );

        // We will only use |previousPosition| and |currentPosition|, so we can
        // update our state now.
        this.oldPosition_.set(region, currentPosition);
        for (const rule of this.rules_) {
          if (
            rule.weWere == previousPosition &&
            rule.weAre == currentPosition
          ) {
            rule.invoke(region, wasSeeking);
          }
        }
      }
    }

    /**
     * Dispatch events of the given type.  All event types in this class have the
     * same parameters: region and seeking.
     *
     */
    private onEvent_(
      eventType: string,
      region: shaka.extern.TimelineRegionInfo,
      seeking: boolean
    ) {
      const event = new shaka.util.FakeEvent(
        eventType,
        new Map([
          ["region", region],
          ["seeking", seeking],
        ])
      );
      this.dispatchEvent(event);
    }

    /**
     * Get the relative position of the playhead to |region| when the playhead is
     * at |seconds|. We treat the region's start and end times as inclusive
     * bounds.
     *
     */
    private static determinePositionRelativeTo_(
      region: shaka.extern.TimelineRegionInfo,
      seconds: number
    ): RelativePosition_ {
      const RelativePosition = shaka.media.RegionObserver.RelativePosition_;
      if (seconds < region.startTime) {
        return RelativePosition.BEFORE_THE_REGION;
      }
      if (seconds > region.endTime) {
        return RelativePosition.AFTER_THE_REGION;
      }
      return RelativePosition.IN_THE_REGION;
    }
  }
}

namespace shaka.media.RegionObserver {
  /**
   * An enum of relative positions between the playhead and a region. Each is
   * phrased so that it works in "The playhead is X" where "X" is any value in
   * the enum.
   *
   */
  export enum RelativePosition_ {
    BEFORE_THE_REGION = 1,
    IN_THE_REGION,
    AFTER_THE_REGION,
  }
}
type EventListener = (p1: shaka.extern.TimelineRegionInfo, p2: boolean) => any;

export { EventListener };

export interface Rule_ {
  weWere: RelativePosition_ | null;
  weAre: RelativePosition_ | null;
  invoke: EventListener;
}

export { Rule_ };
