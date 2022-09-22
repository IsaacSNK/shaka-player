/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Google Cast API externs.
 * Based on the {@link https://bit.ly/CastApi Google Cast API}.
 *
 */
let __onGCastApiAvailable: (p1: boolean) => any;
const cast = {};
//@ts-ignore
cast.receiver = {};
//@ts-ignore
cast.receiver.system = {};
export class SystemVolumeData{
  level: number;
  muted: boolean;
};
export  class CastChannel{
  send(message: any) {}
};
export interface CastMessageBus{
  onMessage: Function;
  broadcast(message: any);
  getCastChannel(senderId: string):CastChannel 
};

/**
 * @struct
 */
export class CastMessageBusEvent{
  data: any;
  senderId: string;
};

export interface CastReceiverManager{
  onSenderConnected: Function;
  onSenderDisconnected: Function;
  onSystemVolumeChanged: Function;

  getInstance():  {}

  getCastMessageBus(namespace: string, messageType?: string):{}

  getSenders(): string[] ;

  start() ;

  stop() ;

  getSystemVolume(): SystemVolumeData|null ;

  setSystemVolumeLevel(level: number);

  setSystemVolumeMuted(muted: number);

  isSystemReady(): boolean;
};
//@ts-ignore
cast.receiver.media = {};
export enum MetadataType {
  GENERIC = 0,
  MOVIE = 1,
  TV_SHOW = 2,
  MUSIC_TRACK = 3,
  PHOTO = 4
};
export interface __platform__{
   canDisplayType(type: string): boolean ;
};
const chrome = {};
export  interface cast{
   isAvailable: boolean;

   initialize(
      apiConfig: ApiConfig, successCallback: Function,
      errorCallback: Function) ;

   requestSession(
      successCallback: Function, errorCallback: Function,
      sessionRequest?: SessionRequest);
};
//@ts-ignore
chrome.cast.SessionStatus = {};
//@ts-ignore
chrome.cast.SessionStatus.STOPPED;
export class ApiConfig {
  constructor(
      sessionRequest: SessionRequest, sessionListener: Function,
      receiverListener: Function, autoJoinPolicy?: string,
      defaultActionPolicy?: string) {}
};
export class castError{
  code: string;
  description: string|null;
  details: Object;

  constructor(code: string, description?: string, details?: Object) {}
};
export interface Receiver {
  friendlyName: string;
};
export class  Session{
  sessionId: string;
  status: string;
  receiver: Receiver;

  addMessageListener(namespace: string, listener: Function) {}

  removeMessageListener(namespace: string, listener: Function) {}

  addUpdateListener(listener: Function) {}

  removeUpdateListener(listener: Function) {}

  leave(successCallback: Function, errorCallback: Function) {}

  sendMessage(
      namespace: string, message: Object|string, successCallback: Function,
      errorCallback: Function) {}

  stop(successCallback: Function, errorCallback: Function) {}
};
export class SessionRequest {
  constructor(
      appId: string, capabilities: Object[], timeout: number|null,
      androidReceiverCompatible: boolean, credentialsData: Object) {}
};
