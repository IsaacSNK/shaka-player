/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { IAd, IAdManager } from '../externs/shaka/ads';
import * as AdManagerExports from './../lib/ads/ad_manager';
import {AdManager} from './../lib/ads/ad_manager';
import * as PlayerExports from './../lib/player';
import {Player} from './../lib/player';
import * as EventManagerExports from './../lib/util/event_manager';
import {EventManager} from './../lib/util/event_manager';
import {Controls} from './../ui/controls';
import * as LocalizationExports from './../ui/localization';
import {Localization} from './../ui/localization';
import { IUIElement } from './externs/ui';


/**
 * @abstract
 * @export
 */
export class Element implements IUIElement {
  /**
   * @exportInterface
   */
  public parent: HTMLElement;

  /**
   * @exportInterface
   */
  public controls: Controls;

  /**
   * @exportInterface
   */
  public eventManager: EventManager;

  /**
   * @exportInterface
   */
  public localization: Localization;

  /**
   * @exportInterface
   */
  public player: Player;

  /**
   * @exportInterface
   */
  public video: HTMLMediaElement;

  /**
   * @exportInterface
   */
  public adManager: IAdManager;

  /**
   * @exportInterface
   */
  public ad: IAd|null;

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
    //@ts-ignore
    this.parent = null;
    //@ts-ignore
    this.controls = null;
     //@ts-ignore
    this.eventManager = null;
    //@ts-ignore
    this.localization = null;
     //@ts-ignore
    this.player = null;
    //@ts-ignore
    this.video = null;
    //@ts-ignore
    this.adManager = null;
    this.ad = null;
  }
}
