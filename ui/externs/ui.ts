import { IReleasable } from './../../lib/util/i_releasable'
import { IAd, IAdManager } from './../../externs/shaka/ads'
import { Controls } from '../controls';
import { EventManager } from './../../lib/util/event_manager'
import { Player } from '../../lib/player';
import { Localization } from '../localization';
import { TrackLabelFormat } from '../ui';
/**
 * Interface for UI elements.  UI elements should inherit from the concrete base
 * class shaka.ui.Element.  The members defined in this extern's constructor are
 * all available from the base class, and are defined here to keep the compiler
 * from renaming them.
 */
export interface IUIElement extends IReleasable {
  ad: IAd | null;
  adManager: IAdManager | null;
  controls: Controls | null;
  eventManager: EventManager | null;
  localization: Localization | null;
  parent: HTMLElement | null;
  player: Player | null;
  video: HTMLMediaElement | null;
  release(): any;
}

/**
 * A factory for creating a UI element.
 */
export interface Factory {
  create(rootElement: HTMLElement, controls: Controls): any;
}

/**
 * Interface for UI range elements.  UI range elements should inherit from the
 * concrete base class shaka.ui.RangeElement.  The members defined in this
 * extern's constructor are all available from the base class, and are defined
 * here to keep the compiler from renaming them.
 */
export interface IUIRangeElement extends IUIElement {
  bar: HTMLInputElement;
  container: HTMLElement;
  changeTo(value: number): any;
  getValue(): number;
  /**
   * Called when a new value is set by user interaction.
   * To be overridden by subclasses.
   */
  onChange(): any;
  /**
   * Called when user interaction ends.
   * To be overridden by subclasses.
   */
  onChangeEnd(): any;
  /**
   * Called when user interaction begins.
   * To be overridden by subclasses.
   */
  onChangeStart(): any;
  setRange(min: number, max: number): any;
  setValue(value: number): any;
}

/**
 * Interface for SeekBars. SeekBars should inherit from the concrete base
 * class shaka.ui.Element. If you do not need to totaly rebuild the
 * SeekBar, you should consider using shaka.ui.RangeElement or
 * shaka.ui.SeekBar as your base class.
 */
export interface IUISeekBar extends IUIRangeElement {
  getValue(): number;
  isShowing(): boolean;
  setValue(value: number): any;
  /**
   * Called by Controls on a timer to update the state of the seek bar.
   * Also called internally when the user interacts with the input element.
   */
  update(): any;
}

/**
 * A factory for creating a SeekBar element.
 */
export interface IFactory {
  create(rootElement: HTMLElement, controls: Controls): any;
}

/**
 * Interface for UI settings menus.  UI settings menus should inherit from the
 * concrete base class shaka.ui.SettingsMenu.  The members defined in this
 * extern's constructor are all available from the base class, and are defined
 * here to keep the compiler from renaming them.
 */
export interface IUISettingsMenu extends IUIElement {
  backButton: HTMLButtonElement;
  backSpan: HTMLElement;
  button: HTMLButtonElement;
  currentSelection: HTMLElement;
  icon: HTMLElement;
  menu: HTMLElement;
  nameSpan: HTMLElement;
}

export type UIConfiguration = { addBigPlayButton: boolean, addSeekBar: boolean, castAndroidReceiverCompatible: boolean, castReceiverAppId: string, clearBufferOnQualityChange: boolean, contextMenuElements: string[], controlPanelElements: string[], customContextMenu: boolean, doubleClickForFullscreen: boolean, enableFullscreenOnRotation: boolean, enableKeyboardPlaybackControls: boolean, enableTooltips: boolean, fadeDelay: number, fastForwardRates: number[], forceLandscapeOnFullscreen: boolean, keyboardSeekDistance: number, overflowMenuButtons: string[], playbackRates: number[], rewindRates: number[], seekBarColors: UISeekBarColors, showUnbufferedStart: boolean, singleClickForPlayAndPause: boolean, statisticsList: string[], trackLabelFormat: TrackLabelFormat, volumeBarColors: UIVolumeBarColors };


export type UISeekBarColors = { adBreaks: string, base: string, buffered: string, played: string };


export type UIVolumeBarColors = { base: string, level: string };



export declare namespace shaka.ui {
  class Locales {
    addTo(localization: Localization);
  }
}
export declare namespace shaka.ui.Locales {
  enum Ids {
    LIVE = 'LIVE',
    AD_TIME = 'AD_TIME',
    LOOP = 'LOOP',
    MUTE = 'MUTE',
    UNMUTE = 'UNMUTE',
    VOLUME = 'VOLUME',
    OFF = 'OFF',
    EXIT_FULL_SCREEN = 'EXIT_FULL_SCREEN',
    AIRPLAY = 'AIRPLAY',
    FAST_FORWARD = 'FAST_FORWARD',
    NOT_APPLICABLE = 'NOT_APPLICABLE',
    FULL_SCREEN = 'FULL_SCREEN',
    UNDETERMINED_LANGUAGE = 'UNDETERMINED_LANGUAGE',
    EXIT_LOOP_MODE = 'EXIT_LOOP_MODE',
    ENTER_PICTURE_IN_PICTURE = 'ENTER_PICTURE_IN_PICTURE',
    BACK = 'BACK',
    ENTER_LOOP_MODE = 'ENTER_LOOP_MODE',
    PLAYBACK_RATE = 'PLAYBACK_RATE',
    PAUSE = 'PAUSE',
    PICTURE_IN_PICTURE = 'PICTURE_IN_PICTURE',
    UNRECOGNIZED_LANGUAGE = 'UNRECOGNIZED_LANGUAGE',
    SKIP_TO_LIVE = 'SKIP_TO_LIVE',
    STATISTICS = 'STATISTICS',
    AUTO_QUALITY = 'AUTO_QUALITY',
    EXIT_PICTURE_IN_PICTURE = 'EXIT_PICTURE_IN_PICTURE',
    RESOLUTION = 'RESOLUTION',
    QUALITY = 'QUALITY',
    SUBTITLE_FORCED = 'SUBTITLE_FORCED',
    SEEK = 'SEEK',
    REPLAY = 'REPLAY',
    PLAY = 'PLAY',
    LANGUAGE = 'LANGUAGE',
    ON = 'ON',
    REWIND = 'REWIND',
    AD_PROGRESS = 'AD_PROGRESS',
    CAPTIONS = 'CAPTIONS',
    SKIP_AD = 'SKIP_AD',
    MULTIPLE_LANGUAGES = 'MULTIPLE_LANGUAGES',
    AD_DURATION = 'AD_DURATION',
    MORE_SETTINGS = 'MORE_SETTINGS',
    CAST = 'CAST',
  }
}
