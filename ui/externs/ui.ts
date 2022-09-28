/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 *
 * @suppress {duplicate} To prevent compiler errors with the namespace
 *   being declared both here and by goog.provide in the library.
 */

/** @namespace */
let shaka = {};

/** @namespace */
shaka.extern = {};

export interface UISeekBarColors {
  base: string;
  buffered: string;
  played: string;
  adBreaks: string;
}

export interface UIVolumeBarColors {
  base: string;
  level: string;
}

export interface UIConfiguration {
  controlPanelElements: string[];
  overflowMenuButtons: string[];
  contextMenuElements: string[];
  statisticsList: string[];
  playbackRates: number[];
  fastForwardRates: number[];
  rewindRates: number[];
  addSeekBar: boolean;
  addBigPlayButton: boolean;
  customContextMenu: boolean;
  castReceiverAppId: string;
  castAndroidReceiverCompatible: boolean;
  clearBufferOnQualityChange: boolean;
  showUnbufferedStart: boolean;
  seekBarColors: shaka.extern.UISeekBarColors;
  volumeBarColors: shaka.extern.UIVolumeBarColors;
  trackLabelFormat: shaka.ui.Overlay.TrackLabelFormat;
  fadeDelay: number;
  doubleClickForFullscreen: boolean;
  singleClickForPlayAndPause: boolean;
  enableKeyboardPlaybackControls: boolean;
  enableFullscreenOnRotation: boolean;
  forceLandscapeOnFullscreen: boolean;
  enableTooltips: boolean;
  keyboardSeekDistance: number;
}

/**
 * Interface for UI elements.  UI elements should inherit from the concrete base
 * class shaka.ui.Element.  The members defined in this extern's constructor are
 * all available from the base class, and are defined here to keep the compiler
 * from renaming them.
 *
 * @exportDoc
 */
shaka.extern.IUIElement = class {
  /**
   * @exportDoc
   */
  protected parent: HTMLElement;

  /**
   * @exportDoc
   */
  protected controls: Controls;

  /**
   * @exportDoc
   */
  protected eventManager: EventManager;

  /**
   * @exportDoc
   */
  protected localization: Localization;

  /**
   * @exportDoc
   */
  protected player: Player;

  /**
   * @exportDoc
   */
  protected video: HTMLMediaElement;

  /**
   * @exportDoc
   */
  protected adManager: shaka.extern.IAdManager;

  /**
   * @exportDoc
   */
  protected ad: shaka.extern.IAd;

  constructor(parent: HTMLElement, controls: Controls) {}

  /**
   * @override
   */
  release() {}
};

/**
 * A factory for creating a UI element.
 *
 * @exportDoc
 */
shaka.extern.IUIElement.Factory = class {
  create(
    rootElement: HTMLElement,
    controls: Controls
  ): shaka.extern.IUIElement {}
};

/**
 * Interface for UI range elements.  UI range elements should inherit from the
 * concrete base class shaka.ui.RangeElement.  The members defined in this
 * extern's constructor are all available from the base class, and are defined
 * here to keep the compiler from renaming them.
 *
 * @exportDoc
 */
shaka.extern.IUIRangeElement = class {
  /**
   * @exportDoc
   */
  protected container: HTMLElement;

  /**
   * @exportDoc
   */
  protected bar: HTMLInputElement;

  constructor(
    parent: HTMLElement,
    controls: Controls,
    containerClassNames: string[],
    barClassNames: string[]
  ) {}

  setRange(min: number, max: number) {}

  /**
   * Called when user interaction begins.
   * To be overridden by subclasses.
   */
  onChangeStart() {}

  /**
   * Called when a new value is set by user interaction.
   * To be overridden by subclasses.
   */
  onChange() {}

  /**
   * Called when user interaction ends.
   * To be overridden by subclasses.
   */
  onChangeEnd() {}

  getValue(): number {}

  setValue(value: number) {}

  changeTo(value: number) {}
};

/**
 * Interface for UI settings menus.  UI settings menus should inherit from the
 * concrete base class shaka.ui.SettingsMenu.  The members defined in this
 * extern's constructor are all available from the base class, and are defined
 * here to keep the compiler from renaming them.
 *
 * @exportDoc
 */
shaka.extern.IUISettingsMenu = class {
  /**
   * @exportDoc
   */
  protected button: HTMLButtonElement;

  /**
   * @exportDoc
   */
  protected icon: HTMLElement;

  /**
   * @exportDoc
   */
  protected nameSpan: HTMLElement;

  /**
   * @exportDoc
   */
  protected currentSelection: HTMLElement;

  /**
   * @exportDoc
   */
  protected menu: HTMLElement;

  /**
   * @exportDoc
   */
  protected backButton: HTMLButtonElement;

  /**
   * @exportDoc
   */
  protected backSpan: HTMLElement;

  constructor(parent: HTMLElement, controls: Controls, iconText: string) {}
};

/**
 * Interface for SeekBars. SeekBars should inherit from the concrete base
 * class shaka.ui.Element. If you do not need to totaly rebuild the
 * SeekBar, you should consider using shaka.ui.RangeElement or
 * shaka.ui.SeekBar as your base class.
 *
 * @exportDoc
 */
shaka.extern.IUISeekBar = class {
  getValue(): number {}

  setValue(value: number) {}

  /**
   * Called by Controls on a timer to update the state of the seek bar.
   * Also called internally when the user interacts with the input element.
   */
  update() {}

  isShowing(): boolean {}
};

/**
 * A factory for creating a SeekBar element.
 *
 * @exportDoc
 */
shaka.extern.IUISeekBar.Factory = class {
  create(
    rootElement: HTMLElement,
    controls: Controls
  ): shaka.extern.IUISeekBar {}
};
