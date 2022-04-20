import { ArrayOrValue } from '@dereekb/util';
import { map, Observable } from 'rxjs';

export type SegueRefRouterLink = string | ArrayOrValue<any>;

export interface SegueRefRawSegueParams {
  [key: string]: any;
}

export interface SegueRefOptions<O = any> {

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
export interface SegueRef<O = any> extends SegueRefOptions<O> {

  /**
   * Ref path value.
   */
  ref: SegueRefRouterLink;

}

/**
 * A SegueRef object or a different router link representation.
 */
export type SegueRefOrSegueRefRouterLink<O = any> = SegueRef<O> | SegueRefRouterLink;

export function isSegueRef<O = any>(input: SegueRefOrSegueRefRouterLink<O>): input is SegueRef<O> {
  return (typeof input === 'object') && input.ref != null;
}

export function asSegueRef<O = any>(input: SegueRefOrSegueRefRouterLink<O>): SegueRef<O> {
  const type = typeof input;

  if (type === 'string') {
    return refStringToSegueRef(input);
  } else if (isSegueRef(input)) {
    return input;
  } else {
    return { ref: undefined };
  }
}

export function refStringToSegueRef<O = any>(ref: string, options?: SegueRefOptions<O>): SegueRef<O> {
  return { ...options, ref };
}

export function mapRefStringObsToSegueRefObs<O = any>(obs: Observable<string>, options?: SegueRefOptions<O>): Observable<SegueRef<O>> {
  return obs.pipe(map(x => refStringToSegueRef(x, options)));
}
