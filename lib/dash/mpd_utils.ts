/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as DashParserExports from './dash___dash_parser';
import {DashParser} from './dash___dash_parser';
import * as assertsExports from './debug___asserts';
import {asserts} from './debug___asserts';
import * as logExports from './debug___log';
import {log} from './debug___log';
import * as NetworkingEngineExports from './net___networking_engine';
import {NetworkingEngine} from './net___networking_engine';
import {AbortableOperation} from './util___abortable_operation';
import * as ErrorExports from './util___error';
import {Error} from './util___error';
import {Functional} from './util___functional';
import * as ManifestParserUtilsExports from './util___manifest_parser_utils';
import {ManifestParserUtils} from './util___manifest_parser_utils';
import {XmlUtils} from './util___xml_utils';

/**
 * @summary MPD processing utility functions.
 */
export class MpdUtils {
  /**
   * Fills a SegmentTemplate URI template.  This function does not validate the
   * resulting URI.
   *
   * @return A URI string.
   * @see ISO/IEC 23009-1:2014 section 5.3.9.4.4
   */
  static fillUriTemplate(
      uriTemplate: string, representationId: string|null, number: number|null,
      bandwidth: number|null, time: number|null): string {
    const valueTable: {[key: string]: number|null|string|null} = {
      'RepresentationID': representationId,
      'Number': number,
      'Bandwidth': bandwidth,
      'Time': time
    };
    const re =
        /\$(RepresentationID|Number|Bandwidth|Time)?(?:%0([0-9]+)([diouxX]))?\$/g;

    // eslint-disable-line max-len
    const uri = uriTemplate.replace(re, (match, name, widthStr, format) => {
      if (match == '$$') {
        return '$';
      }
      let value = valueTable[name];
      asserts.assert(value !== undefined, 'Unrecognized identifier');

      // Note that |value| may be 0 or ''.
      if (value == null) {
        log.warning(
            'URL template does not have an available substitution for ',
            'identifier "' + name + '":', uriTemplate);
        return match;
      }
      if (name == 'RepresentationID' && widthStr) {
        log.warning(
            'URL template should not contain a width specifier for identifier',
            '"RepresentationID":', uriTemplate);
        widthStr = undefined;
      }
      if (name == 'Time') {
        asserts.assert(
            typeof value == 'number', 'Time value should be a number!');
        asserts.assert(
            Math.abs(value - Math.round(value)) < 0.2,
            'Calculated $Time$ values must be close to integers');
        value = Math.round(value);
      }
      let valueString: string;
      switch (format) {
        case undefined:

        // Happens if there is no format specifier.
        case 'd':
        case 'i':
        case 'u':
          valueString = value.toString();
          break;
        case 'o':
          valueString = value.toString(8);
          break;
        case 'x':
          valueString = value.toString(16);
          break;
        case 'X':
          valueString = value.toString(16).toUpperCase();
          break;
        default:
          asserts.assert(false, 'Unhandled format specifier');
          valueString = value.toString();
          break;
      }

      // Create a padding string.
      const width = window.parseInt(widthStr, 10) || 1;
      const paddingSize = Math.max(0, width - valueString.length);
      const padding = (new Array(paddingSize + 1)).join('0');
      return padding + valueString;
    });
    return uri;
  }

  /**
   * Expands a SegmentTimeline into an array-based timeline.  The results are in
   * seconds.
   *
   * @param periodDuration The Period's duration in seconds.
   *   Infinity indicates that the Period continues indefinitely.
   */
  static createTimeline(
      segmentTimeline: Element, timescale: number,
      unscaledPresentationTimeOffset: number,
      periodDuration: number): TimeRange[] {
    asserts.assert(
        timescale > 0 && timescale < Infinity,
        'timescale must be a positive, finite integer');
    asserts.assert(
        periodDuration > 0, 'period duration must be a positive integer');

    // Alias.
    const XmlUtils = XmlUtils;
    const timePoints = XmlUtils.findChildren(segmentTimeline, 'S');
    const timeline: TimeRange[] = [];
    let lastEndTime = -unscaledPresentationTimeOffset;
    for (let i = 0; i < timePoints.length; ++i) {
      const timePoint = timePoints[i];
      const next = timePoints[i + 1];
      let t = XmlUtils.parseAttr(timePoint, 't', XmlUtils.parseNonNegativeInt);
      const d =
          XmlUtils.parseAttr(timePoint, 'd', XmlUtils.parseNonNegativeInt);
      const r = XmlUtils.parseAttr(timePoint, 'r', XmlUtils.parseInt);

      // Adjust the start time to account for the presentation time offset.
      if (t != null) {
        t -= unscaledPresentationTimeOffset;
      }
      if (!d) {
        log.warning(
            '"S" element must have a duration:',
            'ignoring the remaining "S" elements.', timePoint);
        return timeline;
      }
      let startTime = t != null ? t : lastEndTime;
      let repeat = r || 0;
      if (repeat < 0) {
        if (next) {
          const nextStartTime =
              XmlUtils.parseAttr(next, 't', XmlUtils.parseNonNegativeInt);
          if (nextStartTime == null) {
            log.warning(
                'An "S" element cannot have a negative repeat',
                'if the next "S" element does not have a valid start time:',
                'ignoring the remaining "S" elements.', timePoint);
            return timeline;
          } else {
            if (startTime >= nextStartTime) {
              log.warning(
                  'An "S" element cannot have a negative repeatif its start ',
                  'time exceeds the next "S" element\'s start time:',
                  'ignoring the remaining "S" elements.', timePoint);
              return timeline;
            }
          }
          repeat = Math.ceil((nextStartTime - startTime) / d) - 1;
        } else {
          if (periodDuration == Infinity) {
            // The DASH spec. actually allows the last "S" element to have a
            // negative repeat value even when the Period has an infinite
            // duration.  No one uses this feature and no one ever should,
            // ever.
            log.warning(
                'The last "S" element cannot have a negative repeat',
                'if the Period has an infinite duration:',
                'ignoring the last "S" element.', timePoint);
            return timeline;
          } else {
            if (startTime / timescale >= periodDuration) {
              log.warning(
                  'The last "S" element cannot have a negative repeat',
                  'if its start time exceeds the Period\'s duration:',
                  'igoring the last "S" element.', timePoint);
              return timeline;
            }
          }
          repeat = Math.ceil((periodDuration * timescale - startTime) / d) - 1;
        }
      }

      // The end of the last segment may be before the start of the current
      // segment (a gap) or after the start of the current segment (an
      // overlap). If there is a gap/overlap then stretch/compress the end of
      // the last segment to the start of the current segment.
      // Note: it is possible to move the start of the current segment to the
      // end of the last segment, but this would complicate the computation of
      // the $Time$ placeholder later on.
      if (timeline.length > 0 && startTime != lastEndTime) {
        const delta = startTime - lastEndTime;
        if (Math.abs(delta / timescale) >=
            ManifestParserUtilsExports.GAP_OVERLAP_TOLERANCE_SECONDS) {
          log.warning(
              'SegmentTimeline contains a large gap/overlap:',
              'the content may have errors in it.', timePoint);
        }
        timeline[timeline.length - 1].end = startTime / timescale;
      }
      for (let j = 0; j <= repeat; ++j) {
        const endTime = startTime + d;
        const item = {
          start: startTime / timescale,
          end: endTime / timescale,
          unscaledStart: startTime
        };
        timeline.push(item);
        startTime = endTime;
        lastEndTime = endTime;
      }
    }
    return timeline;
  }

  /**
   * Parses common segment info for SegmentList and SegmentTemplate.
   *
   *   Gets the element that contains the segment info.
   */
  static parseSegmentInfo(
      context: DashParserExports.Context,
      callback: (p1: DashParserExports.InheritanceFrame|null) => Element):
      SegmentInfo {
    asserts.assert(
        callback(context.representation),
        'There must be at least one element of the given type.');
    const MpdUtils = MpdUtils;
    const XmlUtils = XmlUtils;
    const timescaleStr =
        MpdUtils.inheritAttribute(context, callback, 'timescale');
    let timescale = 1;
    if (timescaleStr) {
      timescale = XmlUtils.parsePositiveInt(timescaleStr) || 1;
    }
    const durationStr =
        MpdUtils.inheritAttribute(context, callback, 'duration');
    let segmentDuration = XmlUtils.parsePositiveInt(durationStr || '');
    const ContentType = ManifestParserUtilsExports.ContentType;

    // TODO: The specification is not clear, check this once it is resolved:
    // https://github.com/Dash-Industry-Forum/DASH-IF-IOP/issues/404
    if (context.representation.contentType == ContentType.IMAGE) {
      segmentDuration = XmlUtils.parseFloat(durationStr || '');
    }
    if (segmentDuration) {
      segmentDuration /= timescale;
    }
    const startNumberStr =
        MpdUtils.inheritAttribute(context, callback, 'startNumber');
    const unscaledPresentationTimeOffset =
        Number(MpdUtils.inheritAttribute(
            context, callback, 'presentationTimeOffset')) ||
        0;
    let startNumber = XmlUtils.parseNonNegativeInt(startNumberStr || '');
    if (startNumberStr == null || startNumber == null) {
      startNumber = 1;
    }
    const timelineNode =
        MpdUtils.inheritChild(context, callback, 'SegmentTimeline');
    let timeline: TimeRange[] = null;
    if (timelineNode) {
      timeline = MpdUtils.createTimeline(
          timelineNode, timescale, unscaledPresentationTimeOffset,
          context.periodInfo.duration || Infinity);
    }
    const scaledPresentationTimeOffset =
        unscaledPresentationTimeOffset / timescale || 0;
    return {
      timescale: timescale,
      segmentDuration: segmentDuration,
      startNumber: startNumber,
      scaledPresentationTimeOffset: scaledPresentationTimeOffset,
      unscaledPresentationTimeOffset: unscaledPresentationTimeOffset,
      timeline: timeline
    };
  }

  /**
   * Searches the inheritance for a Segment* with the given attribute.
   *
   *   Gets the Element that contains the attribute to inherit.
   */
  static inheritAttribute(
      context: DashParserExports.Context,
      callback: (p1: DashParserExports.InheritanceFrame|null) => Element,
      attribute: string): string|null {
    const Functional = Functional;
    asserts.assert(
        callback(context.representation),
        'There must be at least one element of the given type');
    const nodes: Element[] = [
      callback(context.representation), callback(context.adaptationSet),
      callback(context.period)
    ].filter(Functional.isNotNull);
    return nodes
        .map((s) => {
          return s.getAttribute(attribute);
        })
        .reduce((all, part) => {
          return all || part;
        });
  }

  /**
   * Searches the inheritance for a Segment* with the given child.
   *
   *   Gets the Element that contains the child to inherit.
   */
  static inheritChild(
      context: DashParserExports.Context,
      callback: (p1: DashParserExports.InheritanceFrame|null) => Element,
      child: string): Element {
    const Functional = Functional;
    asserts.assert(
        callback(context.representation),
        'There must be at least one element of the given type');
    const nodes: Element[] = [
      callback(context.representation), callback(context.adaptationSet),
      callback(context.period)
    ].filter(Functional.isNotNull);
    const XmlUtils = XmlUtils;
    return nodes
        .map((s) => {
          return XmlUtils.findChild(s, child);
        })
        .reduce((all, part) => {
          return all || part;
        });
  }

  /**
   * Follow the xlink link contained in the given element.
   * It also strips the xlink properties off of the element,
   * even if the process fails.
   *
   */
  private static handleXlinkInElement_(
      element: Element, retryParameters: shaka.extern.RetryParameters,
      failGracefully: boolean, baseUri: string,
      networkingEngine: NetworkingEngine,
      linkDepth: number): AbortableOperation<Element> {
    const MpdUtils = MpdUtils;
    const XmlUtils = XmlUtils;
    const Error = Error;
    const ManifestParserUtils = ManifestParserUtils;
    const NS = MpdUtils.XlinkNamespaceUri_;
    const xlinkHref = XmlUtils.getAttributeNS(element, NS, 'href');
    const xlinkActuate =
        XmlUtils.getAttributeNS(element, NS, 'actuate') || 'onRequest';

    // Remove the xlink properties, so it won't download again
    // when re-processed.
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI == NS) {
        element.removeAttributeNS(attribute.namespaceURI, attribute.localName);
      }
    }
    if (linkDepth >= 5) {
      return AbortableOperation.failed(new Error(
          Error.Severity.CRITICAL, Error.Category.MANIFEST,
          Error.Code.DASH_XLINK_DEPTH_LIMIT));
    }
    if (xlinkActuate != 'onLoad') {
      // Only xlink:actuate="onLoad" is supported.
      // When no value is specified, the assumed value is "onRequest".
      return AbortableOperation.failed(new Error(
          Error.Severity.CRITICAL, Error.Category.MANIFEST,
          Error.Code.DASH_UNSUPPORTED_XLINK_ACTUATE));
    }

    // Resolve the xlink href, in case it's a relative URL.
    const uris = ManifestParserUtils.resolveUris([baseUri], [xlinkHref]);

    // Load in the linked elements.
    const requestType = NetworkingEngineExports.RequestType.MANIFEST;
    const request = NetworkingEngine.makeRequest(uris, retryParameters);
    const requestOperation = networkingEngine.request(requestType, request);

    // The interface is abstract, but we know it was implemented with the
    // more capable internal class.
    asserts.assert(
        requestOperation instanceof AbortableOperation,
        'Unexpected implementation of IAbortableOperation!');

    // Satisfy the compiler with a cast.
    const networkOperation =
        (requestOperation as AbortableOperation<shaka.extern.Response>);

    // Chain onto that operation.
    return networkOperation.chain((response) => {
      // This only supports the case where the loaded xml has a single
      // top-level element.  If there are multiple roots, it will be
      // rejected.
      const rootElem = XmlUtils.parseXml(response.data, element.tagName);
      if (!rootElem) {
        // It was not valid XML.
        return AbortableOperation.failed(new Error(
            Error.Severity.CRITICAL, Error.Category.MANIFEST,
            Error.Code.DASH_INVALID_XML, xlinkHref));
      }

      // Now that there is no other possibility of the process erroring,
      // the element can be changed further.

      // Remove the current contents of the node.
      while (element.childNodes.length) {
        element.removeChild(element.childNodes[0]);
      }

      // Move the children of the loaded xml into the current element.
      while (rootElem.childNodes.length) {
        const child = rootElem.childNodes[0];
        rootElem.removeChild(child);
        element.appendChild(child);
      }

      // Move the attributes of the loaded xml into the current element.
      for (const attribute of Array.from(rootElem.attributes)) {
        element.setAttributeNode(
            /* deep= */
            attribute.cloneNode(false));
      }
      return MpdUtils.processXlinks(
          element, retryParameters, failGracefully, uris[0], networkingEngine,
          linkDepth + 1);
    });
  }

  /**
   * Filter the contents of a node recursively, replacing xlink links
   * with their associated online data.
   *
   * @param linkDepth, default set to 0
   */
  static processXlinks(
      element: Element, retryParameters: shaka.extern.RetryParameters,
      failGracefully: boolean, baseUri: string,
      networkingEngine: NetworkingEngine,
      linkDepth: number = 0): AbortableOperation<Element> {
    const MpdUtils = MpdUtils;
    const XmlUtils = XmlUtils;
    const NS = MpdUtils.XlinkNamespaceUri_;
    if (XmlUtils.getAttributeNS(element, NS, 'href')) {
      let handled = MpdUtils.handleXlinkInElement_(
          element, retryParameters, failGracefully, baseUri, networkingEngine,
          linkDepth);
      if (failGracefully) {
        // Catch any error and go on.
        handled = handled.chain(undefined, (error) => {
          // handleXlinkInElement_ strips the xlink properties off of the
          // element even if it fails, so calling processXlinks again will
          // handle whatever contents the element natively has.
          return MpdUtils.processXlinks(
              element, retryParameters, failGracefully, baseUri,
              networkingEngine, linkDepth);
        });
      }
      return handled;
    }
    const childOperations = [];
    for (const child of Array.from(element.childNodes)) {
      if (child instanceof Element) {
        const resolveToZeroString = 'urn:mpeg:dash:resolve-to-zero:2013';
        if (XmlUtils.getAttributeNS(child, NS, 'href') == resolveToZeroString) {
          // This is a 'resolve to zero' code; it means the element should
          // be removed, as specified by the mpeg-dash rules for xlink.
          element.removeChild(child);
        } else {
          if (child.tagName != 'SegmentTimeline') {
            // Replace the child with its processed form.
            childOperations.push(MpdUtils.processXlinks(
                (child as Element), retryParameters, failGracefully, baseUri,
                networkingEngine, linkDepth));
          }
        }
      }
    }
    return AbortableOperation.all(childOperations).chain(() => {
      return element;
    });
  }
}
type TimeRange = {
  start: number,
  unscaledStart: number,
  end: number
};

export {TimeRange};
type SegmentInfo = {
  timescale: number,
  segmentDuration: number|null,
  startNumber: number,
  scaledPresentationTimeOffset: number,
  unscaledPresentationTimeOffset: number,
  timeline: TimeRange[]
};

export {SegmentInfo};

export const XlinkNamespaceUri_: string = 'http://www.w3.org/1999/xlink';
