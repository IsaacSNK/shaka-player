/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for CMCD data.
 * @see https://github.com/shaka-project/shaka-player/issues/3619
 * @see https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf
 *
 *
 */

/**
 *  rtp
 *   Requested maximum throughput
 *
 *   The requested maximum throughput that the client considers sufficient for
 *   delivery of the asset. Values MUST be rounded to the nearest 100kbps. For
 *   example, a client would indicate that the current segment, encoded at
 *   2Mbps, is to be delivered at no more than 10Mbps, by using rtp=10000.
 *
 *   Note: This can benefit clients by preventing buffer saturation through
 *   over-delivery and can also deliver a community benefit through fair-share
 *   delivery. The concept is that each client receives the throughput necessary
 *   for great performance, but no more. The CDN may not support the rtp
 *   feature.
 */
declare type CmcdData = {
  br: number | undefined;
  d: number | undefined;
  ot: string | undefined;
  tb: number | undefined;
  bl: number | undefined;
  dl: number | undefined;
  mtp: number | undefined;
  nor: string | undefined;
  nrr: string | undefined;
  su: boolean | undefined;
  cid: string | undefined;
  pr: number | undefined;
  sf: string | undefined;
  sid: string | undefined;
  st: string | undefined;
  v: number | undefined;
  bs: boolean | undefined;
  rtp: number | undefined;
};
