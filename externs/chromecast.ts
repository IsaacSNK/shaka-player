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
declare var __onGCastApiAvailable: (p1: boolean) => any;

declare namespace cast.receiver.system {
  class SystemVolumeData {
    level: number;
    muted: boolean;
  }
}
declare namespace cast.receiver {
  class CastMessageBus {
    broadcast(message: any);

    getCastChannel(senderId: string): cast.receiver.CastChannel;

    onMessage(): void;
  }
}

declare namespace cast.receiver.CastMessageBus {
  class Event {
    data: any;
    senderId: string;
  }
}

declare namespace cast.receiver {
  class CastChannel {
    send(message: any);
  }
}

declare namespace cast.receiver {
  class CastReceiverManager {
    onSenderConnected: Function;
    onSenderDisconnected: Function;
    onSystemVolumeChanged: Function;

    static getInstance(): cast.receiver.CastReceiverManager;

    getCastMessageBus(
      namespace: string,
      messageType?: string
    ): cast.receiver.CastMessageBus;

    getSenders(): string[];

    start();

    stop();

    getSystemVolume(): cast.receiver.system.SystemVolumeData | null;

    setSystemVolumeLevel(level: number);

    setSystemVolumeMuted(muted: number);

    isSystemReady(): boolean;
  }
}

declare namespace cast.receiver.media {
  enum MetadataType {
    GENERIC,
    MOVIE,
    TV_SHOW,
    MUSIC_TRACK,
    PHOTO
  }
}

declare namespace cast {
  class __platform__ {
    static canDisplayType(type: string): boolean;
  }
}
declare namespace chrome {
  class cast {
    static initialize(
      apiConfig: chrome.cast.ApiConfig,
      successCallback: Function,
      errorCallback: Function
    );

    static requestSession(
      successCallback: Function,
      errorCallback: Function,
      sessionRequest?: chrome.cast.SessionRequest
    );

    isAvailable: boolean;
  }
}
declare namespace chrome.cast {
  type SessionStatus = {
    STOPPED: string;
  }
}

declare namespace chrome.cast {
  class ApiConfig {
    constructor(
      sessionRequest: chrome.cast.SessionRequest,
      sessionListener: Function,
      receiverListener: Function,
      autoJoinPolicy?: string,
      defaultActionPolicy?: string
    );
  }
}
declare namespace chrome.cast {
  class Error {
    code: string;
    description: string | null;
    details: Object;

    constructor(code: string, description?: string, details?: Object);
  }
}
declare namespace chrome.cast {
  class Receiver {
    friendlyName: string;
  }
}

declare namespace chrome.cast {
  class Session {
    sessionId: string;
    status: string;
    receiver: chrome.cast.Receiver;

    addMessageListener(namespace: string, listener: Function);

    removeMessageListener(namespace: string, listener: Function);

    addUpdateListener(listener: Function);

    removeUpdateListener(listener: Function);

    leave(successCallback: Function, errorCallback: Function);

    sendMessage(
      namespace: string,
      message: Object | string,
      successCallback: Function,
      errorCallback: Function
    );

    stop(successCallback: Function, errorCallback: Function);
  }
}
declare namespace chrome.cast {
  class SessionRequest {
    constructor(
      appId: string,
      capabilities: Object[],
      timeout: number | null,
      androidReceiverCompatible: boolean,
      credentialsData: Object
    );
  }
}
