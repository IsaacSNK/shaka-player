/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
import{NetworkingEngine}from './networking_engine';
import*as NetworkingEngineExports from './networking_engine';
import{OfflineUri}from './offline_uri';
import{StorageMuxer}from './storage_muxer';
import*as StorageMuxerExports from './storage_muxer';
import{AbortableOperation}from './abortable_operation';
import{Error}from './error';
import*as ErrorExports from './error';
 
/**
 * @summary A plugin that handles requests for offline content.
 * @export
 */ 
export class OfflineScheme {
   
  /**
     * @param progressUpdated Called when a
     *   progress event happened.
     * @export
     */ 
  static plugin(uri: string, request: shaka.extern.Request, requestType: NetworkingEngineExports.RequestType, progressUpdated: shaka.extern.ProgressUpdated): shaka.extern.IAbortableOperation<shaka.extern.Response> {
    const offlineUri = OfflineUri.parse(uri);
    if (offlineUri && offlineUri.isManifest()) {
      return OfflineScheme.getManifest_(uri);
    }
    if (offlineUri && offlineUri.isSegment()) {
      return OfflineScheme.getSegment_(offlineUri.key(), offlineUri);
    }
    return AbortableOperation.failed(new Error(ErrorExports.Severity.CRITICAL, ErrorExports.Category.NETWORK, ErrorExports.Code.MALFORMED_OFFLINE_URI, uri));
  }
   
  private static getManifest_(uri: string): shaka.extern.IAbortableOperation<shaka.extern.Response> {
    const response: shaka.extern.Response = {uri:uri, originalUri:uri, data:new ArrayBuffer(0), headers:{'content-type':'application/x-offline-manifest'}};
    return AbortableOperation.completed(response);
  }
   
  private static getSegment_(id: number, uri: OfflineUri): shaka.extern.IAbortableOperation<shaka.extern.Response> {
    asserts.assert(uri.isSegment(), "Only segment uri's should be given to getSegment");
    const muxer: StorageMuxer = new StorageMuxer();
    return AbortableOperation.completed(undefined).chain( 
    () => muxer.init()).chain( 
    () => muxer.getCell(uri.mechanism(), uri.cell())).chain( 
    (cell) => cell.getSegments([uri.key()])).chain( 
    (segments) => {
      const segment = segments[0];
      return {uri:uri, data:segment.data, headers:{}};
    }).finally( 
    () => muxer.destroy());
  }
}
NetworkingEngine.registerScheme('offline', OfflineScheme.plugin);
