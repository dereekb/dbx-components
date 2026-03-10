import { type ArrayOrValue, hasValueOrNotEmpty, type Maybe } from '@dereekb/util';
import { map, type Observable } from 'rxjs';

/**
 * Represents a router link that can be used for navigation.
 *
 * Can be a URL string, a single route configuration object, or an array of route segments.
 *
 * @example
 * ```ts
 * const stringLink: SegueRefRouterLink = '/app/dashboard';
 * const arrayLink: SegueRefRouterLink = ['/app', { id: '123' }];
 * ```
 */
export type SegueRefRouterLink = string | ArrayOrValue<object>;

/**
 * Raw key-value parameters passed along with a segue navigation.
 *
 * These are typically route or query parameters for the target state.
 *
 * @example
 * ```ts
 * const params: SegueRefRawSegueParams = { id: '123', tab: 'settings' };
 * ```
 */
export interface SegueRefRawSegueParams {
  [key: string]: unknown;
}

/**
 * Configuration options for a segue navigation, including raw parameters and framework-specific transition options.
 *
 * @typeParam O - The type of the transition options. For UIRouter this is `TransitionOptions`; for Angular Router this is `NavigationExtras`.
 *
 * @example
 * ```ts
 * const options: SegueRefOptions = {
 *   refParams: { id: '123' },
 *   refOptions: { location: 'replace' }
 * };
 * ```
 */
export interface SegueRefOptions<O = object> {
  /**
   * Raw parameters
   */
  refParams?: SegueRefRawSegueParams;

  /**
   * Custom Transition Options.
   *
   * For UIRouter, this is TransitionOptions.
   */
  refOptions?: O;
}

/**
 * Represents a complete segue reference combining a navigation target path with optional parameters and transition options.
 *
 * This is the primary navigation descriptor used throughout the router abstraction layer.
 *
 * @typeParam O - The type of the transition options. For UIRouter this is `TransitionOptions`; for Angular Router this is `NavigationExtras`.
 *
 * @example
 * ```ts
 * const segue: SegueRef = {
 *   ref: 'app.dashboard',
 *   refParams: { id: '123' },
 *   refOptions: { location: 'replace' }
 * };
 * ```
 *
 * @see {@link SegueRefOptions} for the options portion of the segue reference
 * @see {@link SegueRefRouterLink} for the supported ref path formats
 */
export interface SegueRef<O = object> extends SegueRefOptions<O> {
  /**
   * Ref path value.
   */
  ref: SegueRefRouterLink;
}

/**
 * Union type representing either a full {@link SegueRef} object or a raw {@link SegueRefRouterLink}.
 *
 * This flexibility allows consumers to pass either a simple string path or a fully-configured segue reference.
 *
 * @typeParam O - The type of the transition options.
 *
 * @example
 * ```ts
 * // As a simple string
 * const link: SegueRefOrSegueRefRouterLink = '/app/dashboard';
 *
 * // As a full SegueRef
 * const ref: SegueRefOrSegueRefRouterLink = { ref: 'app.dashboard', refParams: { id: '123' } };
 * ```
 */
export type SegueRefOrSegueRefRouterLink<O = object> = SegueRef<O> | SegueRefRouterLink;

/**
 * Type guard that checks whether the given input is a {@link SegueRef} object (as opposed to a raw router link string).
 *
 * @typeParam O - The type of the transition options.
 * @param input - The value to test.
 * @returns `true` if the input is a {@link SegueRef} with a non-empty `ref` property.
 *
 * @see {@link asSegueRef} for converting an input to a SegueRef
 */
export function isSegueRef<O = object>(input: Maybe<SegueRefOrSegueRefRouterLink<O>>): input is SegueRef<O> {
  return typeof input === 'object' && hasValueOrNotEmpty((input as SegueRef).ref);
}

/**
 * Converts a {@link SegueRefOrSegueRefRouterLink} to a {@link SegueRef}.
 *
 * - If the input is a string, it is wrapped into a `SegueRef` via {@link refStringToSegueRef}.
 * - If the input is already a `SegueRef`, it is returned as-is.
 * - Otherwise, returns `undefined`.
 *
 * @typeParam O - The type of the transition options.
 * @param input - The value to convert.
 * @returns The converted {@link SegueRef}, or `undefined` if the input is not convertible.
 *
 * @see {@link isSegueRef}
 * @see {@link refStringToSegueRef}
 */
export function asSegueRef<O = object>(input: SegueRefOrSegueRefRouterLink<O>): SegueRef<O>;
export function asSegueRef<O = object>(input: Maybe<SegueRefOrSegueRefRouterLink<O>>): Maybe<SegueRef<O>>;
export function asSegueRef<O = object>(input: Maybe<SegueRefOrSegueRefRouterLink<O>>): Maybe<SegueRef<O>> {
  const type = typeof input;

  if (type === 'string') {
    return refStringToSegueRef(input as string);
  } else if (isSegueRef(input)) {
    return input as SegueRef<O>;
  } else {
    return undefined;
  }
}

/**
 * Extracts the string ref path from a {@link SegueRefOrSegueRefRouterLink}.
 *
 * - If the input is already a string, it is returned directly.
 * - If the input is a `SegueRef`, the `ref` property is returned as a string.
 * - Otherwise, throws an error.
 *
 * @typeParam O - The type of the transition options.
 * @param input - The segue ref or string to extract from.
 * @returns The string representation of the ref.
 * @throws Error if the input cannot be converted to a string.
 */
export function asSegueRefString<O = object>(input: SegueRefOrSegueRefRouterLink<O> | string): string;
export function asSegueRefString<O = object>(input: Maybe<SegueRefOrSegueRefRouterLink<O> | string>): Maybe<string>;
export function asSegueRefString<O = object>(input: Maybe<SegueRefOrSegueRefRouterLink<O> | string>): Maybe<string> {
  if (typeof input === 'string') {
    return input;
  } else if (isSegueRef(input)) {
    return input.ref as string;
  } else {
    throw new Error(`asSegueRefString() failed to convert the input to a string: ${input}`);
  }
}

/**
 * Creates a {@link SegueRef} from a string ref path and optional segue options.
 *
 * @typeParam O - The type of the transition options.
 * @param ref - The string ref path to wrap.
 * @param options - Optional parameters and transition options to include.
 * @returns A new {@link SegueRef} containing the given ref and options.
 */
export function refStringToSegueRef<O = object>(ref: string, options?: SegueRefOptions<O>): SegueRef<O> {
  return { ...options, ref };
}

/**
 * Maps an observable of string ref paths to an observable of {@link SegueRef} objects.
 *
 * @typeParam O - The type of the transition options.
 * @param obs - The source observable emitting string ref paths.
 * @param options - Optional parameters and transition options to include in each emitted SegueRef.
 * @returns An observable that emits {@link SegueRef} objects.
 *
 * @see {@link refStringToSegueRef}
 */
export function mapRefStringObsToSegueRefObs<O = object>(obs: Observable<string>, options?: SegueRefOptions<O>): Observable<SegueRef<O>> {
  return obs.pipe(map((x) => refStringToSegueRef(x, options)));
}
