/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {Attribute, Playlist, PlaylistType, Segment, Tag} from './dev-workspace.shaka-player-fork.lib.hls.hls_classes';
import {Utils} from './dev-workspace.shaka-player-fork.lib.hls.hls_utils';
import * as ErrorExports from './dev-workspace.shaka-player-fork.lib.util.error';
import {Error} from './dev-workspace.shaka-player-fork.lib.util.error';
import * as StringUtilsExports from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {StringUtils} from './dev-workspace.shaka-player-fork.lib.util.string_utils';
import {TextParser} from './dev-workspace.shaka-player-fork.lib.util.text_parser';

/**
 * HlS manifest text parser.
 */
export class ManifestTextParser {
  private globalId_: number = 0;

  /**
   * @param absolutePlaylistUri An absolute, final URI after redirects.
   */
  parsePlaylist(data: BufferSource, absolutePlaylistUri: string): Playlist {
    const MEDIA_PLAYLIST_TAGS = MEDIA_PLAYLIST_TAGS;
    const SEGMENT_TAGS = SEGMENT_TAGS;

    // Get the input as a string.  Normalize newlines to \n.
    let str = StringUtils.fromUTF8(data);
    str = str.replace(/\r\n|\r(?=[^\n]|$)/gm, '\n').trim();
    const lines = str.split(/\n+/m);
    if (!/^#EXTM3U($|[ \t\n])/m.test(lines[0])) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.HLS_PLAYLIST_HEADER_MISSING);
    }

    /** shaka.hls.PlaylistType */
    let playlistType = PlaylistType.MASTER;

    // First, look for media playlist tags, so that we know what the playlist
    // type really is before we start parsing.
    // TODO: refactor the for loop for better readability.
    // Whether to skip the next element; initialize to true to skip first elem.
    let skip = true;
    for (const line of lines) {
      // Ignore comments.
      if (Utils.isComment(line) || skip) {
        skip = false;
        continue;
      }
      const tag = this.parseTag_(line);

      // These tags won't actually be used, so don't increment the global
      // id.
      this.globalId_ -= 1;
      if (MEDIA_PLAYLIST_TAGS.includes(tag.name)) {
        playlistType = PlaylistType.MEDIA;
        break;
      } else {
        if (tag.name == 'EXT-X-STREAM-INF') {
          skip = true;
        }
      }
    }

    /** {Array.<shaka.hls.Tag>} */
    const tags = [];

    // Initialize to "true" to skip the first element.
    skip = true;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const next = lines[i + 1];

      // Skip comments
      if (Utils.isComment(line) || skip) {
        skip = false;
        continue;
      }
      const tag = this.parseTag_(line);
      if (SEGMENT_TAGS.includes(tag.name)) {
        if (playlistType != PlaylistType.MEDIA) {
          // Only media playlists should contain segment tags
          throw new Error(
              ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
              ErrorExports.Code.HLS_INVALID_PLAYLIST_HIERARCHY);
        }
        const segmentsData = lines.splice(i, lines.length - i);
        const segments =
            this.parseSegments_(absolutePlaylistUri, segmentsData, tags);
        return new Playlist(absolutePlaylistUri, playlistType, tags, segments);
      }
      tags.push(tag);

      // An EXT-X-STREAM-INF tag is followed by a URI of a media playlist.
      // Add the URI to the tag object.
      if (tag.name == 'EXT-X-STREAM-INF') {
        const tagUri = new Attribute('URI', next);
        tag.addAttribute(tagUri);
        skip = true;
      }
    }
    return new Playlist(absolutePlaylistUri, playlistType, tags);
  }

  /**
   * Parses an array of strings into an array of HLS Segment objects.
   *
   */
  private parseSegments_(
      absoluteMediaPlaylistUri: string, lines: string[],
      playlistTags: Tag[]): Segment[] {
    const segments: Segment[] = [];
    let segmentTags: Tag[] = [];
    let partialSegmentTags: Tag[] = [];

    // The last parsed EXT-X-MAP tag.
    let currentMapTag: Tag|null = null;
    for (const line of lines) {
      if (/^(#EXT)/.test(line)) {
        const tag = this.parseTag_(line);
        if (MEDIA_PLAYLIST_TAGS.includes(tag.name)) {
          playlistTags.push(tag);
        } else {
          // Mark the the EXT-X-MAP tag, and add it to the segment tags
          // following it later.
          if (tag.name == 'EXT-X-MAP') {
            currentMapTag = tag;
          } else {
            if (tag.name == 'EXT-X-PART') {
              partialSegmentTags.push(tag);
            } else {
              if (tag.name == 'EXT-X-PRELOAD-HINT') {
                if (tag.getAttributeValue('TYPE') == 'PART') {
                  partialSegmentTags.push(tag);
                } else {
                  if (tag.getAttributeValue('TYPE') == 'MAP') {
                    // Rename the Preload Hint tag to be a Map tag.
                    tag.setName('EXT-X-MAP');
                    currentMapTag = tag;
                  }
                }
              } else {
                segmentTags.push(tag);
              }
            }
          }
        }
      } else {
        // Skip comments.
        if (Utils.isComment(line)) {
        } else {
          const verbatimSegmentUri = line.trim();
          const absoluteSegmentUri = Utils.constructAbsoluteUri(
              absoluteMediaPlaylistUri, verbatimSegmentUri);

          // Attach the last parsed EXT-X-MAP tag to the segment.
          if (currentMapTag) {
            segmentTags.push(currentMapTag);
          }

          // The URI appears after all of the tags describing the segment.
          const segment =
              new Segment(absoluteSegmentUri, segmentTags, partialSegmentTags);
          segments.push(segment);
          segmentTags = [];
          partialSegmentTags = [];
        }
      }
    }

    // After all the partial segments of a regular segment is published,
    // a EXTINF tag and Uri for a regular segment containing the same media
    // content will get published at last.
    // If no EXTINF tag follows the list of partial segment tags at the end,
    // create a segment to wrap the partial segment tags.
    if (partialSegmentTags.length) {
      if (currentMapTag) {
        segmentTags.push(currentMapTag);
      }
      const segment = new Segment('', segmentTags, partialSegmentTags);
      segments.push(segment);
    }
    return segments;
  }

  /**
   * Parses a string into an HLS Tag object while tracking what id to use next.
   *
   */
  private parseTag_(word: string): Tag {
    return ManifestTextParser.parseTag(this.globalId_++, word);
  }

  /**
   * Parses a string into an HLS Tag object.
   *
   */
  static parseTag(id: number, word: string): Tag {
    /* HLS tags start with '#EXT'. A tag can have a set of attributes
          (#EXT-<tagname>:<attribute list>) and/or a value
       (#EXT-<tagname>:<value>). An attribute's format is
       'AttributeName=AttributeValue'. The parsing logic goes like this:
           1. Everything before ':' is a name (we ignore '#').
           2. Everything after ':' is a list of comma-seprated items,
                2a. The first item might be a value, if it does not contain '='.
                2b. Otherwise, items are attributes.
           3. If there is no ":", it's a simple tag with no attributes and no
       value.
        */
    const blocks = word.match(/^#(EXT[^:]*)(?::(.*))?$/);
    if (!blocks) {
      throw new Error(
          ErrorExports.Severity.CRITICAL, ErrorExports.Category.MANIFEST,
          ErrorExports.Code.INVALID_HLS_TAG, word);
    }
    const name = blocks[1];
    const data = blocks[2];
    const attributes = [];
    let value;
    if (data) {
      const parser = new TextParser(data);
      let blockAttrs;

      // Regex: any number of non-equals-sign characters at the beginning
      // terminated by comma or end of line
      const valueRegex = /^([^,=]+)(?:,|$)/g;
      const blockValue = parser.readRegex(valueRegex);
      if (blockValue) {
        value = blockValue[1];
      }

      // Regex:
      // 1. Key name ([1])
      // 2. Equals sign
      // 3. Either:
      //   a. A quoted string (everything up to the next quote, [2])
      //   b. An unquoted string
      //    (everything up to the next comma or end of line, [3])
      // 4. Either:
      //   a. A comma
      //   b. End of line
      const attributeRegex = /([^=]+)=(?:"([^"]*)"|([^",]*))(?:,|$)/g;
      while (blockAttrs = parser.readRegex(attributeRegex)) {
        const attrName = blockAttrs[1];
        const attrValue = blockAttrs[2] || blockAttrs[3];
        const attribute = new Attribute(attrName, attrValue);
        attributes.push(attribute);
        parser.skipWhitespace();
      }
    }
    return new Tag(id, name, attributes, value);
  }
}

/**
 * HLS tags that only appear on Media Playlists.
 * Used to determine a playlist type.
 *
 */
export const MEDIA_PLAYLIST_TAGS: string[] = [
  'EXT-X-TARGETDURATION', 'EXT-X-MEDIA-SEQUENCE',
  'EXT-X-DISCONTINUITY-SEQUENCE', 'EXT-X-PLAYLIST-TYPE', 'EXT-X-I-FRAMES-ONLY',
  'EXT-X-ENDLIST', 'EXT-X-SERVER-CONTROL', 'EXT-X-SKIP'
];

/**
 * HLS tags that only appear on Segments in a Media Playlists.
 * Used to determine the start of the segments info.
 *
 */
export const SEGMENT_TAGS: string[] = [
  'EXTINF', 'EXT-X-BYTERANGE', 'EXT-X-DISCONTINUITY', 'EXT-X-PROGRAM-DATE-TIME',
  'EXT-X-KEY', 'EXT-X-DATERANGE', 'EXT-X-MAP'
];
