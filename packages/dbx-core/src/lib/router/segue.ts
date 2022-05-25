import { ArrayOrValue, hasValueOrNotEmpty, Maybe } from '@dereekb/util';
import { map, Observable } from 'rxjs';

export type SegueRefRouterLink = string | ArrayOrValue<object>;

export interface SegueRefRawSegueParams {
  [key: string]: unknown;
}

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
 * Represents a segue ref
 */
export interface SegueRef<O = object> extends SegueRefOptions<O> {

  /**
   * Ref path value.
   */
  ref: SegueRefRouterLink;

}

/**
 * A SegueRef object or a different router link representation.
 */
export type SegueRefOrSegueRefRouterLink<O = object> = SegueRef<O> | SegueRefRouterLink;

export function isSegueRef<O = object>(input: Maybe<SegueRefOrSegueRefRouterLink<O>>): input is SegueRef<O> {
  return (typeof input === 'object') && hasValueOrNotEmpty((input as SegueRef).ref);
}

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

export function refStringToSegueRef<O = object>(ref: string, options?: SegueRefOptions<O>): SegueRef<O> {
  return { ...options, ref };
}

export function mapRefStringObsToSegueRefObs<O = object>(obs: Observable<string>, options?: SegueRefOptions<O>): Observable<SegueRef<O>> {
  return obs.pipe(map(x => refStringToSegueRef(x, options)));
}
