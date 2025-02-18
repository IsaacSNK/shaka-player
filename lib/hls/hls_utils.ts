/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
goog.requireType("shaka.hls.Tag");

namespace shaka.hls {
  export class Utils {
    static filterTagsByName(tags: Tag[], name: string): Tag[] {
      return tags.filter((tag) => {
        return tag.name == name;
      });
    }

    static filterTagsByType(tags: Tag[], type: string): Tag[] {
      return tags.filter((tag) => {
        const tagType = tag.getRequiredAttrValue("TYPE");
        return tagType == type;
      });
    }

    static getFirstTagWithName(tags: Tag[], name: string): Tag | null {
      const tagsWithName = shaka.hls.Utils.filterTagsByName(tags, name);
      if (!tagsWithName.length) {
        return null;
      }
      return tagsWithName[0];
    }

    /**
     * Get the numerical value of the first tag with given name if available.
     * Return the default value if the tag is not present.
     *
     */
    static getFirstTagWithNameAsNumber(
      tags: Tag[],
      name: string,
      defaultValue: number = 0
    ): number {
      const tag = shaka.hls.Utils.getFirstTagWithName(tags, name);
      const value = tag ? Number(tag.value) : defaultValue;
      return value;
    }

    static constructAbsoluteUri(
      parentAbsoluteUri: string,
      uri: string
    ): string {
      const uris = shaka.util.ManifestParserUtils.resolveUris(
        [parentAbsoluteUri],
        [uri]
      );
      return uris[0];
    }

    /**
     * Matches a string to an HLS comment format and returns the result.
     *
     */
    static isComment(line: string): boolean {
      return /^#(?!EXT)/m.test(line);
    }
  }
}
