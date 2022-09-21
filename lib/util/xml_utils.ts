/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as assertsExports from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import {asserts} from './dev-workspace.shaka-player-fork.lib.debug.asserts';
import * as logExports from './dev-workspace.shaka-player-fork.lib.debug.log';
import {log} from './dev-workspace.shaka-player-fork.lib.debug.log';
import * as StringUtilsExports from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {StringUtils} from './dev-workspace.shaka-player-fork.lib.util.string_utils';

/**
 * @summary A set of XML utility functions.
 */
export class XmlUtils {
  /**
   * Finds a child XML element.
   * @param elem The parent XML element.
   * @param name The child XML element's tag name.
   * @return The child XML element, or null if a child XML element
   *   does not exist with the given tag name OR if there exists more than one
   *   child XML element with the given tag name.
   */
  static findChild(elem: Node, name: string): Element {
    const children = XmlUtils.findChildren(elem, name);
    if (children.length != 1) {
      return null;
    }
    return children[0];
  }

  /**
   * Finds a namespace-qualified child XML element.
   * @param elem The parent XML element.
   * @param ns The child XML element's namespace URI.
   * @param name The child XML element's local name.
   * @return The child XML element, or null if a child XML element
   *   does not exist with the given tag name OR if there exists more than one
   *   child XML element with the given tag name.
   */
  static findChildNS(elem: Node, ns: string, name: string): Element {
    const children = XmlUtils.findChildrenNS(elem, ns, name);
    if (children.length != 1) {
      return null;
    }
    return children[0];
  }

  /**
   * Finds child XML elements.
   * @param elem The parent XML element.
   * @param name The child XML element's tag name.
   * @return The child XML elements.
   */
  static findChildren(elem: Node, name: string): Element[] {
    const found = [];
    for (const child of elem.childNodes) {
      if (child instanceof Element && child.tagName == name) {
        found.push(child);
      }
    }
    return found;
  }

  /**
   * @param elem the parent XML element.
   * @return The child XML elements.
   */
  static getChildren(elem: Node): Element[] {
    return Array.from(elem.childNodes).filter((child) => {
      return child instanceof Element;
    });
  }

  /**
   * Finds namespace-qualified child XML elements.
   * @param elem The parent XML element.
   * @param ns The child XML element's namespace URI.
   * @param name The child XML element's local name.
   * @return The child XML elements.
   */
  static findChildrenNS(elem: Node, ns: string, name: string): Element[] {
    const found = [];
    for (const child of elem.childNodes) {
      if (child instanceof Element && child.localName == name &&
          child.namespaceURI == ns) {
        found.push(child);
      }
    }
    return found;
  }

  /**
   * Gets a namespace-qualified attribute.
   * @param elem The element to get from.
   * @param ns The namespace URI.
   * @param name The local name of the attribute.
   * @return The attribute's value, or null if not present.
   */
  static getAttributeNS(elem: Element, ns: string, name: string): string|null {
    // Some browsers return the empty string when the attribute is missing,
    // so check if it exists first.  See: https://mzl.la/2L7F0UK
    return elem.hasAttributeNS(ns, name) ? elem.getAttributeNS(ns, name) : null;
  }

  /**
   * Gets a namespace-qualified attribute.
   * @param elem The element to get from.
   * @param nsList The lis of namespace URIs.
   * @param name The local name of the attribute.
   * @return The attribute's value, or null if not present.
   */
  static getAttributeNSList(elem: Element, nsList: string[], name: string):
      string|null {
    // Some browsers return the empty string when the attribute is missing,
    // so check if it exists first.  See: https://mzl.la/2L7F0UK
    for (const ns of nsList) {
      if (elem.hasAttributeNS(ns, name)) {
        return elem.getAttributeNS(ns, name);
      }
    }
    return null;
  }

  /**
   * Gets the text contents of a node.
   * @param elem The XML element.
   * @return The text contents, or null if there are none.
   */
  static getContents(elem: Node): string|null {
    const XmlUtils = XmlUtils;
    if (!Array.from(elem.childNodes).every(XmlUtils.isText)) {
      return null;
    }

    // Read merged text content from all text nodes.
    return elem.textContent.trim();
  }

  /**
   * Checks if a node is of type text.
   * @param elem The XML element.
   * @return True if it is a text node.
   */
  static isText(elem: Node): boolean {
    return elem.nodeType == Node.TEXT_NODE ||
        elem.nodeType == Node.CDATA_SECTION_NODE;
  }

  /**
   * Parses an attribute by its name.
   * @param elem The XML element.
   * @param name The attribute name.
   * @param parseFunction A function that parses
   *   the attribute.
   * @param defaultValue The attribute's default value, if not
   *   specified, the attibute's default value is null.
   * @return The parsed attribute on success, or the attribute's
   *   default value if the attribute does not exist or could not be parsed.
   * @template T
   */
  static parseAttr(
      elem: Element, name: string, parseFunction: (p1: string) => T | null,
      defaultValue: T|null = null): T|null {
    let parsedValue = null;
    const value = elem.getAttribute(name);
    if (value != null) {
      parsedValue = parseFunction(value);
    }
    return parsedValue == null ? defaultValue : parsedValue;
  }

  /**
   * Parses an XML date string.
   * @return The parsed date in seconds on success; otherwise, return
   *   null.
   */
  static parseDate(dateString: string): number|null {
    if (!dateString) {
      return null;
    }

    // Times in the manifest should be in UTC. If they don't specify a timezone,
    // Date.parse() will use the local timezone instead of UTC.  So manually add
    // the timezone if missing ('Z' indicates the UTC timezone).
    // Format: YYYY-MM-DDThh:mm:ss.ssssss
    if (/^\d+-\d+-\d+T\d+:\d+:\d+(\.\d+)?$/.test(dateString)) {
      dateString += 'Z';
    }
    const result = Date.parse(dateString);
    return isNaN(result) ? null : result / 1000.0;
  }

  /**
   * Parses an XML duration string.
   * Negative values are not supported. Years and months are treated as exactly
   * 365 and 30 days respectively.
   * @param durationString The duration string, e.g., "PT1H3M43.2S",
   *   which means 1 hour, 3 minutes, and 43.2 seconds.
   * @return The parsed duration in seconds on success; otherwise,
   *   return null.
   * @see {@link http://www.datypic.com/sc/xsd/t-xsd_duration.html}
   */
  static parseDuration(durationString: string): number|null {
    if (!durationString) {
      return null;
    }
    const re = '^P(?:([0-9]*)Y)?(?:([0-9]*)M)?(?:([0-9]*)D)?' +
        '(?:T(?:([0-9]*)H)?(?:([0-9]*)M)?(?:([0-9.]*)S)?)?$';
    const matches = (new RegExp(re)).exec(durationString);
    if (!matches) {
      log.warning('Invalid duration string:', durationString);
      return null;
    }

    // Note: Number(null) == 0 but Number(undefined) == NaN.
    const years = Number(matches[1] || null);
    const months = Number(matches[2] || null);
    const days = Number(matches[3] || null);
    const hours = Number(matches[4] || null);
    const minutes = Number(matches[5] || null);
    const seconds = Number(matches[6] || null);

    // Assume a year always has 365 days and a month always has 30 days.
    const d = 60 * 60 * 24 * 365 * years + 60 * 60 * 24 * 30 * months +
        60 * 60 * 24 * days + 60 * 60 * hours + 60 * minutes + seconds;
    return isFinite(d) ? d : null;
  }

  /**
   * Parses a range string.
   * @param rangeString The range string, e.g., "101-9213".
   * @return The parsed range on success;
   *   otherwise, return null.
   */
  static parseRange(rangeString: string): {start: number, end: number}|null {
    const matches = /([0-9]+)-([0-9]+)/.exec(rangeString);
    if (!matches) {
      return null;
    }
    const start = Number(matches[1]);
    if (!isFinite(start)) {
      return null;
    }
    const end = Number(matches[2]);
    if (!isFinite(end)) {
      return null;
    }
    return {start: start, end: end};
  }

  /**
   * Parses an integer.
   * @param intString The integer string.
   * @return The parsed integer on success; otherwise, return null.
   */
  static parseInt(intString: string): number|null {
    const n = Number(intString);
    return n % 1 === 0 ? n : null;
  }

  /**
   * Parses a positive integer.
   * @param intString The integer string.
   * @return The parsed positive integer on success; otherwise,
   *   return null.
   */
  static parsePositiveInt(intString: string): number|null {
    const n = Number(intString);
    return n % 1 === 0 && n > 0 ? n : null;
  }

  /**
   * Parses a non-negative integer.
   * @param intString The integer string.
   * @return The parsed non-negative integer on success; otherwise,
   *   return null.
   */
  static parseNonNegativeInt(intString: string): number|null {
    const n = Number(intString);
    return n % 1 === 0 && n >= 0 ? n : null;
  }

  /**
   * Parses a floating point number.
   * @param floatString The floating point number string.
   * @return The parsed floating point number on success; otherwise,
   *   return null. May return -Infinity or Infinity.
   */
  static parseFloat(floatString: string): number|null {
    const n = Number(floatString);
    return !isNaN(n) ? n : null;
  }

  /**
   * Evaluate a division expressed as a string.
   *   The expression to evaluate, e.g. "200/2". Can also be a single number.
   * @return The evaluated expression as floating point number on
   *   success; otherwise return null.
   */
  static evalDivision(exprString: string): number|null {
    let res;
    let n;
    if (res = exprString.match(/^(\d+)\/(\d+)$/)) {
      n = Number(res[1]) / Number(res[2]);
    } else {
      n = Number(exprString);
    }
    return !isNaN(n) ? n : null;
  }

  /**
   * Parse a string and return the resulting root element if it was valid XML.
   *
   */
  static parseXmlString(xmlString: string, expectedRootElemName: string):
      Element {
    const parser = new DOMParser();
    let xml = null;
    try {
      xml = parser.parseFromString(xmlString, 'text/xml');
    } catch (exception) {
      log.error('XML parsing exception:', exception);
      return null;
    }

    // According to MDN, parseFromString never returns null.
    asserts.assert(xml, 'Parsed XML document cannot be null!');

    // Check for empty documents.
    const rootElem = xml.documentElement;
    if (!rootElem) {
      log.error('XML document was empty!');
      return null;
    }

    // Check for parser errors.
    const parserErrorElements = rootElem.getElementsByTagName('parsererror');
    if (parserErrorElements.length) {
      log.error('XML parser error found:', parserErrorElements[0]);
      return null;
    }

    // The top-level element in the loaded XML should have the name we expect.
    if (xml.documentElement.tagName != expectedRootElemName) {
      log.error(
          `XML tag name does not match expected "${expectedRootElemName}":`,
          xml.documentElement.tagName);
      return null;
    }
    return rootElem;
  }

  /**
   * Parse some UTF8 data and return the resulting root element if
   * it was valid XML.
   */
  static parseXml(data: BufferSource, expectedRootElemName: string): Element {
    try {
      const string = StringUtils.fromUTF8(data);
      return XmlUtils.parseXmlString(string, expectedRootElemName);
    } catch (exception) {
      log.error('parseXmlString threw!', exception);
      return null;
    }
  }
}
