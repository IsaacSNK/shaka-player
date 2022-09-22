/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Externs for JWK set.
 *
 */

/** A JSON Web Key set. */
class JWKSet {
  keys: JWK[] = [];
}

/** A JSON Web Key. */
class JWK {
  /**
   * A key ID.  Any ASCII string.
   */
  kid: string = '';

  /**
   * A key type.  One of:
   *   1. "oct" (symmetric key octect sequence)
   *   2. "RSA" (RSA key)
   *   3. "EC" (elliptical curve key)
   * Use "oct" for clearkey.
   */
  kty: string = '';

  /**
   * A key in base 64.  Used with kty="oct".
   */
  k: string = '';
}
