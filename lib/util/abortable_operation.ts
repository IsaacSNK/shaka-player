/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as ErrorExports from './/error';
import {Error} from './/error';
import {PublicPromise} from './/public_promise';

/**
 * A utility to wrap abortable operations.  Note that these are not cancelable.
 * Cancelation implies undoing what has been done so far, whereas aborting only
 * means that further work is stopped.
 *
 * @template T
 * @export
 */
export class AbortableOperation implements shaka.
extern.IAbortableOperation<T> {
  /**
   * @exportInterface
   */
  // eslint-disable-next-line no-restricted-syntax
  promise: Promise<T>;
  private onAbort_: () => Promise;
  private aborted_: boolean = false;

  /**
   *   A Promise which represents the underlying operation.  It is resolved when
   *   the operation is complete, and rejected if the operation fails or is
   *   aborted.  Aborted operations should be rejected with a shaka.util.Error
   *   object using the error code OPERATION_ABORTED.
   *   Will be called by this object to abort the underlying operation.
   *   This is not cancelation, and will not necessarily result in any work
   *   being undone.  abort() should return a Promise which is resolved when the
   *   underlying operation has been aborted.  The returned Promise should never
   *   be rejected.
   */
  constructor(public readonly promise: Promise<T>, onAbort: () => Promise) {
    this.onAbort_ = onAbort;
  }

  /**
   * @return An operation which has already
   *   failed with the error given by the caller.
   * @export
   */
  static failed(error: Error): AbortableOperation {
    return new AbortableOperation(
        Promise.reject(error), () => Promise.resolve());
  }

  /**
   * @return An operation which has already
   *   failed with the error OPERATION_ABORTED.
   * @export
   */
  static aborted(): AbortableOperation {
    const p = Promise.reject(AbortableOperation.abortError());

    // Silence uncaught rejection errors, which may otherwise occur any place
    // we don't explicitly handle aborted operations.
    p.catch(() => {});
    return new AbortableOperation(p, () => Promise.resolve());
  }

  static abortError(): Error {
    return new Error(
        ErrorExports.Severity.CRITICAL, ErrorExports.Category.PLAYER,
        ErrorExports.Code.OPERATION_ABORTED);
  }

  /**
   * @return An operation which has already
   *   completed with the given value.
   * @template U
   * @export
   */
  static completed(value: U): AbortableOperation<U> {
    return new AbortableOperation(
        Promise.resolve(value), () => Promise.resolve());
  }

  /**
   * @return An operation which cannot be
   *   aborted.  It will be completed when the given Promise is resolved, or
   *   will be failed when the given Promise is rejected.
   * @template U
   * @export
   */
  static notAbortable(promise: Promise<U>): AbortableOperation<U> {
    return new AbortableOperation(
        promise,
        // abort() here will return a Promise which is resolved when the input
        // promise either resolves or fails.
        () => promise.catch(() => {}));
  }

  /**
   * @override
   * @export
   */
  abort() {
    this.aborted_ = true;
    return this.onAbort_();
  }

  /**
   * @return An operation which is resolved
   *   when all operations are successful and fails when any operation fails.
   *   For this operation, abort() aborts all given operations.
   * @export
   */
  static all(operations: AbortableOperation[]): AbortableOperation {
    return new AbortableOperation(
        Promise.all(operations.map((op) => op.promise)),
        () => Promise.all(operations.map((op) => op.abort())));
  }

  /**
   * @override
   * @export
   */
  finally(onFinal) {
    this.promise.then((value) => onFinal(true), (e) => onFinal(false));
    return this;
  }

  /**
   * @param {(undefined|
   *          function(T):U|
   *          function(T):!Promise.<U>|
   *          function(T):!shaka.util.AbortableOperation.<U>)} onSuccess
   *   A callback to be invoked after this operation is complete, to chain to
   *   another operation.  The callback can return a plain value, a Promise to
   *   an asynchronous value, or another AbortableOperation.
   *   An optional callback to be invoked if this operation fails, to perform
   *   some cleanup or error handling.  Analogous to the second parameter of
   *   Promise.prototype.then.
   * @return An operation which is resolved
   *   when this operation and the operation started by the callback are both
   *   complete.
   * @template U
   * @export
   */
  chain(
      onSuccess: undefined|((p1: T) => U)|((p1: T) => Promise<U>)|
      ((p1: T) => AbortableOperation<U>),
      onError?: (p1: any) => any): AbortableOperation<U> {
    const newPromise = new PublicPromise();
    const abortError = AbortableOperation.abortError();

    // If called before "this" completes, just abort "this".
    let abort = () => {
      newPromise.reject(abortError);
      return this.abort();
    };
    const makeCallback = (isSuccess) => {
      return (value) => {
        if (this.aborted_ && isSuccess) {
          // If "this" is not abortable(), or if abort() is called after "this"
          // is complete but before the next stage in the chain begins, we
          // should stop right away.
          newPromise.reject(abortError);
          return;
        }
        const cb = isSuccess ? onSuccess : onError;
        if (!cb) {
          // No callback?  Pass it along.
          const next = isSuccess ? newPromise.resolve : newPromise.reject;
          next(value);
          return;
        }

        // Call the callback, interpret the return value, set the Promise state,
        // and get the next abort function.
        abort = AbortableOperation.wrapChainCallback_(cb, value, newPromise);
      };
    };
    this.promise.then(makeCallback(true), makeCallback(false));
    return new AbortableOperation(
        newPromise,
        // By creating a closure around abort(), we can update the value of
        // abort() at various stages.
        () => abort());
  }

  /**
   * @param {(function(T):U|
   *          function(T):!Promise.<U>|
   *          function(T):!shaka.util.AbortableOperation.<U>|
   *          function(*))} callback
   *   A callback to be invoked with the given value.
   * @param newPromise The promise for the next
   *   stage in the chain.
   * @return The next abort() function for the chain.
   * @template T, U
   */
  private static wrapChainCallback_(
      callback: ((p1: T) => U)|((p1: T) => Promise<U>)|
      ((p1: T) => AbortableOperation<U>)|((p1: any) => any),
      value: T, newPromise: PublicPromise): () => Promise {
    try {
      const ret = callback(value);
      if (ret && ret.promise && ret.abort) {
        // This is an abortable operation, with its own abort() method.
        // After this point, abort() should abort the operation from the
        // callback, and the new promise should be tied to the promise
        // from the callback's operation.
        newPromise.resolve(ret.promise);

        // This used to say "return ret.abort;", but it caused subtle issues by
        // unbinding part of the abort chain.  There is now a test to ensure
        // that we don't call abort with the wrong "this".
        return () => ret.abort();
      } else {
        // This is a Promise or a plain value, and this step cannot be aborted.
        newPromise.resolve(ret);

        // Abort is complete when the returned value/Promise is resolved or
        // fails, but never fails itself nor returns a value.
        return () => Promise.resolve(ret).then(() => {}, () => {});
      }
    } catch (exception) {
      // The callback threw an exception or error.  Reject the new Promise and
      // resolve any future abort call right away.
      newPromise.reject(exception);
      return () => Promise.resolve();
    }
  }
}
