/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import {AdaptationSet} from './dev-workspace.shaka-player-fork.lib.media.adaptation_set';
import * as LanguageUtilsExports from './dev-workspace.shaka-player-fork.lib.util.language_utils';
import {LanguageUtils} from './dev-workspace.shaka-player-fork.lib.util.language_utils';
import * as StreamUtilsExports from './dev-workspace.shaka-player-fork.lib.util.stream_utils';
import {StreamUtils} from './dev-workspace.shaka-player-fork.lib.util.stream_utils';

/**
 * An adaptation set criteria is a unit of logic that can take a set of
 * variants and return a subset of variants that should (and can) be
 * adapted between.
 *
 */
export class AdaptationSetCriteria {
  /**
   * Take a set of variants, and return a subset of variants that can be
   * adapted between.
   *
   */
  create(variants: shaka.extern.Variant[]): AdaptationSet {}
}

/**
 * @final
 */
export class ExampleBasedCriteria implements AdaptationSetCriteria {
  private example_: shaka.extern.Variant;
  private fallback_: AdaptationSetCriteria;

  constructor(example: shaka.extern.Variant) {
    this.example_ = example;

    // We can't know if role and label are really important, so we don't use
    // role and label for this.
    const role = '';
    const label = '';
    const channelCount = example.audio && example.audio.channelsCount ?
        example.audio.channelsCount :
        0;
    this.fallback_ = new PreferenceBasedCriteria(
        example.language, role, channelCount, label);
  }

  /** @override */
  create(variants) {
    // We can't assume that the example is in |variants| because it could
    // actually be from another period.
    const shortList = variants.filter((variant) => {
      return AdaptationSet.areAdaptable(this.example_, variant);
    });
    if (shortList.length) {
      // Use the first item in the short list as the root. It should not matter
      // which element we use as all items in the short list should already be
      // compatible.
      return new AdaptationSet(shortList[0], shortList);
    } else {
      return this.fallback_.create(variants);
    }
  }
}

/**
 * @final
 */
export class PreferenceBasedCriteria implements AdaptationSetCriteria {
  private language_: string;
  private role_: string;
  private channelCount_: number;
  private label_: string;

  constructor(
      language: string, role: string, channelCount: number,
      label: string = '') {
    this.language_ = language;
    this.role_ = role;
    this.channelCount_ = channelCount;
    this.label_ = label;
  }

  /** @override */
  create(variants) {
    const Class = PreferenceBasedCriteria;
    const StreamUtils = StreamUtils;
    let current = [];
    const byLanguage = Class.filterByLanguage_(variants, this.language_);
    const byPrimary = variants.filter((variant) => variant.primary);
    if (byLanguage.length) {
      current = byLanguage;
    } else {
      if (byPrimary.length) {
        current = byPrimary;
      } else {
        current = variants;
      }
    }

    // Now refine the choice based on role preference.  Even the empty string
    // works here, and will match variants without any roles.
    const byRole = Class.filterVariantsByRole_(current, this.role_);
    if (byRole.length) {
      current = byRole;
    } else {
      log.warning('No exact match for variant role could be found.');
    }
    if (this.channelCount_) {
      const byChannel = StreamUtils.filterVariantsByAudioChannelCount(
          current, this.channelCount_);
      if (byChannel.length) {
        current = byChannel;
      } else {
        log.warning('No exact match for the channel count could be found.');
      }
    }
    if (this.label_) {
      const byLabel = Class.filterVariantsByLabel_(current, this.label_);
      if (byLabel.length) {
        current = byLabel;
      } else {
        log.warning('No exact match for variant label could be found.');
      }
    }

    // Make sure we only return a valid adaptation set.
    const set = new AdaptationSet(current[0]);
    for (const variant of current) {
      if (set.canInclude(variant)) {
        set.add(variant);
      }
    }
    return set;
  }

  private static filterByLanguage_(
      variants: shaka.extern.Variant[],
      preferredLanguage: string): shaka.extern.Variant[] {
    const LanguageUtils = LanguageUtils;
    const preferredLocale: string = LanguageUtils.normalize(preferredLanguage);
    const closestLocale: string|null = LanguageUtils.findClosestLocale(
        preferredLocale,
        variants.map((variant) => LanguageUtils.getLocaleForVariant(variant)));

    // There were no locales close to what we preferred.
    if (!closestLocale) {
      return [];
    }

    // Find the variants that use the closest variant.
    return variants.filter((variant) => {
      return closestLocale == LanguageUtils.getLocaleForVariant(variant);
    });
  }

  /**
   * Filter Variants by role.
   *
   */
  private static filterVariantsByRole_(
      variants: shaka.extern.Variant[],
      preferredRole: string): shaka.extern.Variant[] {
    return variants.filter((variant) => {
      if (!variant.audio) {
        return false;
      }
      if (preferredRole) {
        return variant.audio.roles.includes(preferredRole);
      } else {
        return variant.audio.roles.length == 0;
      }
    });
  }

  /**
   * Filter Variants by label.
   *
   */
  private static filterVariantsByLabel_(
      variants: shaka.extern.Variant[],
      preferredLabel: string): shaka.extern.Variant[] {
    return variants.filter((variant) => {
      if (!variant.audio) {
        return false;
      }
      const label1 = variant.audio.label.toLowerCase();
      const label2 = preferredLabel.toLowerCase();
      return label1 == label2;
    });
  }
}
