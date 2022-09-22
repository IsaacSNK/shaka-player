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
cast.receiver = {};
cast.receiver.system = {};
cast.receiver.system.SystemVolumeData = class {
  level: number;
  muted: boolean;
};
export class CastMessageBus{
  onMessage: Function;

  broadcast(message: any) {}

  getCastChannel(senderId: string): cast.receiver.CastChannel {}
};

/**
 * @struct
 */
cast.receiver.CastMessageBus.Event = class {
  data: any;
  senderId: string;
};
export  class CastChannel{
  send(message: any) {}
};
export class CastReceiverManager{
  onSenderConnected: Function;
  onSenderDisconnected: Function;
  onSystemVolumeChanged: Function;

  static getInstance(): cast.receiver.CastReceiverManager {}

  getCastMessageBus(namespace: string, messageType?: string):
      cast.receiver.CastMessageBus {}

  getSenders(): string[] {}

  start() {}

  stop() {}

  getSystemVolume(): cast.receiver.system.SystemVolumeData|null {}

  setSystemVolumeLevel(level: number) {}

  setSystemVolumeMuted(muted: number) {}

  isSystemReady(): boolean {}
};
cast.receiver.media = {};
cast.receiver.media.MetadataType = {
  'GENERIC': 0,
  'MOVIE': 1,
  'TV_SHOW': 2,
  'MUSIC_TRACK': 3,
  'PHOTO': 4
};
export class __platform__{
  static canDisplayType(type: string): boolean {}
};
const chrome = {};
chrome.cast = class {
  static isAvailable: boolean;

  static initialize(
      apiConfig: chrome.cast.ApiConfig, successCallback: Function,
      errorCallback: Function) {}

  static requestSession(
      successCallback: Function, errorCallback: Function,
      sessionRequest?: chrome.cast.SessionRequest) {}
};
chrome.cast.SessionStatus = {};
chrome.cast.SessionStatus.STOPPED;
chrome.cast.ApiConfig = class {
  constructor(
      sessionRequest: chrome.cast.SessionRequest, sessionListener: Function,
      receiverListener: Function, autoJoinPolicy?: string,
      defaultActionPolicy?: string) {}
};
chrome.cast.Error = class {
  code: string;
  description: string|null;
  details: Object;

  constructor(code: string, description?: string, details?: Object) {}
};
chrome.cast.Receiver = class {
  friendlyName: string;
};
export class  Session{
  sessionId: string;
  status: string;
  receiver: chrome.cast.Receiver;

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
