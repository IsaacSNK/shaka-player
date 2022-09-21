/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.require('mozilla.LanguageMapping');
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
goog.require('shaka.ui.Locales');
import {TrackLabelFormat} from './dev-workspace.shaka-player-fork.ui.ui';
import {Utils} from './dev-workspace.shaka-player-fork.ui.ui_utils';
import {Dom} from './dev-workspace.shaka-player-fork.lib.util.dom_utils';
import {LanguageUtils} from './dev-workspace.shaka-player-fork.lib.util.language_utils';
import * as LanguageUtilsExports from './dev-workspace.shaka-player-fork.lib.util.language_utils';
import {Localization} from './dev-workspace.shaka-player-fork.ui.localization';
import * as LocalizationExports from './dev-workspace.shaka-player-fork.ui.localization';

export class LanguageUtils {
  static updateTracks(
      tracks: shaka.extern.Track[], langMenu: HTMLElement,
      onTrackSelected: (p1: shaka.extern.Track) => any, updateChosen: boolean,
      currentSelectionElement: HTMLElement, localization: Localization,
      trackLabelFormat: TrackLabelFormat) {
    // TODO: Do the benefits of having this common code in a method still
    // outweigh the complexity of the parameter list?
    const selectedTrack = tracks.find((track) => {
      return track.active == true;
    });

    // Remove old tracks
    // 1. Save the back to menu button
    const backButton = Utils.getFirstDescendantWithClassName(
        langMenu, 'shaka-back-to-overflow-button');

    // 2. Remove everything
    Dom.removeAllChildren(langMenu);

    // 3. Add the backTo Menu button back
    langMenu.appendChild(backButton);

    // 4. Figure out which languages have multiple roles.
    const getRolesString = (track) => {
      if (track.type == 'variant') {
        return track.audioRoles ? track.audioRoles.join(', ') : undefined;
      } else {
        return track.roles.join(', ');
      }
    };
    const getCombination = (language, rolesString) => {
      return language + ': ' + rolesString;
    };
    const rolesByLanguage: Map<string, Set<string>> = new Map();
    for (const track of tracks) {
      if (!rolesByLanguage.has(track.language)) {
        rolesByLanguage.set(track.language, new Set());
      }
      rolesByLanguage.get(track.language).add(getRolesString(track));
    }

    // 5. Add new buttons
    const combinationsMade: Set<string> = new Set();
    const selectedCombination = selectedTrack ?
        getCombination(selectedTrack.language, getRolesString(selectedTrack)) :
        '';
    for (const track of tracks) {
      const language = track.language;
      const forced = track.forced;
      const LocIds = shaka.ui.Locales.Ids;
      const forcedString = localization.resolve(LocIds.SUBTITLE_FORCED);
      const rolesString = getRolesString(track);
      const combinationName = getCombination(language, rolesString);
      if (combinationsMade.has(combinationName)) {
        continue;
      }
      combinationsMade.add(combinationName);
      const button = Dom.createButton();
      button.addEventListener('click', () => {
        onTrackSelected(track);
      });
      const span = Dom.createHTMLElement('span');
      button.appendChild(span);
      span.textContent = LanguageUtils.getLanguageName(language, localization);
      switch (trackLabelFormat) {
        case TrackLabelFormat.LANGUAGE:
          if (forced) {
            span.textContent += ' (' + forcedString + ')';
          }
          break;
        case TrackLabelFormat.ROLE:
          if (!rolesString) {
            // Fallback behavior. This probably shouldn't happen.
            log.alwaysWarn(
                'Track #' + track.id + ' does not have a ' +
                'role, but the UI is configured to only show role.');
            span.textContent = '?';
          } else {
            span.textContent = rolesString;
          }
          if (forced) {
            span.textContent += ' (' + forcedString + ')';
          }
          break;
        case TrackLabelFormat.LANGUAGE_ROLE:
          if (rolesString) {
            span.textContent += ': ' + rolesString;
          }
          if (forced) {
            span.textContent += ' (' + forcedString + ')';
          }
          break;
        case TrackLabelFormat.LABEL:
          if (track.label) {
            span.textContent = track.label;
          } else {
            // Fallback behavior. This probably shouldn't happen.
            log.alwaysWarn(
                'Track #' + track.id + ' does not have a ' +
                'label, but the UI is configured to only show labels.');
            span.textContent = '?';
          }
          break;
      }
      if (updateChosen && combinationName == selectedCombination) {
        button.appendChild(Utils.checkmarkIcon());
        span.classList.add('shaka-chosen-item');
        button.ariaSelected = 'true';
        currentSelectionElement.textContent = span.textContent;
      }
      langMenu.appendChild(button);
    }
  }

  /**
   * Returns the language's name for itself in its own script (autoglottonym),
   * if we have it.
   *
   * If the locale, including region, can be mapped to a name, we return a very
   * specific name including the region.  For example, "de-AT" would map to
   * "Deutsch (Österreich)" or Austrian German.
   *
   * If only the language part of the locale is in our map, we append the locale
   * itself for specificity.  For example, "ar-EG" (Egyptian Arabic) would map
   * to "ﺎﻠﻋﺮﺒﻳﺓ (ar-EG)".  In this way, multiple versions of Arabic whose
   * regions are not in our map would not all look the same in the language
   * list, but could be distinguished by their locale.
   *
   * Finally, if language part of the locale is not in our map, we label it
   * "unknown", as translated to the UI locale, and we append the locale itself
   * for specificity.  For example, "sjn" would map to "Unknown (sjn)".  In this
   * way, multiple unrecognized languages would not all look the same in the
   * language list, but could be distinguished by their locale.
   *
   * @return The language's name for itself in its own script, or as
   *   close as we can get with the information we have.
   */
  static getLanguageName(locale: string, localization: Localization): string {
    if (!locale && !localization) {
      return '';
    }

    // Shorthand for resolving a localization ID.
    const resolve = (id) => localization.resolve(id);

    // Handle some special cases first.  These are reserved language tags that
    // are used to indicate something that isn't one specific language.
    switch (locale) {
      case 'mul':
        return resolve(shaka.ui.Locales.Ids.MULTIPLE_LANGUAGES);
      case 'und':
        return resolve(shaka.ui.Locales.Ids.UNDETERMINED_LANGUAGE);
      case 'zxx':
        return resolve(shaka.ui.Locales.Ids.NOT_APPLICABLE);
    }

    // Extract the base language from the locale as a fallback step.
    const language = LanguageUtils.getBase(locale);

    // First try to resolve the full language name.
    // If that fails, try the base.
    // Finally, report "unknown".
    // When there is a loss of specificity (either to a base language or to
    // "unknown"), we should append the original language code.
    // Otherwise, there may be multiple identical-looking items in the list.
    if (locale in mozilla.LanguageMapping) {
      return mozilla.LanguageMapping[locale].nativeName;
    } else {
      if (language in mozilla.LanguageMapping) {
        return mozilla.LanguageMapping[language].nativeName + ' (' + locale +
            ')';
      } else {
        return resolve(shaka.ui.Locales.Ids.UNRECOGNIZED_LANGUAGE) + ' (' +
            locale + ')';
      }
    }
  }
}
