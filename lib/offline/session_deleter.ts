/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './debug___log';
import {log} from './debug___log';
import * as DrmEngineExports from './media___drm_engine';
import {DrmEngine} from './media___drm_engine';
import * as NetworkingEngineExports from './net___networking_engine';
import {NetworkingEngine} from './net___networking_engine';
import {ArrayUtils} from './util___array_utils';

/**
 * Contains a utility method to delete persistent EME sessions.
 */
export class SessionDeleter {
  /**
   * Deletes the given sessions.  This never fails and instead logs the error.
   *
   * @return The session IDs that were deleted.
   */
  async delete(
      config: shaka.extern.DrmConfiguration, netEngine: NetworkingEngine,
      sessions: shaka.extern.EmeSessionDB[]): Promise<string[]> {
    const SessionDeleter = SessionDeleter;
    let deleted = [];
    for (const bucket of SessionDeleter.createBuckets_(sessions)) {
      // Run these sequentially to avoid creating multiple CDM instances at one
      // time.  Some embedded platforms may not support multiples.
      const p = this.doDelete_(config, netEngine, bucket);
      const cur = await p;

      // eslint-disable-line no-await-in-loop
      deleted = deleted.concat(cur);
    }
    return deleted;
  }

  /**
   * Performs the deletion of the given session IDs.
   *
   * @return The sessions that were deleted
   */
  private async doDelete_(
      config: shaka.extern.DrmConfiguration, netEngine: NetworkingEngine,
      bucket: Bucket_): Promise<string[]> {
    const drmEngine: DrmEngine = new DrmEngine({
      netEngine: netEngine,
      onError: () => {},
      onKeyStatus: () => {},
      onExpirationUpdated: () => {},
      onEvent: () => {}
    });
    try {
      drmEngine.configure(config);
      await drmEngine.initForRemoval(
          bucket.info.keySystem, bucket.info.licenseUri,
          bucket.info.serverCertificate, bucket.info.audioCapabilities,
          bucket.info.videoCapabilities);
    } catch (e) {
      log.warning('Error initializing EME', e);
      await drmEngine.destroy();
      return [];
    }
    try {
      await drmEngine.setServerCertificate();
    } catch (e) {
      log.warning('Error setting server certificate', e);
      await drmEngine.destroy();
      return [];
    }
    const sessionIds: string[] = [];
    await Promise.all(bucket.sessionIds.map(async (sessionId) => {
      // This method is in a .map(), so this starts multiple removes at once,
      // so this removes the sessions in parallel.
      try {
        await drmEngine.removeSession(sessionId);
        sessionIds.push(sessionId);
      } catch (e) {
        log.warning('Error deleting offline session', e);
      }
    }));
    await drmEngine.destroy();
    return sessionIds;
  }

  /**
   * Collects the given sessions into buckets that can be done at the same time.
   * Since querying with different parameters can give us back different CDMs,
   * we can't just use one CDM instance to delete everything.
   *
   */
  private static createBuckets_(sessions: shaka.extern.EmeSessionDB[]):
      Bucket_[] {
    const SessionDeleter = SessionDeleter;
    const ret: Bucket_[] = [];
    for (const session of sessions) {
      let found = false;
      for (const bucket of ret) {
        if (SessionDeleter.isCompatible_(bucket.info, session)) {
          bucket.sessionIds.push(session.sessionId);
          found = true;
          break;
        }
      }
      if (!found) {
        ret.push({info: session, sessionIds: [session.sessionId]});
      }
    }
    return ret;
  }

  /**
   * Returns whether the given session infos are compatible with each other.
   */
  private static isCompatible_(
      a: shaka.extern.EmeSessionDB, b: shaka.extern.EmeSessionDB): boolean {
    const ArrayUtils = ArrayUtils;

    // TODO: Add a way to change the license server in DrmEngine to avoid
    // resetting EME for different license servers.
    const comp = (x, y) =>
        x.robustness == y.robustness && x.contentType == y.contentType;
    return a.keySystem == b.keySystem && a.licenseUri == b.licenseUri &&
        ArrayUtils.hasSameElements(
            a.audioCapabilities, b.audioCapabilities, comp) &&
        ArrayUtils.hasSameElements(
            a.videoCapabilities, b.videoCapabilities, comp);
  }
}
type Bucket_ = {
  info: shaka.extern.EmeSessionDB,
  sessionIds: string[]
};

export {Bucket_};
