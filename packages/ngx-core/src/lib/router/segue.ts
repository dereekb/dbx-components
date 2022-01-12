import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type SegueRefRouterLink = string | any[];

export interface SegueRefRawSegueParams {
  [key: string]: any;
}

export interface SegueRefOptions {

  /**
   * Raw parameters
   */
  refParams?: SegueRefRawSegueParams;

  /**
   * Custom Transition Options.
   * 
   * For UIRouter, this is TransitionOptions.
   */
  refOptions?: any;

}

/**
 * Represents a segue ref
 */
export interface SegueRef extends SegueRefOptions {

  /**
   * UI Sref reference value.
   */
  ref?: SegueRefRouterLink;

}

export function refStringToSegueRef(ref: string, options?: SegueRefOptions): SegueRef {
  return { ...options, ref };
}

export function mapRefStringObsToSegueRefObs(obs: Observable<string>, options?: SegueRefOptions): Observable<SegueRef> {
  return obs.pipe(map(x => refStringToSegueRef(x, options)));
}
