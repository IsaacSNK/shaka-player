/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.deprecate {
  /**
   * The enforcer's job is to call the correct callback when a feature will need
   * to be removed later or removed now.
   *
   * The "what should be done" is not part of the enforcer, that must be provided
   * to the enforcer when it is created. This separation was created so that
   * testing and production could be equal users of the enforcer.
   *
   * @final
   */
  export class Enforcer {
    private libraryVersion_: Version;
    private onPending_: shaka.deprecate.Listener;
    private onExpired_: shaka.deprecate.Listener;

    constructor(
      libraryVersion: Version,
      onPending: shaka.deprecate.Listener,
      onExpired: shaka.deprecate.Listener
    ) {
      this.libraryVersion_ = libraryVersion;
      this.onPending_ = onPending;
      this.onExpired_ = onExpired;
    }

    /**
     * Tell the enforcer that a feature will expire on |expiredOn| and that it
     * should notify the listeners if it is pending or expired.
     *
     */
    enforce(expiresOn: Version, name: string, description: string) {
      // If the expiration version is larger than the library version
      // (compareTo > 0), it means the expiration is in the future, and is still
      // pending.
      const isPending = expiresOn.compareTo(this.libraryVersion_) > 0;

      // Find the right callback (pending or expired) for this enforcement request
      // call it to handle this features pending/expired removal.
      const callback = isPending ? this.onPending_ : this.onExpired_;
      callback(this.libraryVersion_, expiresOn, name, description);
    }
  }
}
type Listener = (p1: Version, p2: Version, p3: string, p4: string) => any;
