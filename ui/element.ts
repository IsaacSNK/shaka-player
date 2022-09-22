/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as AdManagerExports from './lib/ad_manager';
import {AdManager} from './lib/ad_manager';
import * as PlayerExports from './lib/player';
import {Player} from './lib/player';
import * as EventManagerExports from './lib/event_manager';
import {EventManager} from './lib/event_manager';
import {Controls} from './/controls';
import * as LocalizationExports from './/localization';
import {Localization} from './/localization';

/**
 * @abstract
 * @export
 */
export class Element implements shaka.
extern.IUIElement {
  /**
   * @exportInterface
   */
  protected parent: HTMLElement;

  /**
   * @exportInterface
   */
  protected controls: Controls;

  /**
   * @exportInterface
   */
  protected eventManager: EventManager;

  /**
   * @exportInterface
   */
  protected localization: Localization;

  /**
   * @exportInterface
   */
  protected player: Player;

  /**
   * @exportInterface
   */
  protected video: HTMLMediaElement;

  /**
   * @exportInterface
   */
  protected adManager: shaka.extern.IAdManager;

  /**
   * @exportInterface
   */
  protected ad: shaka.extern.IAd|null;

  constructor(parent: HTMLElement, controls: Controls) {
    this.parent = parent;
    this.controls = controls;
    this.eventManager = new EventManager();
    this.localization = this.controls.getLocalization();
    this.player = this.controls.getPlayer();
    this.video = this.controls.getVideo();
    this.adManager = this.player.getAdManager();
    this.ad = controls.getAd();
    const AD_STARTED = AdManagerExports.AD_STARTED;
    this.eventManager.listen(this.adManager, AD_STARTED, (e) => {
      this.ad = (e as Object)['ad'];
    });
    const AD_STOPPED = AdManagerExports.AD_STOPPED;
    this.eventManager.listen(this.adManager, AD_STOPPED, () => {
      this.ad = null;
    });
  }

  /**
   * @override
   * @export
   */
  release() {
    this.eventManager.release();
    this.parent = null;
    this.controls = null;
    this.eventManager = null;
    this.localization = null;
    this.player = null;
    this.video = null;
    this.adManager = null;
    this.ad = null;
  }
}
