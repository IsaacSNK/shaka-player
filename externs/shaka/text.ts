/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @exportDoc
 */
shaka.extern.CueRegion = class {
  /**
   * Region identifier.
   * @exportDoc
   */
  id: string;

  /**
   * The X offset to start the rendering area in viewportAnchorUnits of the
   * video width.
   * @exportDoc
   */
  viewportAnchorX: number;

  /**
   * The X offset to start the rendering area in viewportAnchorUnits of the
   * video height.
   * @exportDoc
   */
  viewportAnchorY: number;

  /**
   * The X offset to start the rendering area in percentage (0-100) of this
   * region width.
   * @exportDoc
   */
  regionAnchorX: number;

  /**
   * The Y offset to start the rendering area in percentage (0-100) of the
   * region height.
   * @exportDoc
   */
  regionAnchorY: number;

  /**
   * The width of the rendering area in widthUnits.
   * @exportDoc
   */
  width: number;

  /**
   * The width of the rendering area in heightUnits.
   * @exportDoc
   */
  height: number;

  /**
   * The units (percentage, pixels or lines) the region height is in.
   * @exportDoc
   */
  heightUnits: shaka.text.CueRegion.units;

  /**
   * The units (percentage or pixels) the region width is in.
   * @exportDoc
   */
  widthUnits: shaka.text.CueRegion.units;

  /**
   * The units (percentage or pixels) the region viewportAnchors are in.
   * @exportDoc
   */
  viewportAnchorUnits: shaka.text.CueRegion.units;

  /**
   * If scroll=UP, it means that cues in the region will be added to the
   * bottom of the region and will push any already displayed cues in the
   * region up.  Otherwise (scroll=NONE) cues will stay fixed at the location
   * they were first painted in.
   * @exportDoc
   */
  scroll: shaka.text.CueRegion.scrollMode;
};

/**
 * @exportDoc
 */
shaka.extern.Cue = class {
  /**
   * The start time of the cue in seconds, relative to the start of the
   * presentation.
   * @exportDoc
   */
  startTime: number;

  /**
   * The end time of the cue in seconds, relative to the start of the
   * presentation.
   * @exportDoc
   */
  endTime: number;

  /**
   * The text payload of the cue.  If nestedCues is non-empty, this should be
   * empty.  Top-level block containers should have no payload of their own.
   * @exportDoc
   */
  payload: string;

  /**
   * The region to render the cue into.  Only supported on top-level cues,
   * because nested cues are inline elements.
   * @exportDoc
   */
  region: shaka.extern.CueRegion;

  /**
   * The indent (in percent) of the cue box in the direction defined by the
   * writing direction.
   * @exportDoc
   */
  position: number|null;

  /**
   * Position alignment of the cue.
   * @exportDoc
   */
  positionAlign: shaka.text.Cue.positionAlign;

  /**
   * Size of the cue box (in percents), where 0 means "auto".
   * @exportDoc
   */
  size: number;

  /**
   * Alignment of the text inside the cue box.
   * @exportDoc
   */
  textAlign: shaka.text.Cue.textAlign;

  /**
   * Text direction of the cue.
   * @exportDoc
   */
  direction: shaka.text.Cue.direction;

  /**
   * Text writing mode of the cue.
   * @exportDoc
   */
  writingMode: shaka.text.Cue.writingMode;

  /**
   * The way to interpret line field. (Either as an integer line number or
   * percentage from the display box).
   * @exportDoc
   */
  lineInterpretation: shaka.text.Cue.lineInterpretation;

  /**
   * The offset from the display box in either number of lines or
   * percentage depending on the value of lineInterpretation.
   * @exportDoc
   */
  line: number|null;

  /**
   * Separation between line areas inside the cue box in px or em
   * (e.g. '100px'/'100em'). If not specified, this should be no less than
   * the largest font size applied to the text in the cue.
   * .
   * @exportDoc
   */
  lineHeight: string;

  /**
   * Line alignment of the cue box.
   * Start alignment means the cue box’s top side (for horizontal cues), left
   * side (for vertical growing right), or right side (for vertical growing
   * left) is aligned at the line.
   * Center alignment means the cue box is centered at the line.
   * End alignment The cue box’s bottom side (for horizontal cues), right side
   * (for vertical growing right), or left side (for vertical growing left) is
   * aligned at the line.
   * @exportDoc
   */
  lineAlign: shaka.text.Cue.lineAlign;

  /**
   * Vertical alignments of the cues within their extents.
   * 'BEFORE' means displaying the captions at the top of the text display
   * container box, 'CENTER' means in the middle, 'AFTER' means at the bottom.
   * @exportDoc
   */
  displayAlign: shaka.text.Cue.displayAlign;

  /**
   * Text color as a CSS color, e.g. "#FFFFFF" or "white".
   * @exportDoc
   */
  color: string;

  /**
   * Text background color as a CSS color, e.g. "#FFFFFF" or "white".
   * @exportDoc
   */
  backgroundColor: string;

  /**
   * The number of horizontal and vertical cells into which the Root Container
   * Region area is divided.
   *
   * @exportDoc
   */
  cellResolution: {columns: number, rows: number};

  /**
   * The URL of the background image, e.g. "data:[mime type];base64,[data]".
   * @exportDoc
   */
  backgroundImage: string;

  /**
   * The border around this cue as a CSS border.
   * @exportDoc
   */
  border: string;

  /**
   * Text font size in px or em (e.g. '100px'/'100em').
   * @exportDoc
   */
  fontSize: string;

  /**
   * Text font weight. Either normal or bold.
   * @exportDoc
   */
  fontWeight: shaka.text.Cue.fontWeight;

  /**
   * Text font style. Normal, italic or oblique.
   * @exportDoc
   */
  fontStyle: shaka.text.Cue.fontStyle;

  /**
   * Text font family.
   * @exportDoc
   */
  fontFamily: string;

  /**
   * Text shadow color as a CSS text-shadow value.
   * @exportDoc
   */
  textShadow: string = '';

  /**
   * Text stroke color as a CSS color, e.g. "#FFFFFF" or "white".
   * @exportDoc
   */
  textStrokeColor: string;

  /**
   * Text stroke width as a CSS stroke-width value.
   * @exportDoc
   */
  textStrokeWidth: string;

  /**
   * Text letter spacing as a CSS letter-spacing value.
   * @exportDoc
   */
  letterSpacing: string;

  /**
   * Text line padding as a CSS line-padding value.
   * @exportDoc
   */
  linePadding: string;

  /**
   * Opacity of the cue element, from 0-1.
   * @exportDoc
   */
  opacity: number;

  /**
   * Text decoration. A combination of underline, overline
   * and line through. Empty array means no decoration.
   * @exportDoc
   */
  textDecoration: shaka.text.Cue.textDecoration[];

  /**
   * Whether or not line wrapping should be applied to the cue.
   * @exportDoc
   */
  wrapLine: boolean;

  /**
   * Id of the cue.
   * @exportDoc
   */
  id: string;

  /**
   * Nested cues, which should be laid out horizontally in one block.
   * Top-level cues are blocks, and nested cues are inline elements.
   * Cues can be nested arbitrarily deeply.
   * @exportDoc
   */
  nestedCues: shaka.extern.Cue[];

  /**
   * If true, this represents a container element that is "above" the main
   * cues. For example, the <body> and <div> tags that contain the <p> tags
   * in a TTML file. This controls the flow of the final cues; any nested cues
   * within an "isContainer" cue will be laid out as separate lines.
   * @exportDoc
   */
  isContainer: boolean;

  /**
   * Whether or not the cue only acts as a line break between two nested cues.
   * Should only appear in nested cues.
   * @exportDoc
   */
  lineBreak: boolean;
};

/**
 * An interface for plugins that parse text tracks.
 *
 * @exportDoc
 */
shaka.extern.TextParser = class {
  /**
   * Parse an initialization segment. Some formats do not have init
   * segments so this won't always be called.
   *
   *    The data that makes up the init segment.
   *
   * @exportDoc
   */
  parseInit(data: Uint8Array) {}

  /**
   * Parse a media segment and return the cues that make up the segment.
   *
   *    The next section of buffer.
   *    The time information that should be used to adjust the times values
   *    for each cue.
   *
   * @exportDoc
   */
  parseMedia(
      data: Uint8Array,
      timeContext: shaka.extern.TextParser.TimeContext): shaka.extern.Cue[] {}

  /**
   * Notifies the stream if the manifest is in sequence mode or not.
   *
   */
  setSequenceMode(sequenceMode: boolean) {}
};

export interface TimeContext {
  periodStart: number;
  segmentStart: number;
  segmentEnd: number;
  vttOffset: number;
}
type TextParserPlugin = () => shaka.extern.TextParser;

/**
 * @summary
 * An interface for plugins that display text.
 *
 * @description
 * This should handle displaying the text cues on the page.  This is given the
 * cues to display and told when to start and stop displaying.  This should only
 * display the cues it is given and remove cues when told to.
 *
 * <p>
 * This should only change whether it is displaying the cues through the
 * <code>setTextVisibility</code> function; the app should not change the text
 * visibility outside the top-level Player methods.  If you really want to
 * control text visibility outside the Player methods, you must set the
 * <code>streaming.alwaysStreamText</code> Player configuration value to
 * <code>true</code>.
 *
 * @exportDoc
 */
shaka.extern.TextDisplayer = class {
  /**
   * @override
   * @exportDoc
   */
  destroy() {}

  /**
   * Append given text cues to the list of cues to be displayed.
   *
   *    Text cues to be appended.
   *
   * @exportDoc
   */
  append(cues: shaka.text.Cue[]) {}

  /**
   * Remove all cues that are fully contained by the given time range (relative
   * to the presentation). <code>endTime</code> will be greater to equal to
   * <code>startTime</code>.  <code>remove</code> should only return
   * <code>false</code> if the displayer has been destroyed. If the displayer
   * has not been destroyed <code>remove</code> should return <code>true</code>.
   *
   *
   *
   * @exportDoc
   */
  remove(startTime: number, endTime: number): boolean {}

  /**
   * Returns true if text is currently visible.
   *
   *
   * @exportDoc
   */
  isTextVisible(): boolean {}

  /**
   * Set text visibility.
   *
   *
   * @exportDoc
   */
  setTextVisibility(on: boolean) {}
};
type Factory = () => shaka.extern.TextDisplayer;
