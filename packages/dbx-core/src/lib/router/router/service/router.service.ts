import { SegueRef } from "../../segue";

/**
 * Router service definition that can route the app and provide routing details.
 */
export abstract class DbxRouterService {

  /**
   * Navigates to the target SegueRef.
   * 
   * @param segueRef 
   */
  abstract go(segueRef: SegueRef): Promise<boolean>;

  /**
   * Returns true if the input segue ref is considered active.
   * 
   * @param segueRef 
   */
  abstract isActive(segueRef: SegueRef): boolean;

  /**
   * Compares the two refs for precision for a certain route. 
   * 
   * For example, if the parent route is input with a child route, the child route is 
   * considered more precise.
   * 
   * @param a 
   * @param b 
   */
  abstract comparePrecision(a: SegueRef, b: SegueRef): number;

}
