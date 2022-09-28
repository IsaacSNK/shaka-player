/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
namespace shaka.media {
  /**
   * @summary
   * A collection of methods to work around content issues on various platforms.
   */
  export class ContentWorkarounds {
    /**
     * Transform the init segment into a new init segment buffer that indicates
     * encryption.  If the init segment already indicates encryption, return the
     * original init segment.
     *
     * Should only be called for MP4 init segments, and only on platforms that
     * need this workaround.
     *
     * @see https://github.com/shaka-project/shaka-player/issues/2759
     */
    static fakeEncryption(initSegmentBuffer: BufferSource): Uint8Array {
      const ContentWorkarounds = shaka.media.ContentWorkarounds;
      let initSegment = shaka.util.BufferUtils.toUint8(initSegmentBuffer);
      let isEncrypted = false;
      let stsdBox: shaka.extern.ParsedBox;
      const ancestorBoxes = [];
      const onSimpleAncestorBox = (box) => {
        ancestorBoxes.push(box);
        shaka.util.Mp4Parser.children(box);
      };
      const onEncryptionMetadataBox = (box) => {
        isEncrypted = true;
      };

      // Multiplexed content could have multiple boxes that we need to modify.
      // Add to this array in order of box offset.  This will be important later,
      // when we process the boxes.
      const boxesToModify: { box: shaka.extern.ParsedBox; newType: number }[] =
        [];
      new shaka.util.Mp4Parser()
        .box("moov", onSimpleAncestorBox)
        .box("trak", onSimpleAncestorBox)
        .box("mdia", onSimpleAncestorBox)
        .box("minf", onSimpleAncestorBox)
        .box("stbl", onSimpleAncestorBox)
        .fullBox("stsd", (box) => {
          stsdBox = box;
          ancestorBoxes.push(box);
          shaka.util.Mp4Parser.sampleDescription(box);
        })
        .fullBox("encv", onEncryptionMetadataBox)
        .fullBox("enca", onEncryptionMetadataBox)
        .fullBox("avc1", (box) => {
          boxesToModify.push({
            box,
            newType: ContentWorkarounds.BOX_TYPE_ENCV_,
          });
        })
        .fullBox("avc3", (box) => {
          boxesToModify.push({
            box,
            newType: ContentWorkarounds.BOX_TYPE_ENCV_,
          });
        })
        .fullBox("ac-3", (box) => {
          boxesToModify.push({
            box,
            newType: ContentWorkarounds.BOX_TYPE_ENCA_,
          });
        })
        .fullBox("ec-3", (box) => {
          boxesToModify.push({
            box,
            newType: ContentWorkarounds.BOX_TYPE_ENCA_,
          });
        })
        .fullBox("mp4a", (box) => {
          boxesToModify.push({
            box,
            newType: ContentWorkarounds.BOX_TYPE_ENCA_,
          });
        })
        .parse(initSegment);
      if (isEncrypted) {
        shaka.log.debug("Init segment already indicates encryption.");
        return initSegment;
      }
      if (boxesToModify.length == 0 || !stsdBox) {
        shaka.log.error("Failed to find boxes needed to fake encryption!");
        shaka.log.v2(
          "Failed init segment (hex):",
          shaka.util.Uint8ArrayUtils.toHex(initSegment)
        );
        throw new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.MEDIA,
          shaka.util.Error.Code.CONTENT_TRANSFORMATION_FAILED
        );
      }

      // Modify boxes in order from largest offset to smallest, so that earlier
      // boxes don't have their offsets changed before we process them.

      // in place!
      boxesToModify.reverse();
      for (const workItem of boxesToModify) {
        const insertedBoxType = shaka.util.Mp4Parser.typeToString(
          workItem.newType
        );
        shaka.log.debug(
          `Inserting "${insertedBoxType}" box into init segment.`
        );
        initSegment = ContentWorkarounds.insertEncryptionMetadata_(
          initSegment,
          stsdBox,
          workItem.box,
          ancestorBoxes,
          workItem.newType
        );
      }
      return initSegment;
    }

    /**
     * Insert an encryption metadata box ("encv" or "enca" box) into the MP4 init
     * segment, based on the source box ("mp4a", "avc1", etc).  Returns a new
     * buffer containing the modified init segment.
     *
     */
    private static insertEncryptionMetadata_(
      initSegment: Uint8Array,
      stsdBox: shaka.extern.ParsedBox,
      sourceBox: shaka.extern.ParsedBox,
      ancestorBoxes: shaka.extern.ParsedBox[],
      metadataBoxType: number
    ): Uint8Array {
      const ContentWorkarounds = shaka.media.ContentWorkarounds;
      const metadataBoxArray = ContentWorkarounds.createEncryptionMetadata_(
        initSegment,
        sourceBox,
        metadataBoxType
      );

      // Construct a new init segment array with room for the encryption metadata
      // box we're adding.
      const newInitSegment = new Uint8Array(
        initSegment.byteLength + metadataBoxArray.byteLength
      );

      // For Xbox One, we cut and insert at the start of the source box.  For
      // other platforms, we cut and insert at the end of the source box.  It's
      // not clear why this is necessary on Xbox One, but it seems to be evidence
      // of another bug in the firmware implementation of MediaSource & EME.
      const cutPoint = shaka.util.Platform.isXboxOne()
        ? sourceBox.start
        : sourceBox.start + sourceBox.size;

      // The data before the cut point will be copied to the same location as
      // before.  The data after that will be appended after the added metadata
      // box.
      const beforeData = initSegment.subarray(0, cutPoint);
      const afterData = initSegment.subarray(cutPoint);
      newInitSegment.set(beforeData);
      newInitSegment.set(metadataBoxArray, cutPoint);
      newInitSegment.set(afterData, cutPoint + metadataBoxArray.byteLength);

      // The parents up the chain from the encryption metadata box need their
      // sizes adjusted to account for the added box.  These offsets should not be
      // changed, because they should all be within the first section we copy.
      for (const box of ancestorBoxes) {
        goog.asserts.assert(
          box.start < cutPoint,
          "Ancestor MP4 box found in the wrong location!  " +
            "Modified init segment will not make sense!"
        );
        ContentWorkarounds.updateBoxSize_(
          newInitSegment,
          box.start,
          box.size + metadataBoxArray.byteLength
        );
      }

      // Add one to the sample entries field of the "stsd" box.  This is a 4-byte
      // field just past the box header.
      const stsdBoxView = shaka.util.BufferUtils.toDataView(
        newInitSegment,
        stsdBox.start
      );
      const stsdBoxHeaderSize = shaka.util.Mp4Parser.headerSize(stsdBox);
      const numEntries = stsdBoxView.getUint32(stsdBoxHeaderSize);
      stsdBoxView.setUint32(stsdBoxHeaderSize, numEntries + 1);
      return newInitSegment;
    }

    /**
     * Create an encryption metadata box ("encv" or "enca" box), based on the
     * source box ("mp4a", "avc1", etc).  Returns a new buffer containing the
     * encryption metadata box.
     *
     */
    private static createEncryptionMetadata_(
      initSegment: Uint8Array,
      sourceBox: shaka.extern.ParsedBox,
      metadataBoxType: number
    ): Uint8Array {
      const ContentWorkarounds = shaka.media.ContentWorkarounds;
      const sinfBoxArray = ContentWorkarounds.CANNED_SINF_BOX_.value();

      // Create a subarray which points to the source box data.
      const sourceBoxArray = initSegment.subarray(
        /* start= */
        sourceBox.start,
        /* end= */
        sourceBox.start + sourceBox.size
      );

      // Create a view on the source box array.
      const sourceBoxView = shaka.util.BufferUtils.toDataView(sourceBoxArray);

      // Create an array to hold the new encryption metadata box, which is based
      // on the source box.
      const metadataBoxArray = new Uint8Array(
        sourceBox.size + sinfBoxArray.byteLength
      );

      // Copy the source box into the new array.
      metadataBoxArray.set(
        sourceBoxArray,
        /* targetOffset= */
        0
      );

      // Change the box type.
      const metadataBoxView =
        shaka.util.BufferUtils.toDataView(metadataBoxArray);
      metadataBoxView.setUint32(
        ContentWorkarounds.BOX_TYPE_OFFSET_,
        metadataBoxType
      );

      // Append the "sinf" box to the encryption metadata box.
      metadataBoxArray.set(
        sinfBoxArray,
        /* targetOffset= */
        sourceBox.size
      );

      // Update the "sinf" box's format field (in the child "frma" box) to reflect
      // the format of the original source box.
      const sourceBoxType = sourceBoxView.getUint32(
        ContentWorkarounds.BOX_TYPE_OFFSET_
      );
      metadataBoxView.setUint32(
        sourceBox.size + ContentWorkarounds.CANNED_SINF_BOX_FORMAT_OFFSET_,
        sourceBoxType
      );

      // Now update the encryption metadata box size.
      ContentWorkarounds.updateBoxSize_(
        metadataBoxArray,
        /* boxStart= */
        0,
        metadataBoxArray.byteLength
      );
      return metadataBoxArray;
    }

    /**
     * Modify an MP4 box's size field in-place.
     *
     * @param boxStart The start position of the box in dataArray.
     * @param newBoxSize The new size of the box.
     */
    private static updateBoxSize_(
      dataArray: Uint8Array,
      boxStart: number,
      newBoxSize: number
    ) {
      const ContentWorkarounds = shaka.media.ContentWorkarounds;
      const boxView = shaka.util.BufferUtils.toDataView(dataArray, boxStart);
      const sizeField = boxView.getUint32(ContentWorkarounds.BOX_SIZE_OFFSET_);

      // Means "the rest of the box".
      // No adjustment needed for this box.
      if (sizeField == 0) {
      } else {
        if (sizeField == 1) {
          // Means "use 64-bit size box".
          // Set the 64-bit int in two 32-bit parts.
          // The high bits should definitely be 0 in practice, but we're being
          // thorough here.
          boxView.setUint32(
            ContentWorkarounds.BOX_SIZE_64_OFFSET_,
            newBoxSize >> 32
          );
          boxView.setUint32(
            ContentWorkarounds.BOX_SIZE_64_OFFSET_ + 4,
            newBoxSize & 4294967295
          );
        } else {
          // Normal 32-bit size field.
          // Not checking the size of the value here, since a box larger than 4GB is
          // unrealistic.
          boxView.setUint32(ContentWorkarounds.BOX_SIZE_OFFSET_, newBoxSize);
        }
      }
    }
  }
}

namespace shaka.media.ContentWorkarounds {
  /**
   * A canned "sinf" box for use when adding fake encryption metadata to init
   * segments.
   *
   * @see https://github.com/shaka-project/shaka-player/issues/2759
   */
  export const CANNED_SINF_BOX_: Lazy<Uint8Array> = new shaka.util.Lazy(
    () =>
      new Uint8Array([
        // sinf box
        // Size: 0x50 = 80
        0, 0, 0, 80,
        // Type: sinf
        115, 105, 110, 102,
        // Children of sinf...
        // frma box
        // Size: 0x0c = 12
        0, 0, 0, 12,
        // Type: frma (child of sinf)
        102, 114, 109, 97,
        // Format: filled in later based on the source box ("avc1", "mp4a", etc)
        0, 0, 0, 0,
        // end of frma box
        // schm box
        // Size: 0x14 = 20
        0, 0, 0, 20,
        // Type: schm (child of sinf)
        115, 99, 104, 109,
        // Version: 0, Flags: 0
        0, 0, 0, 0,
        // Scheme: cenc
        99, 101, 110, 99,
        // Scheme version: 1.0
        0, 1, 0, 0,
        // end of schm box
        // schi box
        // Size: 0x28 = 40
        0, 0, 0, 40,
        // Type: schi (child of sinf)
        115, 99, 104, 105,
        // Children of schi...
        // tenc box
        // Size: 0x20 = 32
        0, 0, 0, 32,
        // Type: tenc (child of schi)
        116, 101, 110, 99,
        // Version: 0, Flags: 0
        0, 0, 0, 0,
        // Reserved fields
        0, 0,
        // Default protected: true
        1,
        // Default per-sample IV size: 8
        8,
        // Default key ID: all zeros (dummy)
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ])
  );
}

// end of tenc box

// end of schi box

// end of sinf box
namespace shaka.media.ContentWorkarounds {
  /**
   * The location of the format field in the "frma" box inside the canned "sinf"
   * box above.
   *
   */
  export const CANNED_SINF_BOX_FORMAT_OFFSET_: number = 16;
}

namespace shaka.media.ContentWorkarounds {
  /**
   * Offset to a box's size field.
   *
   */
  export const BOX_SIZE_OFFSET_: number = 0;
}

namespace shaka.media.ContentWorkarounds {
  /**
   * Offset to a box's type field.
   *
   */
  export const BOX_TYPE_OFFSET_: number = 4;
}

namespace shaka.media.ContentWorkarounds {
  /**
   * Offset to a box's 64-bit size field, if it has one.
   *
   */
  export const BOX_SIZE_64_OFFSET_: number = 8;
}

namespace shaka.media.ContentWorkarounds {
  /**
   * Box type for "encv".
   *
   */
  export const BOX_TYPE_ENCV_: number = 1701733238;
}

namespace shaka.media.ContentWorkarounds {
  /**
   * Box type for "enca".
   *
   */
  export const BOX_TYPE_ENCA_: number = 1701733217;
}
