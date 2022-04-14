import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type SegueRefRouterLink = string | any[] | any;

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
  ref?: SegueRefRouterLink;

}

export function refStringToSegueRef<O = any>(ref: string, options?: SegueRefOptions<O>): SegueRef<O> {
  return { ...options, ref };
}

export function mapRefStringObsToSegueRefObs<O = any>(obs: Observable<string>, options?: SegueRefOptions<O>): Observable<SegueRef<O>> {
  return obs.pipe(map(x => refStringToSegueRef(x, options)));
}
