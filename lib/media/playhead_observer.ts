/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  /**
   * A playhead observer is a system that watches for meaningful changes in state
   * that are dependent on playhead information. The observer is responsible for
   * managing its own listeners.
   *
   */
  export class IPlayheadObserver {
    /**
     * Check again (using an update playhead summary) if an event should be fired.
     * If an event should be fired, fire it.
     *
     */
    poll(positionInSeconds: number, wasSeeking: boolean) {}
  }
}

namespace shaka.media {
  /**
   * The playhead observer manager is responsible for owning playhead observer
   * instances and polling them when needed. Destroying the manager will destroy
   * all observers managed by the manager.
   *
   * @final
   */
  export class PlayheadObserverManager implements IReleasable {
    private mediaElement_: HTMLMediaElement;

    /**
     * The set of all observers that this manager is responsible for updating.
     * We are using a set to ensure that we don't double update an observer if
     * it is accidentally added twice.
     *
     */
    private observers_: Set<IPlayheadObserver>;

    /**
     * To fire events semi-accurately, poll the observers 4 times a second. This
     * should be frequent enough to trigger an event close enough to its actual
     * occurrence without the user noticing a delay.
     *
     */
    private pollingLoop_: Timer;

    constructor(mediaElement: HTMLMediaElement) {
      this.mediaElement_ = mediaElement;
      this.observers_ = new Set();
      this.pollingLoop_ = new shaka.util.Timer(() => {
        this.pollAllObservers_(
          /* seeking= */
          false
        );
      }).tickEvery(
        /* seconds= */
        0.25
      );
    }

    /** @override */
    release() {
      // We need to stop the loop or else we may try to use a released resource.
      this.pollingLoop_.stop();
      for (const observer of this.observers_) {
        observer.release();
      }
      this.observers_.clear();
    }

    /**
     * Have the playhead observer manager manage a new observer. This will ensure
     * that observers are only tracked once within the manager. After this call,
     * the manager will be responsible for the life cycle of |observer|.
     *
     */
    manage(observer: IPlayheadObserver) {
      this.observers_.add(observer);
    }

    /**
     * Notify all the observers that we just seeked.
     */
    notifyOfSeek() {
      this.pollAllObservers_(
        /* seeking= */
        true
      );
    }

    private pollAllObservers_(seeking: boolean) {
      for (const observer of this.observers_) {
        observer.poll(this.mediaElement_.currentTime, seeking);
      }
    }
  }
}
