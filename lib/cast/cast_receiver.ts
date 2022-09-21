/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */ 
import{asserts}from './asserts';
import*as assertsExports from './asserts';
goog.require('shaka.Player');
import{CastUtils}from './cast_utils';
import*as CastUtilsExports from './cast_utils';
import{log}from './log';
import*as logExports from './log';
import{Error}from './error';
import*as ErrorExports from './error';
import{EventManager}from './event_manager';
import*as EventManagerExports from './event_manager';
import{FakeEvent}from './fake_event';
import*as FakeEventExports from './fake_event';
import{FakeEventTarget}from './fake_event_target';
import*as FakeEventTargetExports from './fake_event_target';
import{IDestroyable}from './i_destroyable';
import{Platform}from './platform';
import*as PlatformExports from './platform';
import{Timer}from './timer';
 
/**
 * A receiver to communicate between the Chromecast-hosted player and the
 * sender application.
 *
 * @export
 */ 
export class CastReceiver extends FakeEventTarget implements IDestroyable {
  private video_: HTMLMediaElement;
  private player_: shaka.Player;
  private eventManager_: EventManager;
  private targets_: Object;
  private appDataCallback_: ((p1: Object) => any) | null;
  private contentIdCallback_: ((p1: string) => string) | null;
   
  /**
       * A Cast metadata object, one of:
       *  - https://developers.google.com/cast/docs/reference/messages#GenericMediaMetadata
       *  - https://developers.google.com/cast/docs/reference/messages#MovieMediaMetadata
       *  - https://developers.google.com/cast/docs/reference/messages#TvShowMediaMetadata
       *  - https://developers.google.com/cast/docs/reference/messages#MusicTrackMediaMetadata
       */ 
  private metadata_: Object = null;
  private isConnected_: boolean = false;
  private isIdle_: boolean = true;
  private updateNumber_: number = 0;
  private startUpdatingUpdateNumber_: boolean = false;
  private initialStatusUpdatePending_: boolean = true;
  private shakaBus_: cast.receiver.CastMessageBus = null;
  private genericBus_: cast.receiver.CastMessageBus = null;
  private pollTimer_: Timer;
   
  /**
     * @param video The local video element associated with
     *   the local Player instance.
     * @param player A local Player instance.
     * @param appDataCallback A callback to handle
     *   application-specific data passed from the sender.  This can come either
     *   from a Shaka-based sender through CastProxy.setAppData, or from a
     *   sender using the customData field of the LOAD message of the standard
     *   Cast message namespace.  It can also be null if no such data is sent.
     * @param contentIdCallback A callback to
     *   retrieve manifest URI from the provided content id.
     */ 
  constructor(video: HTMLMediaElement, player: shaka.Player, appDataCallback?: (p1: Object) => any, contentIdCallback?: (p1: string) => string) {
    super();
    this.video_ = video;
    this.player_ = player;
    this.eventManager_ = new EventManager();
    this.targets_ = {'video':video, 'player':player};
    this.appDataCallback_ = appDataCallback ||  
    (() => {
    });
    this.contentIdCallback_ = contentIdCallback ||  
    ((contentId: string): string => contentId);
    this.pollTimer_ = new Timer( 
    () => {
      this.pollAttributes_();
    });
    this.init_();
  }
   
  /**
     * @return True if the cast API is available and there are
     *   receivers.
     * @export
     */ 
  isConnected(): boolean {
    return this.isConnected_;
  }
   
  /**
     * @return True if the receiver is not currently doing loading or
     *   playing anything.
     * @export
     */ 
  isIdle(): boolean {
    return this.isIdle_;
  }
   
  /**
     * Set all Cast content metadata, as defined by the Cast SDK.
     * Should be called from an appDataCallback.
     *
     * For a simpler way to set basic metadata, see:
     *  - setContentTitle()
     *  - setContentImage()
     *  - setContentArtist()
     *
     *   A Cast metadata object, one of:
     *    - https://developers.google.com/cast/docs/reference/messages#GenericMediaMetadata
     *    - https://developers.google.com/cast/docs/reference/messages#MovieMediaMetadata
     *    - https://developers.google.com/cast/docs/reference/messages#TvShowMediaMetadata
     *    - https://developers.google.com/cast/docs/reference/messages#MusicTrackMediaMetadata
     * @export
     */ 
  setContentMetadata(metadata: Object) {
    this.metadata_ = metadata;
  }
   
  /**
     * Clear all Cast content metadata.
     * Should be called from an appDataCallback.
     *
     * @export
     */ 
  clearContentMetadata() {
    this.metadata_ = null;
  }
   
  /**
     * Set the Cast content's title.
     * Should be called from an appDataCallback.
     *
     * @export
     */ 
  setContentTitle(title: string) {
    if (!this.metadata_) {
      this.metadata_ = {'metadataType':cast.receiver.media.MetadataType.GENERIC};
    }
    this.metadata_['title'] = title;
  }
   
  /**
     * Set the Cast content's thumbnail image.
     * Should be called from an appDataCallback.
     *
     * @export
     */ 
  setContentImage(imageUrl: string) {
    if (!this.metadata_) {
      this.metadata_ = {'metadataType':cast.receiver.media.MetadataType.GENERIC};
    }
    this.metadata_['images'] = [{'url':imageUrl}];
  }
   
  /**
     * Set the Cast content's artist.
     * Also sets the metadata type to music.
     * Should be called from an appDataCallback.
     *
     * @export
     */ 
  setContentArtist(artist: string) {
    if (!this.metadata_) {
      this.metadata_ = {};
    }
    this.metadata_['artist'] = artist;
    this.metadata_['metadataType'] = cast.receiver.media.MetadataType.MUSIC_TRACK;
  }
   
  /**
     * Destroys the underlying Player, then terminates the cast receiver app.
     *
     * @override
     * @export
     */ 
  async destroy() {
    if (this.eventManager_) {
      this.eventManager_.release();
      this.eventManager_ = null;
    }
    const waitFor = [];
    if (this.player_) {
      waitFor.push(this.player_.destroy());
      this.player_ = null;
    }
    if (this.pollTimer_) {
      this.pollTimer_.stop();
      this.pollTimer_ = null;
    }
    this.video_ = null;
    this.targets_ = null;
    this.appDataCallback_ = null;
    this.isConnected_ = false;
    this.isIdle_ = true;
    this.shakaBus_ = null;
    this.genericBus_ = null;
     
    // FakeEventTarget implements IReleasable 
    super.release();
    await Promise.all(waitFor);
    const manager = cast.receiver.CastReceiverManager.getInstance();
    manager.stop();
  }
   
  private init_() {
    const manager = cast.receiver.CastReceiverManager.getInstance();
    manager.onSenderConnected =  
    () => this.onSendersChanged_();
    manager.onSenderDisconnected =  
    () => this.onSendersChanged_();
    manager.onSystemVolumeChanged =  
    () => this.fakeVolumeChangeEvent_();
    this.genericBus_ = manager.getCastMessageBus(CastUtilsExports.GENERIC_MESSAGE_NAMESPACE);
    this.genericBus_.onMessage =  
    (event) => this.onGenericMessage_(event);
    this.shakaBus_ = manager.getCastMessageBus(CastUtilsExports.SHAKA_MESSAGE_NAMESPACE);
    this.shakaBus_.onMessage =  
    (event) => this.onShakaMessage_(event);
    if (goog.DEBUG) {
       
      // Sometimes it is useful to load the receiver app in Chrome to work on
      // the UI.  To avoid log spam caused by the SDK trying to connect to web
      // sockets that don't exist, in uncompiled mode we check if the hosting
      // browser is a Chromecast before starting the receiver manager.  We
      // wouldn't do browser detection except for debugging, so only do this in
      // uncompiled mode. 
      if (Platform.isChromecast()) {
        manager.start();
      }
    } else {
      manager.start();
    }
    for (const name of CastUtilsExports.VideoEvents) {
      this.eventManager_.listen(this.video_, name,  
      (event) => this.proxyEvent_('video', event));
    }
    for (const key in FakeEventExports.EventName) {
      const name = FakeEventExports.EventName[key];
      this.eventManager_.listen(this.player_, name,  
      (event) => this.proxyEvent_('player', event));
    }
     
    // In our tests, the original Chromecast seems to have trouble decoding
    // above 1080p.  It would be a waste to select a higher res anyway, given
    // that the device only outputs 1080p to begin with. 
     
    // Chromecast has an extension to query the device/display's resolution. 
    if (cast.__platform__ && cast.__platform__.canDisplayType('video/mp4; codecs="avc1.640028"; width=3840; height=2160')) {
       
      // The device and display can both do 4k.  Assume a 4k limit. 
      this.player_.setMaxHardwareResolution(3840, 2160);
    } else {
       
      // Chromecast has always been able to do 1080p.  Assume a 1080p limit. 
      this.player_.setMaxHardwareResolution(1920, 1080);
    }
     
    // Do not start excluding values from update messages until the video is
    // fully loaded. 
    this.eventManager_.listen(this.video_, 'loadeddata',  
    () => {
      this.startUpdatingUpdateNumber_ = true;
    });
     
    // Maintain idle state. 
    this.eventManager_.listen(this.player_, 'loading',  
    () => {
       
      // No longer idle once loading.  This allows us to show the spinner during
      // the initial buffering phase. 
      this.isIdle_ = false;
      this.onCastStatusChanged_();
    });
    this.eventManager_.listen(this.video_, 'playing',  
    () => {
       
      // No longer idle once playing.  This allows us to replay a video without
      // reloading. 
      this.isIdle_ = false;
      this.onCastStatusChanged_();
    });
    this.eventManager_.listen(this.video_, 'pause',  
    () => {
      this.onCastStatusChanged_();
    });
    this.eventManager_.listen(this.player_, 'unloading',  
    () => {
       
      // Go idle when unloading content. 
      this.isIdle_ = true;
      this.onCastStatusChanged_();
    });
    this.eventManager_.listen(this.video_, 'ended',  
    () => {
       
      // Go idle 5 seconds after 'ended', assuming we haven't started again or
      // been destroyed. 
      const timer = new Timer( 
      () => {
        if (this.video_ && this.video_.ended) {
          this.isIdle_ = true;
          this.onCastStatusChanged_();
        }
      });
      timer.tickAfter(IDLE_INTERVAL);
    });
  }
   
  // Do not start polling until after the sender's 'init' message is handled. 
  private onSendersChanged_() {
     
    // Reset update message frequency values, to make sure whomever joined
    // will get a full update message. 
    this.updateNumber_ = 0;
     
    // Don't reset startUpdatingUpdateNumber_, because this operation does not
    // result in new data being loaded. 
    this.initialStatusUpdatePending_ = true;
    const manager = cast.receiver.CastReceiverManager.getInstance();
    this.isConnected_ = manager.getSenders().length != 0;
    this.onCastStatusChanged_();
  }
   
  /**
     * Dispatch an event to notify the receiver app that the status has changed.
     */ 
  private async onCastStatusChanged_() {
     
    // Do this asynchronously so that synchronous changes to idle state (such as
    // Player calling unload() as part of load()) are coalesced before the event
    // goes out. 
    await Promise.resolve();
    if (!this.player_) {
       
      // We've already been destroyed. 
      return;
    }
    const event = new FakeEvent('caststatuschanged');
    this.dispatchEvent(event);
     
    // Send a media status message, with a media info message if appropriate. 
    if (!this.maybeSendMediaInfoMessage_()) {
      this.sendMediaStatus_();
    }
  }
   
  /**
     * Take on initial state from the sender.
     */ 
  private async initState_(initState: CastUtilsExports.InitStateType, appData: Object) {
     
    // Take on player state first. 
    for (const k in initState['player']) {
      const v = initState['player'][k];
       
      // All player state vars are setters to be called. 
      (this.player_ as Object)[k](v);
    }
     
    // Now process custom app data, which may add additional player configs: 
    this.appDataCallback_(appData);
    const autoplay = this.video_.autoplay;
     
    // Now load the manifest, if present. 
    if (initState['manifest']) {
       
      // Don't autoplay the content until we finish setting up initial state. 
      this.video_.autoplay = false;
      try {
        await this.player_.load(initState['manifest'], initState['startTime']);
      } catch (error) {
         
        // Pass any errors through to the app. 
        asserts.assert(error instanceof Error, 'Wrong error type!');
        const eventType = FakeEventExports.EventName.Error;
        const data = (new Map()).set('detail', error);
        const event = new FakeEvent(eventType, data);
         
        // Only dispatch the event if the player still exists. 
        if (this.player_) {
          this.player_.dispatchEvent(event);
        }
        return;
      }
    } else {
       
      // Ensure the below happens async. 
      await Promise.resolve();
    }
    if (!this.player_) {
       
      // We've already been destroyed. 
      return;
    }
     
    // Finally, take on video state and player's "after load" state. 
    for (const k in initState['video']) {
      const v = initState['video'][k];
      this.video_[k] = v;
    }
    for (const k in initState['playerAfterLoad']) {
      const v = initState['playerAfterLoad'][k];
       
      // All player state vars are setters to be called. 
      (this.player_ as Object)[k](v);
    }
     
    // Restore original autoplay setting. 
    this.video_.autoplay = autoplay;
    if (initState['manifest']) {
       
      // Resume playback with transferred state. 
      this.video_.play();
       
      // Notify generic controllers of the state change. 
      this.sendMediaStatus_();
    }
  }
   
  private proxyEvent_(targetName: string, event: Event) {
    if (!this.player_) {
       
      // The receiver is destroyed, so it should ignore further events. 
      return;
    }
     
    // Poll and send an update right before we send the event.  Some events
    // indicate an attribute change, so that change should be visible when the
    // event is handled. 
    this.pollAttributes_();
    this.sendMessage_({'type':'event', 'targetName':targetName, 'event':event}, this.shakaBus_);
  }
   
  private pollAttributes_() {
     
    // The poll timer may have been pre-empted by an event (e.g. timeupdate).
    // Calling |start| will cancel any pending calls and therefore will avoid us
    // polling too often. 
    this.pollTimer_.tickAfter(POLL_INTERVAL);
    const update = {'video':{}, 'player':{}};
    for (const name of CastUtilsExports.VideoAttributes) {
      update['video'][name] = this.video_[name];
    }
     
    // TODO: Instead of this variable frequency update system, instead cache the
    // previous player state and only send over changed values, with complete
    // updates every ~20 updates to account for dropped messages. 
    if (this.player_.isLive()) {
      const PlayerGetterMethodsThatRequireLive = CastUtilsExports.PlayerGetterMethodsThatRequireLive;
      for (const name in PlayerGetterMethodsThatRequireLive) {
        const frequency = PlayerGetterMethodsThatRequireLive[name];
        if (this.updateNumber_ % frequency == 0) {
          update['player'][name] = (this.player_ as Object)[name]();
        }
      }
    }
    for (const name in CastUtilsExports.PlayerGetterMethods) {
      const frequency = CastUtilsExports.PlayerGetterMethods[name];
      if (this.updateNumber_ % frequency == 0) {
        update['player'][name] = (this.player_ as Object)[name]();
      }
    }
     
    // Volume attributes are tied to the system volume. 
    const manager = cast.receiver.CastReceiverManager.getInstance();
    const systemVolume = manager.getSystemVolume();
    if (systemVolume) {
      update['video']['volume'] = systemVolume.level;
      update['video']['muted'] = systemVolume.muted;
    }
     
    // Only start progressing the update number once data is loaded,
    // just in case any of the "rarely changing" properties with less frequent
    // update messages changes significantly during the loading process. 
    if (this.startUpdatingUpdateNumber_) {
      this.updateNumber_ += 1;
    }
    this.sendMessage_({'type':'update', 'update':update}, this.shakaBus_);
    this.maybeSendMediaInfoMessage_();
  }
   
  /**
     * Composes and sends a mediaStatus message if appropriate.
     */ 
  private maybeSendMediaInfoMessage_(): boolean {
    if (this.initialStatusUpdatePending_ && (this.video_.duration || this.player_.isLive())) {
       
      // Send over a media status message to set the duration of the cast
      // dialogue. 
      this.sendMediaInfoMessage_();
      this.initialStatusUpdatePending_ = false;
      return true;
    }
    return false;
  }
   
  /**
     * Composes and sends a mediaStatus message with a mediaInfo component.
     *
     */ 
  private sendMediaInfoMessage_(requestId: number = 0) {
    const media = {'contentId':this.player_.getAssetUri(), 'streamType':this.player_.isLive() ? 'LIVE' : 'BUFFERED',  
    // Sending an empty string for now since it's a mandatory field.
    // We don't have this info, and it doesn't seem to be useful, anyway. 
    'contentType':''};
    if (!this.player_.isLive()) {
       
      // Optional, and only sent when the duration is known. 
      media['duration'] = this.video_.duration;
    }
    if (this.metadata_) {
      media['metadata'] = this.metadata_;
    }
    this.sendMediaStatus_(requestId, media);
  }
   
  /**
     * Dispatch a fake 'volumechange' event to mimic the video element, since
     * volume changes are routed to the system volume on the receiver.
     */ 
  private fakeVolumeChangeEvent_() {
     
    // Volume attributes are tied to the system volume. 
    const manager = cast.receiver.CastReceiverManager.getInstance();
    const systemVolume = manager.getSystemVolume();
    asserts.assert(systemVolume, 'System volume should not be null!');
    if (systemVolume) {
       
      // Send an update message with just the latest volume level and muted
      // state. 
      this.sendMessage_({'type':'update', 'update':{'video':{'volume':systemVolume.level, 'muted':systemVolume.muted}}}, this.shakaBus_);
    }
     
    // Send another message with a 'volumechange' event to update the sender's
    // UI. 
    this.sendMessage_({'type':'event', 'targetName':'video', 'event':{'type':'volumechange'}}, this.shakaBus_);
  }
   
  /**
     * Since this method is in the compiled library, make sure all messages are
     * read with quoted properties.
     */ 
  private onShakaMessage_(event: cast.receiver.CastMessageBus.Event) {
    const message = CastUtils.deserialize(event.data);
    log.debug('CastReceiver: message', message);
    switch(message['type']) {
      case 'init':
         
        // Reset update message frequency values after initialization. 
        this.updateNumber_ = 0;
        this.startUpdatingUpdateNumber_ = false;
        this.initialStatusUpdatePending_ = true;
        this.initState_(message['initState'], message['appData']);
         
        // The sender is supposed to reflect the cast system volume after
        // connecting.  Using fakeVolumeChangeEvent_() would create a race on
        // the sender side, since it would have volume properties, but no
        // others.
        // This would lead to hasRemoteProperties() being true, even though a
        // complete set had never been sent.
        // Now that we have init state, this is a good time for the first update
        // message anyway. 
        this.pollAttributes_();
        break;
      case 'appData':
        this.appDataCallback_(message['appData']);
        break;
      case 'set':
        {
          const targetName = message['targetName'];
          const property = message['property'];
          const value = message['value'];
          if (targetName == 'video') {
             
            // Volume attributes must be rerouted to the system. 
            const manager = cast.receiver.CastReceiverManager.getInstance();
            if (property == 'volume') {
              manager.setSystemVolumeLevel(value);
              break;
            } else {
              if (property == 'muted') {
                manager.setSystemVolumeMuted(value);
                break;
              }
            }
          }
          this.targets_[targetName][property] = value;
          break;
        }
      case 'call':
        {
          const targetName = message['targetName'];
          const methodName = message['methodName'];
          const args = message['args'];
          const target = this.targets_[targetName];
           
          // eslint-disable-next-line prefer-spread 
          target[methodName].apply(target, args);
          break;
        }
      case 'asyncCall':
        {
          const targetName = message['targetName'];
          const methodName = message['methodName'];
          if (targetName == 'player' && methodName == 'load') {
             
            // Reset update message frequency values after a load. 
            this.updateNumber_ = 0;
            this.startUpdatingUpdateNumber_ = false;
          }
          const args = message['args'];
          const id = message['id'];
          const senderId = event.senderId;
          const target = this.targets_[targetName];
           
          // eslint-disable-next-line prefer-spread 
          let p = target[methodName].apply(target, args);
          if (targetName == 'player' && methodName == 'load') {
             
            // Wait until the manifest has actually loaded to send another media
            // info message, so on a new load it doesn't send the old info over. 
            p = p.then( 
            () => {
              this.initialStatusUpdatePending_ = true;
            });
          }
           
          // Replies must go back to the specific sender who initiated, so that we
          // don't have to deal with conflicting IDs between senders. 
          p.then( 
          () => this.sendAsyncComplete_(senderId, id,  
          /* error= */ 
          null),  
          (error) => this.sendAsyncComplete_(senderId, id, error));
          break;
        }
    }
  }
   
  private onGenericMessage_(event: cast.receiver.CastMessageBus.Event) {
    const message = CastUtils.deserialize(event.data);
    log.debug('CastReceiver: message', message);
     
    // TODO(ismena): error message on duplicate request id from the same sender 
    switch(message['type']) {
      case 'PLAY':
        this.video_.play();
         
        // Notify generic controllers that the player state changed.
        // requestId=0 (the parameter) means that the message was not
        // triggered by a GET_STATUS request. 
        this.sendMediaStatus_();
        break;
      case 'PAUSE':
        this.video_.pause();
        this.sendMediaStatus_();
        break;
      case 'SEEK':
        {
          const currentTime = message['currentTime'];
          const resumeState = message['resumeState'];
          if (currentTime != null) {
            this.video_.currentTime = Number(currentTime);
          }
          if (resumeState && resumeState == 'PLAYBACK_START') {
            this.video_.play();
            this.sendMediaStatus_();
          } else {
            if (resumeState && resumeState == 'PLAYBACK_PAUSE') {
              this.video_.pause();
              this.sendMediaStatus_();
            }
          }
          break;
        }
      case 'STOP':
        this.player_.unload().then( 
        () => {
          if (!this.player_) {
             
            // We've already been destroyed. 
            return;
          }
          this.sendMediaStatus_();
        });
        break;
      case 'GET_STATUS':
         
        // TODO(ismena): According to the SDK this is supposed to be a
        // unicast message to the sender that requested the status,
        // but it doesn't appear to be working.
        // Look into what's going on there and change this to be a
        // unicast. 
        this.sendMediaInfoMessage_(Number(message['requestId']));
        break;
      case 'VOLUME':
        {
          const volumeObject = message['volume'];
          const level = volumeObject['level'];
          const muted = volumeObject['muted'];
          const oldVolumeLevel = this.video_.volume;
          const oldVolumeMuted = this.video_.muted;
          if (level != null) {
            this.video_.volume = Number(level);
          }
          if (muted != null) {
            this.video_.muted = muted;
          }
           
          // Notify generic controllers if the volume changed. 
          if (oldVolumeLevel != this.video_.volume || oldVolumeMuted != this.video_.muted) {
            this.sendMediaStatus_();
          }
          break;
        }
      case 'LOAD':
        {
           
          // Reset update message frequency values after a load. 
          this.updateNumber_ = 0;
          this.startUpdatingUpdateNumber_ = false;
           
          // This already sends an update. 
          this.initialStatusUpdatePending_ = false;
          const mediaInfo = message['media'];
          const contentId = mediaInfo['contentId'];
          const currentTime = message['currentTime'];
          const assetUri = this.contentIdCallback_(contentId);
          const autoplay = message['autoplay'] || true;
          const customData = mediaInfo['customData'];
          this.appDataCallback_(customData);
          if (autoplay) {
            this.video_.autoplay = true;
          }
          this.player_.load(assetUri, currentTime).then( 
          () => {
            if (!this.player_) {
               
              // We've already been destroyed. 
              return;
            }
             
            // Notify generic controllers that the media has changed. 
            this.sendMediaInfoMessage_();
          }).catch( 
          (error) => {
            asserts.assert(error instanceof Error, 'Wrong error type!');
             
            // Load failed.  Dispatch the error message to the sender. 
            let type = 'LOAD_FAILED';
            if (error.category == ErrorExports.Category.PLAYER && error.code == ErrorExports.Code.LOAD_INTERRUPTED) {
              type = 'LOAD_CANCELLED';
            }
            this.sendMessage_({'requestId':Number(message['requestId']), 'type':type}, this.genericBus_);
          });
          break;
        }
      default:
        log.warning('Unrecognized message type from the generic Chromecast controller!', message['type']);
         
        // Dispatch an error to the sender. 
        this.sendMessage_({'requestId':Number(message['requestId']), 'type':'INVALID_REQUEST', 'reason':'INVALID_COMMAND'}, this.genericBus_);
        break;
    }
  }
   
  /**
     * Tell the sender that the async operation is complete.
     */ 
  private sendAsyncComplete_(senderId: string, id: string, error: Error) {
    if (!this.player_) {
       
      // We've already been destroyed. 
      return;
    }
    this.sendMessage_({'type':'asyncComplete', 'id':id, 'error':error}, this.shakaBus_, senderId);
  }
   
  /**
     * Since this method is in the compiled library, make sure all messages passed
     * in here were created with quoted property names.
     */ 
  private sendMessage_(message: Object, bus: cast.receiver.CastMessageBus, senderId?: string) {
     
    // Cuts log spam when debugging the receiver UI in Chrome. 
    if (!this.isConnected_) {
      return;
    }
    const serialized = CastUtils.serialize(message);
    if (senderId) {
      bus.getCastChannel(senderId).send(serialized);
    } else {
      bus.broadcast(serialized);
    }
  }
   
  private getPlayState_(): string {
    const playState = PLAY_STATE;
    if (this.isIdle_) {
      return playState.IDLE;
    } else {
      if (this.player_.isBuffering()) {
        return playState.BUFFERING;
      } else {
        if (this.video_.paused) {
          return playState.PAUSED;
        } else {
          return playState.PLAYING;
        }
      }
    }
  }
   
  private sendMediaStatus_(requestId: number = 0, media: Object = null) {
    const mediaStatus = { 
    // mediaSessionId is a unique ID for the playback of this specific
    // session.
    // It's used to identify a specific instance of a playback.
    // We don't support multiple playbacks, so just return 0. 
    'mediaSessionId':0, 'playbackRate':this.video_.playbackRate, 'playerState':this.getPlayState_(), 'currentTime':this.video_.currentTime,  
    // supportedMediaCommands is a sum of all the flags of commands that the
    // player supports.
    // The list of comands with respective flags is:
    // 1 - Pause
    // 2 - Seek
    // 4 - Stream volume
    // 8 - Stream mute
    // 16 - Skip forward
    // 32 - Skip backward
    // We support all of them, and their sum is 63. 
    'supportedMediaCommands':63, 'volume':{'level':this.video_.volume, 'muted':this.video_.muted}};
    if (media) {
      mediaStatus['media'] = media;
    }
    const ret = {'requestId':requestId, 'type':'MEDIA_STATUS', 'status':[mediaStatus]};
    this.sendMessage_(ret, this.genericBus_);
  }
}
 
/** The interval, in seconds, to poll for changes. */ 
export const POLL_INTERVAL: number = 0.5;
 
/** The interval, in seconds, to go "idle". */ 
export const IDLE_INTERVAL: number = 5;
 
export enum PLAY_STATE {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  BUFFERING = 'BUFFERING',
  PAUSED = 'PAUSED'
}
