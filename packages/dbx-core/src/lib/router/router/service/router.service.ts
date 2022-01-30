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

}
