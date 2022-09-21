/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as CueRegionExports from './dev-workspace.shaka-player-fork.lib.text.cue';
import * as CueExports from './dev-workspace.shaka-player-fork.lib.text.cue';
import {Cue, CueRegion} from './dev-workspace.shaka-player-fork.lib.text.cue';
import * as TextEngineExports from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import {TextEngine} from './dev-workspace.shaka-player-fork.lib.text.text_engine';
import {ArrayUtils} from './dev-workspace.shaka-player-fork.lib.util.array_utils';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import * as StringUtilsExports from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {StringUtils} from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {XmlUtils} from './dev-workspace.shaka-player-fork.lib.util.xml_utils';

/**
 * @export
 */
export class TtmlTextParser implements shaka.
extern.TextParser {
  /**
   * @override
   * @export
   */
  parseInit(data) {
    asserts.assert(false, 'TTML does not have init segments');
  }

  /**
   * @override
   * @export
   */
  setSequenceMode(sequenceMode) {}

  // Unused.
  /**
   * @override
   * @export
   */
  parseMedia(data, time) {
    const TtmlTextParser = TtmlTextParser;
    const XmlUtils = XmlUtils;
    const ttpNs = TtmlTextParser.parameterNs_;
    const ttsNs = TtmlTextParser.styleNs_;
    const str = StringUtils.fromUTF8(data);
    const cues = [];
    const parser = new DOMParser();
    let xml = null;

    // dont try to parse empty string as
    // DOMParser will not throw error but return an errored xml
    if (str == '') {
      return cues;
    }
    try {
      xml = parser.parseFromString(str, 'text/xml');
    } catch (exception) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
          ErrorExports.Code.INVALID_XML, 'Failed to parse TTML.');
    }
    if (xml) {
      const parserError = xml.getElementsByTagName('parsererror')[0];
      if (parserError) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
            ErrorExports.Code.INVALID_XML, parserError.textContent);
      }
      const tt = xml.getElementsByTagName('tt')[0];

      // TTML should always have tt element.
      if (!tt) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
            ErrorExports.Code.INVALID_XML, 'TTML does not contain <tt> tag.');
      }
      const body = tt.getElementsByTagName('body')[0];
      if (!body) {
        return [];
      }

      // Get the framerate, subFrameRate and frameRateMultiplier if applicable.
      const frameRate = XmlUtils.getAttributeNSList(tt, ttpNs, 'frameRate');
      const subFrameRate =
          XmlUtils.getAttributeNSList(tt, ttpNs, 'subFrameRate');
      const frameRateMultiplier =
          XmlUtils.getAttributeNSList(tt, ttpNs, 'frameRateMultiplier');
      const tickRate = XmlUtils.getAttributeNSList(tt, ttpNs, 'tickRate');
      const cellResolution =
          XmlUtils.getAttributeNSList(tt, ttpNs, 'cellResolution');
      const spaceStyle = tt.getAttribute('xml:space') || 'default';
      const extent = XmlUtils.getAttributeNSList(tt, ttsNs, 'extent');
      if (spaceStyle != 'default' && spaceStyle != 'preserve') {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
            ErrorExports.Code.INVALID_XML,
            'Invalid xml:space value: ' + spaceStyle);
      }
      const whitespaceTrim = spaceStyle == 'default';
      const rateInfo = new TtmlTextParser.RateInfo_(
          frameRate, subFrameRate, frameRateMultiplier, tickRate);
      const cellResolutionInfo =
          TtmlTextParser.getCellResolution_(cellResolution);
      const metadata = tt.getElementsByTagName('metadata')[0];
      const metadataElements = metadata ? XmlUtils.getChildren(metadata) : [];
      const styles = Array.from(tt.getElementsByTagName('style'));
      const regionElements = Array.from(tt.getElementsByTagName('region'));
      const cueRegions = [];
      for (const region of regionElements) {
        const cueRegion =
            TtmlTextParser.parseCueRegion_(region, styles, extent);
        if (cueRegion) {
          cueRegions.push(cueRegion);
        }
      }

      // A <body> element should only contain <div> elements, not <p> or <span>
      // elements.  We used to allow this, but it is non-compliant, and the
      // loose nature of our previous parser made it difficult to implement TTML
      // nesting more fully.
      if (XmlUtils.findChildren(body, 'p').length) {
        throw new Error(
            ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
            ErrorExports.Code.INVALID_TEXT_CUE,
            '<p> can only be inside <div> in TTML');
      }
      for (const div of XmlUtils.findChildren(body, 'div')) {
        // A <div> element should only contain <p>, not <span>.
        if (XmlUtils.findChildren(div, 'span').length) {
          throw new Error(
              ErrorExports.Severity.CRITICAL, ErrorExports.Category.TEXT,
              ErrorExports.Code.INVALID_TEXT_CUE,
              '<span> can only be inside <p> in TTML');
        }
      }
      const cue = TtmlTextParser.parseCue_(
          body, time.periodStart, rateInfo, metadataElements, styles,
          regionElements, cueRegions, whitespaceTrim, cellResolutionInfo,
          /* parentCueElement= */
          null,
          /* isContent= */
          false);
      if (cue) {
        cues.push(cue);
      }
    }
    return cues;
  }

  /**
   * Parses a TTML node into a Cue.
   *
   */
  private static parseCue_(
      cueNode: Node, offset: number, rateInfo: RateInfo_,
      metadataElements: Element[], styles: Element[], regionElements: Element[],
      cueRegions: CueRegion[], whitespaceTrim: boolean,
      cellResolution: {columns: number, rows: number}|null,
      parentCueElement: Element|null, isContent: boolean): Cue {
    let cueElement: Element;
    let parentElement: Element = (cueNode.parentNode as Element);
    if (cueNode.nodeType == Node.COMMENT_NODE) {
      // The comments do not contain information that interests us here.
      return null;
    }
    if (cueNode.nodeType == Node.TEXT_NODE) {
      if (!isContent) {
        // Ignore text elements outside the content. For example, whitespace
        // on the same lexical level as the <p> elements, in a document with
        // xml:space="preserve", should not be renderer.
        return null;
      }

      // This should generate an "anonymous span" according to the TTML spec.
      // So pretend the element was a <span>.  parentElement was set above, so
      // we should still be able to correctly traverse up for timing
      // information later.
      const span = document.createElement('span');
      span.textContent = cueNode.textContent;
      cueElement = span;
    } else {
      asserts.assert(
          cueNode.nodeType == Node.ELEMENT_NODE,
          'nodeType should be ELEMENT_NODE!');
      cueElement = (cueNode as Element);
    }
    asserts.assert(cueElement, 'cueElement should be non-null!');
    let imageElement = null;
    for (const nameSpace of smpteNsList_) {
      imageElement = TtmlTextParser.getElementsFromCollection_(
          cueElement, 'backgroundImage', metadataElements, '#', nameSpace)[0];
      if (imageElement) {
        break;
      }
    }
    const parentIsContent = isContent;
    if (cueNode.nodeName == 'p' || imageElement) {
      isContent = true;
    }
    const spaceStyle = cueElement.getAttribute('xml:space') ||
        (whitespaceTrim ? 'default' : 'preserve');
    const localWhitespaceTrim = spaceStyle == 'default';

    // Parse any nested cues first.
    const isTextNode = (node) => {
      return node.nodeType == Node.TEXT_NODE;
    };
    const isLeafNode = Array.from(cueElement.childNodes).every(isTextNode);
    const nestedCues = [];
    if (!isLeafNode) {
      // Otherwise, recurse into the children.  Text nodes will convert into
      // anonymous spans, which will then be leaf nodes.
      for (const childNode of cueElement.childNodes) {
        const nestedCue = TtmlTextParser.parseCue_(
            childNode, offset, rateInfo, metadataElements, styles,
            regionElements, cueRegions, localWhitespaceTrim, cellResolution,
            cueElement, isContent);

        // This node may or may not generate a nested cue.
        if (nestedCue) {
          nestedCues.push(nestedCue);
        }
      }
    }
    const isNested = (parentCueElement != null as boolean);

    // In this regex, "\S" means "non-whitespace character".
    const hasTextContent = /\S/.test(cueElement.textContent);
    const hasTimeAttributes = cueElement.hasAttribute('begin') ||
        cueElement.hasAttribute('end') || cueElement.hasAttribute('dur');
    if (!hasTimeAttributes && !hasTextContent && cueElement.tagName != 'br' &&
        nestedCues.length == 0) {
      if (!isNested) {
        // Disregards empty <p> elements without time attributes nor content.
        // <p begin="..." smpte:backgroundImage="..." /> will go through,
        // as some information could be held by its attributes.
        // <p /> won't, as it would not be displayed.
        return null;
      } else {
        if (localWhitespaceTrim) {
          // Disregards empty anonymous spans when (local) trim is true.
          return null;
        }
      }
    }

    // Get local time attributes.
    let {start, end} = TtmlTextParser.parseTime_(cueElement, rateInfo);

    // Resolve local time relative to parent elements.  Time elements can appear
    // all the way up to 'body', but not 'tt'.
    while (parentElement && parentElement.nodeType == Node.ELEMENT_NODE &&
           parentElement.tagName != 'tt') {
      ({start, end} =
           TtmlTextParser.resolveTime_(parentElement, rateInfo, start, end));
      parentElement = (parentElement.parentNode as Element);
    }
    if (start == null) {
      start = 0;
    }
    start += offset;

    // If end is null, that means the duration is effectively infinite.
    if (end == null) {
      end = Infinity;
    } else {
      end += offset;
    }
    if (!hasTimeAttributes && nestedCues.length > 0) {
      // If no time is defined for this cue, base the timing information on
      // the time of the nested cues. In the case of multiple nested cues with
      // different start times, it is the text displayer's responsibility to
      // make sure that only the appropriate nested cue is drawn at any given
      // time.
      start = Infinity;
      end = 0;
      for (const cue of nestedCues) {
        start = Math.min(start, cue.startTime);
        end = Math.max(end, cue.endTime);
      }
    }
    if (cueElement.tagName == 'br') {
      const cue = new Cue(start, end, '');
      cue.lineBreak = true;
      return cue;
    }
    let payload = '';
    if (isLeafNode) {
      // If the childNodes are all text, this is a leaf node.  Get the payload.
      payload = cueElement.textContent;
      if (localWhitespaceTrim) {
        // Trim leading and trailing whitespace.
        payload = payload.trim();

        // Collapse multiple spaces into one.
        payload = payload.replace(/\s+/g, ' ');
      }
    }
    const cue = new Cue(start, end, payload);
    cue.nestedCues = nestedCues;
    if (!isContent) {
      // If this is not a <p> element or a <div> with images, and it has no
      // parent that was a <p> element, then it's part of the outer containers
      // (e.g. the <body> or a normal <div> element within it).
      cue.isContainer = true;
    }
    if (cellResolution) {
      cue.cellResolution = cellResolution;
    }

    // Get other properties if available.
    const regionElement = TtmlTextParser.getElementsFromCollection_(
        cueElement, 'region', regionElements,
        /* prefix= */
        '')[0];

    // Do not actually apply that region unless it is non-inherited, though.
    // This makes it so that, if a parent element has a region, the children
    // don't also all independently apply the positioning of that region.
    if (cueElement.hasAttribute('region')) {
      if (regionElement && regionElement.getAttribute('xml:id')) {
        const regionId = regionElement.getAttribute('xml:id');
        cue.region = cueRegions.filter((region) => region.id == regionId)[0];
      }
    }
    let regionElementForStyle = regionElement;
    if (parentCueElement && isNested && !cueElement.getAttribute('region') &&
        !cueElement.getAttribute('style')) {
      regionElementForStyle = TtmlTextParser.getElementsFromCollection_(
          parentCueElement, 'region', regionElements,
          /* prefix= */
          '')[0];
    }
    TtmlTextParser.addStyle_(
        cue, cueElement, regionElementForStyle, imageElement, styles,
        parentIsContent,
        /** isNested= */
        // "nested in a <div>" doesn't count.

        /** isLeaf= */
        nestedCues.length == 0);
    return cue;
  }

  /**
   * Parses an Element into a TextTrackCue or VTTCue.
   *
   * @param styles Defined in the top of tt  element and
   * used principally for images.
   */
  private static parseCueRegion_(
      regionElement: Element, styles: Element[],
      globalExtent: string|null): CueRegion {
    const TtmlTextParser = TtmlTextParser;
    const region = new CueRegion();
    const id = regionElement.getAttribute('xml:id');
    if (!id) {
      log.warning(
          'TtmlTextParser parser encountered a region with ' +
          'no id. Region will be ignored.');
      return null;
    }
    region.id = id;
    let globalResults = null;
    if (globalExtent) {
      globalResults = TtmlTextParser.percentValues_.exec(globalExtent) ||
          TtmlTextParser.pixelValues_.exec(globalExtent);
    }
    const globalWidth = globalResults ? Number(globalResults[1]) : null;
    const globalHeight = globalResults ? Number(globalResults[2]) : null;
    let results = null;
    let percentage = null;
    const extent = TtmlTextParser.getStyleAttributeFromRegion_(
        regionElement, styles, 'extent');
    if (extent) {
      percentage = TtmlTextParser.percentValues_.exec(extent);
      results = percentage || TtmlTextParser.pixelValues_.exec(extent);
      if (results != null) {
        region.width = Number(results[1]);
        region.height = Number(results[2]);
        if (!percentage) {
          if (globalWidth != null) {
            region.width = region.width * 100 / globalWidth;
          }
          if (globalHeight != null) {
            region.height = region.height * 100 / globalHeight;
          }
        }
        region.widthUnits = percentage || globalWidth != null ?
            CueRegionExports.units.PERCENTAGE :
            CueRegionExports.units.PX;
        region.heightUnits = percentage || globalHeight != null ?
            CueRegionExports.units.PERCENTAGE :
            CueRegionExports.units.PX;
      }
    }
    const origin = TtmlTextParser.getStyleAttributeFromRegion_(
        regionElement, styles, 'origin');
    if (origin) {
      percentage = TtmlTextParser.percentValues_.exec(origin);
      results = percentage || TtmlTextParser.pixelValues_.exec(origin);
      if (results != null) {
        region.viewportAnchorX = Number(results[1]);
        region.viewportAnchorY = Number(results[2]);
        if (!percentage) {
          if (globalHeight != null) {
            region.viewportAnchorY =
                region.viewportAnchorY * 100 / globalHeight;
          }
          if (globalWidth != null) {
            region.viewportAnchorX = region.viewportAnchorX * 100 / globalWidth;
          }
        }
        region.viewportAnchorUnits = percentage || globalWidth != null ?
            CueRegionExports.units.PERCENTAGE :
            CueRegionExports.units.PX;
      }
    }
    return region;
  }

  /**
   * Adds applicable style properties to a cue.
   *
   */
  private static addStyle_(
      cue: Cue, cueElement: Element, region: Element, imageElement: Element,
      styles: Element[], isNested: boolean, isLeaf: boolean) {
    const TtmlTextParser = TtmlTextParser;
    const Cue = Cue;

    // Styles should be inherited from regions, if a style property is not
    // associated with a Content element (or an anonymous span).
    const shouldInheritRegionStyles = isNested || isLeaf;
    const direction = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'direction', shouldInheritRegionStyles);
    if (direction == 'rtl') {
      cue.direction = Cue.direction.HORIZONTAL_RIGHT_TO_LEFT;
    }

    // Direction attribute specifies one-dimentional writing direction
    // (left to right or right to left). Writing mode specifies that
    // plus whether text is vertical or horizontal.
    // They should not contradict each other. If they do, we give
    // preference to writing mode.
    const writingMode = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'writingMode', shouldInheritRegionStyles);

    // Set cue's direction if the text is horizontal, and cue's writingMode if
    // it's vertical.
    if (writingMode == 'tb' || writingMode == 'tblr') {
      cue.writingMode = Cue.writingMode.VERTICAL_LEFT_TO_RIGHT;
    } else {
      if (writingMode == 'tbrl') {
        cue.writingMode = Cue.writingMode.VERTICAL_RIGHT_TO_LEFT;
      } else {
        if (writingMode == 'rltb' || writingMode == 'rl') {
          cue.direction = Cue.direction.HORIZONTAL_RIGHT_TO_LEFT;
        } else {
          if (writingMode) {
            cue.direction = Cue.direction.HORIZONTAL_LEFT_TO_RIGHT;
          }
        }
      }
    }
    const align = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'textAlign', true);
    if (align) {
      cue.positionAlign = TtmlTextParser.textAlignToPositionAlign_[align];
      cue.lineAlign = TtmlTextParser.textAlignToLineAlign_[align];
      asserts.assert(
          align.toUpperCase() in Cue.textAlign,
          align.toUpperCase() + ' Should be in Cue.textAlign values!');
      cue.textAlign = Cue.textAlign[align.toUpperCase()];
    } else {
      // Default value is START in the TTML spec: https://bit.ly/32OGmvo
      // But to make the subtitle render consitent with other players and the
      // shaka.text.Cue we use CENTER
      cue.textAlign = Cue.textAlign.CENTER;
    }
    const displayAlign = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'displayAlign', true);
    if (displayAlign) {
      asserts.assert(
          displayAlign.toUpperCase() in Cue.displayAlign,
          displayAlign.toUpperCase() +
              ' Should be in Cue.displayAlign values!');
      cue.displayAlign = Cue.displayAlign[displayAlign.toUpperCase()];
    }
    const color = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'color', shouldInheritRegionStyles);
    if (color) {
      cue.color = color;
    }

    // Background color should not be set on a container.  If this is a nested
    // cue, you can set the background.  If it's a top-level that happens to
    // also be a leaf, you can set the background.
    // See https://github.com/shaka-project/shaka-player/issues/2623
    // This used to be handled in the displayer, but that is confusing.  The Cue
    // structure should reflect what you want to happen in the displayer, and
    // the displayer shouldn't have to know about TTML.
    const backgroundColor = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'backgroundColor',
        shouldInheritRegionStyles);
    if (backgroundColor) {
      cue.backgroundColor = backgroundColor;
    }
    const border = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'border', shouldInheritRegionStyles);
    if (border) {
      cue.border = border;
    }
    const fontFamily = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'fontFamily', shouldInheritRegionStyles);
    if (fontFamily) {
      cue.fontFamily = fontFamily;
    }
    const fontWeight = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'fontWeight', shouldInheritRegionStyles);
    if (fontWeight && fontWeight == 'bold') {
      cue.fontWeight = Cue.fontWeight.BOLD;
    }
    const wrapOption = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'wrapOption', shouldInheritRegionStyles);
    if (wrapOption && wrapOption == 'noWrap') {
      cue.wrapLine = false;
    } else {
      cue.wrapLine = true;
    }
    const lineHeight = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'lineHeight', shouldInheritRegionStyles);
    if (lineHeight && lineHeight.match(TtmlTextParser.unitValues_)) {
      cue.lineHeight = lineHeight;
    }
    const fontSize = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'fontSize', shouldInheritRegionStyles);
    if (fontSize) {
      const isValidFontSizeUnit = fontSize.match(TtmlTextParser.unitValues_) ||
          fontSize.match(TtmlTextParser.percentValue_);
      if (isValidFontSizeUnit) {
        cue.fontSize = fontSize;
      }
    }
    const fontStyle = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'fontStyle', shouldInheritRegionStyles);
    if (fontStyle) {
      asserts.assert(
          fontStyle.toUpperCase() in Cue.fontStyle,
          fontStyle.toUpperCase() + ' Should be in Cue.fontStyle values!');
      cue.fontStyle = Cue.fontStyle[fontStyle.toUpperCase()];
    }
    if (imageElement) {
      // According to the spec, we should use imageType (camelCase), but
      // historically we have checked for imagetype (lowercase).
      // This was the case since background image support was first introduced
      // in PR #1859, in April 2019, and first released in v2.5.0.
      // Now we check for both, although only imageType (camelCase) is to spec.
      const backgroundImageType = imageElement.getAttribute('imageType') ||
          imageElement.getAttribute('imagetype');
      const backgroundImageEncoding = imageElement.getAttribute('encoding');
      const backgroundImageData = imageElement.textContent.trim();
      if (backgroundImageType == 'PNG' && backgroundImageEncoding == 'Base64' &&
          backgroundImageData) {
        cue.backgroundImage = 'data:image/png;base64,' + backgroundImageData;
      }
    }
    const textOutline = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'textOutline', shouldInheritRegionStyles);
    if (textOutline) {
      // tts:textOutline isn't natively supported by browsers, but it can be
      // mostly replicated using the non-standard -webkit-text-stroke-width and
      // -webkit-text-stroke-color properties.
      const split = textOutline.split(' ');
      if (split[0].match(TtmlTextParser.unitValues_)) {
        // There is no defined color, so default to the text color.
        cue.textStrokeColor = cue.color;
      } else {
        cue.textStrokeColor = split[0];
        split.shift();
      }
      if (split[0] && split[0].match(TtmlTextParser.unitValues_)) {
        cue.textStrokeWidth = split[0];
      } else {
        // If there is no width, or the width is not a number, don't draw a
        // border.
        cue.textStrokeColor = '';
      }
    }

    // There is an optional blur radius also, but we have no way of
    // replicating that, so ignore it.
    const letterSpacing = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'letterSpacing', shouldInheritRegionStyles);
    if (letterSpacing && letterSpacing.match(TtmlTextParser.unitValues_)) {
      cue.letterSpacing = letterSpacing;
    }
    const linePadding = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'linePadding', shouldInheritRegionStyles);
    if (linePadding && linePadding.match(TtmlTextParser.unitValues_)) {
      cue.linePadding = linePadding;
    }
    const opacity = TtmlTextParser.getStyleAttribute_(
        cueElement, region, styles, 'opacity', shouldInheritRegionStyles);
    if (opacity) {
      cue.opacity = parseFloat(opacity);
    }

    // Text decoration is an array of values which can come both from the
    // element's style or be inherited from elements' parent nodes. All of those
    // values should be applied as long as they don't contradict each other. If
    // they do, elements' own style gets preference.
    const textDecorationRegion = TtmlTextParser.getStyleAttributeFromRegion_(
        region, styles, 'textDecoration');
    if (textDecorationRegion) {
      TtmlTextParser.addTextDecoration_(cue, textDecorationRegion);
    }
    const textDecorationElement = TtmlTextParser.getStyleAttributeFromElement_(
        cueElement, styles, 'textDecoration');
    if (textDecorationElement) {
      TtmlTextParser.addTextDecoration_(cue, textDecorationElement);
    }
  }

  /**
   * Parses text decoration values and adds/removes them to/from the cue.
   *
   */
  private static addTextDecoration_(cue: Cue, decoration: string) {
    const Cue = Cue;
    for (const value of decoration.split(' ')) {
      switch (value) {
        case 'underline':
          if (!cue.textDecoration.includes(Cue.textDecoration.UNDERLINE)) {
            cue.textDecoration.push(Cue.textDecoration.UNDERLINE);
          }
          break;
        case 'noUnderline':
          if (cue.textDecoration.includes(Cue.textDecoration.UNDERLINE)) {
            ArrayUtils.remove(cue.textDecoration, Cue.textDecoration.UNDERLINE);
          }
          break;
        case 'lineThrough':
          if (!cue.textDecoration.includes(Cue.textDecoration.LINE_THROUGH)) {
            cue.textDecoration.push(Cue.textDecoration.LINE_THROUGH);
          }
          break;
        case 'noLineThrough':
          if (cue.textDecoration.includes(Cue.textDecoration.LINE_THROUGH)) {
            ArrayUtils.remove(
                cue.textDecoration, Cue.textDecoration.LINE_THROUGH);
          }
          break;
        case 'overline':
          if (!cue.textDecoration.includes(Cue.textDecoration.OVERLINE)) {
            cue.textDecoration.push(Cue.textDecoration.OVERLINE);
          }
          break;
        case 'noOverline':
          if (cue.textDecoration.includes(Cue.textDecoration.OVERLINE)) {
            ArrayUtils.remove(cue.textDecoration, Cue.textDecoration.OVERLINE);
          }
          break;
      }
    }
  }

  /**
   * Finds a specified attribute on either the original cue element or its
   * associated region and returns the value if the attribute was found.
   *
   */
  private static getStyleAttribute_(
      cueElement: Element, region: Element, styles: Element[],
      attribute: string, shouldInheritRegionStyles: boolean = true): string|
      null {
    // An attribute can be specified on region level or in a styling block
    // associated with the region or original element.
    const TtmlTextParser = TtmlTextParser;
    const attr = TtmlTextParser.getStyleAttributeFromElement_(
        cueElement, styles, attribute);
    if (attr) {
      return attr;
    }
    if (shouldInheritRegionStyles) {
      return TtmlTextParser.getStyleAttributeFromRegion_(
          region, styles, attribute);
    }
    return null;
  }

  /**
   * Finds a specified attribute on the element's associated region
   * and returns the value if the attribute was found.
   *
   */
  private static getStyleAttributeFromRegion_(
      region: Element, styles: Element[], attribute: string): string|null {
    const XmlUtils = XmlUtils;
    const ttsNs = styleNs_;
    if (!region) {
      return null;
    }
    const attr = XmlUtils.getAttributeNSList(region, ttsNs, attribute);
    if (attr) {
      return attr;
    }
    return TtmlTextParser.getInheritedStyleAttribute_(
        region, styles, attribute);
  }

  /**
   * Finds a specified attribute on the cue element and returns the value
   * if the attribute was found.
   *
   */
  private static getStyleAttributeFromElement_(
      cueElement: Element, styles: Element[], attribute: string): string|null {
    const XmlUtils = XmlUtils;
    const ttsNs = styleNs_;

    // Styling on elements should take precedence
    // over the main styling attributes
    const elementAttribute =
        XmlUtils.getAttributeNSList(cueElement, ttsNs, attribute);
    if (elementAttribute) {
      return elementAttribute;
    }
    return TtmlTextParser.getInheritedStyleAttribute_(
        cueElement, styles, attribute);
  }

  /**
   * Finds a specified attribute on an element's styles and the styles those
   * styles inherit from.
   *
   */
  private static getInheritedStyleAttribute_(
      element: Element, styles: Element[], attribute: string): string|null {
    const XmlUtils = XmlUtils;
    const ttsNs = styleNs_;
    const ebuttsNs = styleEbuttsNs_;
    const inheritedStyles = TtmlTextParser.getElementsFromCollection_(
        element, 'style', styles,
        /* prefix= */
        '');
    let styleValue = null;

    // The last value in our styles stack takes the precedence over the others
    for (let i = 0; i < inheritedStyles.length; i++) {
      // Check ebu namespace first.
      let styleAttributeValue =
          XmlUtils.getAttributeNS(inheritedStyles[i], ebuttsNs, attribute);
      if (!styleAttributeValue) {
        // Fall back to tts namespace.
        styleAttributeValue =
            XmlUtils.getAttributeNSList(inheritedStyles[i], ttsNs, attribute);
      }
      if (!styleAttributeValue) {
        // Next, check inheritance.
        // Styles can inherit from other styles, so traverse up that chain.
        styleAttributeValue = TtmlTextParser.getStyleAttributeFromElement_(
            inheritedStyles[i], styles, attribute);
      }
      if (styleAttributeValue) {
        styleValue = styleAttributeValue;
      }
    }
    return styleValue;
  }

  /**
   * Selects items from |collection| whose id matches |attributeName|
   * from |element|.
   *
   */
  private static getElementsFromCollection_(
      element: Element, attributeName: string, collection: Element[],
      prefixName: string, nsName?: string): Element[] {
    const items = [];
    if (!element || collection.length < 1) {
      return items;
    }
    const attributeValue =
        TtmlTextParser.getInheritedAttribute_(element, attributeName, nsName);
    if (attributeValue) {
      // There could be multiple items in one attribute
      // <span style="style1 style2">A cue</span>
      const itemNames = attributeValue.split(' ');
      for (const name of itemNames) {
        for (const item of collection) {
          if (prefixName + item.getAttribute('xml:id') == name) {
            items.push(item);
            break;
          }
        }
      }
    }
    return items;
  }

  /**
   * Traverses upwards from a given node until a given attribute is found.
   *
   */
  private static getInheritedAttribute_(
      element: Element, attributeName: string, nsName?: string): string|null {
    let ret = null;
    const XmlUtils = XmlUtils;
    while (element) {
      ret = nsName ? XmlUtils.getAttributeNS(element, nsName, attributeName) :
                     element.getAttribute(attributeName);
      if (ret) {
        break;
      }

      // Element.parentNode can lead to XMLDocument, which is not an Element and
      // has no getAttribute().
      const parentNode = element.parentNode;
      if (parentNode instanceof Element) {
        element = parentNode;
      } else {
        break;
      }
    }
    return ret;
  }

  /**
   * Factor parent/ancestor time attributes into the parsed time of a
   * child/descendent.
   *
   * @param start The child's start time
   * @param end The child's end time
   */
  private static resolveTime_(
      parentElement: Element, rateInfo: RateInfo_, start: number|null,
      end: number|null): {start: number|null, end: number|null} {
    const parentTime = TtmlTextParser.parseTime_(parentElement, rateInfo);
    if (start == null) {
      // No start time of your own?  Inherit from the parent.
      start = parentTime.start;
    } else {
      // Otherwise, the start time is relative to the parent's start time.
      if (parentTime.start != null) {
        start += parentTime.start;
      }
    }
    if (end == null) {
      // No end time of your own?  Inherit from the parent.
      end = parentTime.end;
    } else {
      // Otherwise, the end time is relative to the parent's _start_ time.
      // This is not a typo.  Both times are relative to the parent's _start_.
      if (parentTime.start != null) {
        end += parentTime.start;
      }
    }
    return {start, end};
  }

  /**
   * Parse TTML time attributes from the given element.
   *
   */
  private static parseTime_(element: Element, rateInfo: RateInfo_):
      {start: number|null, end: number|null} {
    const start = TtmlTextParser.parseTimeAttribute_(
        element.getAttribute('begin'), rateInfo);
    let end = TtmlTextParser.parseTimeAttribute_(
        element.getAttribute('end'), rateInfo);
    const duration = TtmlTextParser.parseTimeAttribute_(
        element.getAttribute('dur'), rateInfo);
    if (end == null && duration != null) {
      end = start + duration;
    }
    return {start, end};
  }

  /**
   * Parses a TTML time from the given attribute text.
   *
   */
  private static parseTimeAttribute_(text: string, rateInfo: RateInfo_): number|
      null {
    let ret = null;
    const TtmlTextParser = TtmlTextParser;
    if (TtmlTextParser.timeColonFormatFrames_.test(text)) {
      ret = TtmlTextParser.parseColonTimeWithFrames_(rateInfo, text);
    } else {
      if (TtmlTextParser.timeColonFormat_.test(text)) {
        ret = TtmlTextParser.parseTimeFromRegex_(
            TtmlTextParser.timeColonFormat_, text);
      } else {
        if (TtmlTextParser.timeColonFormatMilliseconds_.test(text)) {
          ret = TtmlTextParser.parseTimeFromRegex_(
              TtmlTextParser.timeColonFormatMilliseconds_, text);
        } else {
          if (TtmlTextParser.timeFramesFormat_.test(text)) {
            ret = TtmlTextParser.parseFramesTime_(rateInfo, text);
          } else {
            if (TtmlTextParser.timeTickFormat_.test(text)) {
              ret = TtmlTextParser.parseTickTime_(rateInfo, text);
            } else {
              if (TtmlTextParser.timeHMSFormat_.test(text)) {
                ret = TtmlTextParser.parseTimeFromRegex_(
                    TtmlTextParser.timeHMSFormat_, text);
              } else {
                if (text) {
                  // It's not empty or null, but it doesn't match a known
                  // format.
                  throw new Error(
                      ErrorExports.Severity.CRITICAL,
                      ErrorExports.Category.TEXT,
                      ErrorExports.Code.INVALID_TEXT_CUE,
                      'Could not parse cue time range in TTML');
                }
              }
            }
          }
        }
      }
    }
    return ret;
  }

  /**
   * Parses a TTML time in frame format.
   *
   */
  private static parseFramesTime_(rateInfo: RateInfo_, text: string): number|
      null {
    // 75f or 75.5f
    const results = timeFramesFormat_.exec(text);
    const frames = Number(results[1]);
    return frames / rateInfo.frameRate;
  }

  /**
   * Parses a TTML time in tick format.
   *
   */
  private static parseTickTime_(rateInfo: RateInfo_, text: string): number|
      null {
    // 50t or 50.5t
    const results = timeTickFormat_.exec(text);
    const ticks = Number(results[1]);
    return ticks / rateInfo.tickRate;
  }

  /**
   * Parses a TTML colon formatted time containing frames.
   *
   */
  private static parseColonTimeWithFrames_(
      rateInfo: RateInfo_, text: string): number|null {
    // 01:02:43:07 ('07' is frames) or 01:02:43:07.1 (subframes)
    const results = timeColonFormatFrames_.exec(text);
    const hours = Number(results[1]);
    const minutes = Number(results[2]);
    let seconds = Number(results[3]);
    let frames = Number(results[4]);
    const subframes = Number(results[5]) || 0;
    frames += subframes / rateInfo.subFrameRate;
    seconds += frames / rateInfo.frameRate;
    return seconds + minutes * 60 + hours * 3600;
  }

  /**
   * Parses a TTML time with a given regex. Expects regex to be some
   * sort of a time-matcher to match hours, minutes, seconds and milliseconds
   *
   */
  private static parseTimeFromRegex_(regex: RegExp, text: string): number|null {
    const results = regex.exec(text);
    if (results == null || results[0] == '') {
      return null;
    }

    // This capture is optional, but will still be in the array as undefined,
    // in which case it is 0.
    const hours = Number(results[1]) || 0;
    const minutes = Number(results[2]) || 0;
    const seconds = Number(results[3]) || 0;
    const milliseconds = Number(results[4]) || 0;
    return milliseconds / 1000 + seconds + minutes * 60 + hours * 3600;
  }

  /**
   * If ttp:cellResolution provided returns cell resolution info
   * with number of columns and rows into which the Root Container
   * Region area is divided
   *
   */
  private static getCellResolution_(cellResolution: string|null):
      {columns: number, rows: number}|null {
    if (!cellResolution) {
      return null;
    }
    const matches = /^(\d+) (\d+)$/.exec(cellResolution);
    if (!matches) {
      return null;
    }
    const columns = parseInt(matches[1], 10);
    const rows = parseInt(matches[2], 10);
    return {columns, rows};
  }
}

/**
 * @summary
 * Contains information about frame/subframe rate
 * and frame rate multiplier for time in frame format.
 *
 * @example 01:02:03:04(4 frames) or 01:02:03:04.1(4 frames, 1 subframe)
 */
export class RateInfo_ {
  frameRate: number;
  subFrameRate: number;
  tickRate: number;

  constructor(
      frameRate: string|null, subFrameRate: string|null,
      frameRateMultiplier: string|null, tickRate: string|null) {
    this.frameRate = Number(frameRate) || 30;
    this.subFrameRate = Number(subFrameRate) || 1;
    this.tickRate = Number(tickRate);
    if (this.tickRate == 0) {
      if (frameRate) {
        this.tickRate = this.frameRate * this.subFrameRate;
      } else {
        this.tickRate = 1;
      }
    }
    if (frameRateMultiplier) {
      const multiplierResults = /^(\d+) (\d+)$/g.exec(frameRateMultiplier);
      if (multiplierResults) {
        const numerator = Number(multiplierResults[1]);
        const denominator = Number(multiplierResults[2]);
        const multiplierNum = numerator / denominator;
        this.frameRate *= multiplierNum;
      }
    }
  }
}

/**
 * @example 50.17% 10%
 */
export const percentValues_: RegExp =
    /^(\d{1,2}(?:\.\d+)?|100(?:\.0+)?)% (\d{1,2}(?:\.\d+)?|100(?:\.0+)?)%$/;

/**
 * @example 0.6% 90%
 */
export const percentValue_: RegExp = /^(\d{1,2}(?:\.\d+)?|100)%$/;

/**
 * @example 100px, 8em, 0.80c
 */
export const unitValues_: RegExp = /^(\d+px|\d+em|\d*\.?\d+c)$/;

/**
 * @example 100px
 */
export const pixelValues_: RegExp = /^(\d+)px (\d+)px$/;

/**
 * @example 00:00:40:07 (7 frames) or 00:00:40:07.1 (7 frames, 1 subframe)
 */
export const timeColonFormatFrames_: RegExp =
    /^(\d{2,}):(\d{2}):(\d{2}):(\d{2})\.?(\d+)?$/;

/**
 * @example 00:00:40 or 00:40
 */
export const timeColonFormat_: RegExp = /^(?:(\d{2,}):)?(\d{2}):(\d{2})$/;

/**
 * @example 01:02:43.0345555 or 02:43.03
 */
export const timeColonFormatMilliseconds_: RegExp =
    /^(?:(\d{2,}):)?(\d{2}):(\d{2}\.\d{2,})$/;

/**
 * @example 75f or 75.5f
 */
export const timeFramesFormat_: RegExp = /^(\d*(?:\.\d*)?)f$/;

/**
 * @example 50t or 50.5t
 */
export const timeTickFormat_: RegExp = /^(\d*(?:\.\d*)?)t$/;

/**
 * @example 3.45h, 3m or 4.20s
 */
export const timeHMSFormat_: RegExp = new RegExp([
  '^(?:(\\d*(?:\\.\\d*)?)h)?', '(?:(\\d*(?:\\.\\d*)?)m)?',
  '(?:(\\d*(?:\\.\\d*)?)s)?', '(?:(\\d*(?:\\.\\d*)?)ms)?$'
].join(''));

export const textAlignToLineAlign_: {[key: string]: CueExports.lineAlign} = {
  'left': CueExports.lineAlign.START,
  'center': CueExports.lineAlign.CENTER,
  'right': CueExports.lineAlign.END,
  'start': CueExports.lineAlign.START,
  'end': CueExports.lineAlign.END
};

export const textAlignToPositionAlign_:
    {[key: string]: CueExports.positionAlign} = {
      'left': CueExports.positionAlign.LEFT,
      'center': CueExports.positionAlign.CENTER,
      'right': CueExports.positionAlign.RIGHT
    };

/**
 * The namespace URL for TTML parameters.  Can be assigned any name in the TTML
 * document, not just "ttp:", so we use this with getAttributeNS() to ensure
 * that we support arbitrary namespace names.
 *
 */
export const parameterNs_: string[] = [
  'http://www.w3.org/ns/ttml#parameter',
  'http://www.w3.org/2006/10/ttaf1#parameter'
];

/**
 * The namespace URL for TTML styles.  Can be assigned any name in the TTML
 * document, not just "tts:", so we use this with getAttributeNS() to ensure
 * that we support arbitrary namespace names.
 *
 */
export const styleNs_: string[] = [
  'http://www.w3.org/ns/ttml#styling', 'http://www.w3.org/2006/10/ttaf1#styling'
];

/**
 * The namespace URL for EBU TTML styles.  Can be assigned any name in the TTML
 * document, not just "ebutts:", so we use this with getAttributeNS() to ensure
 * that we support arbitrary namespace names.
 *
 */
export const styleEbuttsNs_: string = 'urn:ebu:tt:style';

/**
 * The supported namespace URLs for SMPTE fields.
 */
export const smpteNsList_: string[] = [
  'http://www.smpte-ra.org/schemas/2052-1/2010/smpte-tt',
  'http://www.smpte-ra.org/schemas/2052-1/2013/smpte-tt'
];
TextEngine.registerParser('application/ttml+xml', () => new TtmlTextParser());
