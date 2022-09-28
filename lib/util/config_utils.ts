/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.util {
  /** @export */
  export class ConfigUtils {
    /**
     * @param template supplies default values
     *   Supplies override type checking.  When the current path matches
     *   the key in this object, each sub-value must match the type in this
     *   object. If this contains an Object, it is used as the template.
     * @param path to this part of the config
     * @export
     */
    static mergeConfigObjects(
      destination: Object,
      source: Object,
      template: Object,
      overrides: Object,
      path: string
    ): boolean {
      goog.asserts.assert(destination, "Destination config must not be null!");

      /**
       * If true, don't validate the keys in the next level.
       */
      const ignoreKeys: boolean = path in overrides;
      let isValid = true;
      for (const k in source) {
        const subPath = path + "." + k;
        const subTemplate = ignoreKeys ? overrides[path] : template[k];

        // The order of these checks is important.
        if (!ignoreKeys && !(k in template)) {
          shaka.log.alwaysError("Invalid config, unrecognized key " + subPath);
          isValid = false;
        } else {
          if (source[k] === undefined) {
            // An explicit 'undefined' value causes the key to be deleted from the
            // destination config and replaced with a default from the template if
            // possible.
            if (subTemplate === undefined || ignoreKeys) {
              // There is nothing in the template, so delete.
              delete destination[k];
            } else {
              // There is something in the template, so go back to that.
              destination[k] = shaka.util.ObjectUtils.cloneObject(subTemplate);
            }
          } else {
            if (
              subTemplate.constructor == Object &&
              source[k] &&
              source[k].constructor == Object
            ) {
              // These are plain Objects with no other constructor.
              if (!destination[k]) {
                // Initialize the destination with the template so that normal
                // merging and type-checking can happen.
                destination[k] =
                  shaka.util.ObjectUtils.cloneObject(subTemplate);
              }
              const subMergeValid = shaka.util.ConfigUtils.mergeConfigObjects(
                destination[k],
                source[k],
                subTemplate,
                overrides,
                subPath
              );
              isValid = isValid && subMergeValid;
            } else {
              if (
                typeof source[k] != typeof subTemplate ||
                source[k] == null ||
                // Function cosntructors are not informative, and differ
                // between sync and async functions.  So don't look at
                // constructor for function types.
                (typeof source[k] != "function" &&
                  source[k].constructor != subTemplate.constructor)
              ) {
                // The source is the wrong type.  This check allows objects to be
                // nulled, but does not allow null for any non-object fields.
                shaka.log.alwaysError(
                  "Invalid config, wrong type for " + subPath
                );
                isValid = false;
              } else {
                if (
                  typeof template[k] == "function" &&
                  template[k].length != source[k].length
                ) {
                  shaka.log.alwaysWarn(
                    "Unexpected number of arguments for " + subPath
                  );
                  destination[k] = source[k];
                } else {
                  destination[k] = source[k];
                }
              }
            }
          }
        }
      }
      return isValid;
    }

    /**
     * Convert config from ('fieldName', value) format to a partial config object.
     *
     * E. g. from ('manifest.retryParameters.maxAttempts', 1) to
     * { manifest: { retryParameters: { maxAttempts: 1 }}}.
     *
     * @export
     */
    static convertToConfigObject(fieldName: string, value: any): Object {
      const configObject = {};
      let last = configObject;
      let searchIndex = 0;
      let nameStart = 0;
      while (true) {
        // eslint-disable-line no-constant-condition
        const idx = fieldName.indexOf(".", searchIndex);
        if (idx < 0) {
          break;
        }
        if (idx == 0 || fieldName[idx - 1] != "\\") {
          const part = fieldName
            .substring(nameStart, idx)
            .replace(/\\\./g, ".");
          last[part] = {};
          last = last[part];
          nameStart = idx + 1;
        }
        searchIndex = idx + 1;
      }
      last[fieldName.substring(nameStart).replace(/\\\./g, ".")] = value;
      return configObject;
    }

    /**
       * Reference the input parameters so the compiler doesn't remove them from
       * the calling function.  Return whatever value is specified.
       *
       * This allows an empty or default implementation of a config callback that
       * still bears the complete function signature even in compiled mode.
       *
       * The caller should look something like this:
       *
       *   const callback = (a, b, c, d) => {
       *     return referenceParametersAndReturn(
                 [a, b, c, d],
                 a);  // Can be anything, doesn't need to be one of the parameters
       *   };
       *
       * @template T
       * @noinline
       */
    static referenceParametersAndReturn<T>(
      parameters: any[],
      returnValue: T
    ): T {
      return parameters && returnValue;
    }
  }
}
