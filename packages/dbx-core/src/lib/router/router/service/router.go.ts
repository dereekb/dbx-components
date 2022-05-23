import { ObservableOrValue, asObservable } from "@dereekb/rxjs";
import { firstValueFrom } from "rxjs";
import { SegueRef, SegueRefOrSegueRefRouterLink } from "../../segue";
import { DbxRouterService } from "./router.service";

/**
 * Function that will perform navigation with the input route.
 */
export type GoWithRouter = (route: ObservableOrValue<SegueRef>) => Promise<boolean>;

/**
 * Creates a GoWithRouter function.
 * 
 * @param dbxRouterService 
 * @returns 
 */
export function goWithRouter(dbxRouterService: DbxRouterService): (route: ObservableOrValue<SegueRefOrSegueRefRouterLink>) => Promise<boolean> {
  return (route) => {
    return firstValueFrom(asObservable(route)).then(x => dbxRouterService.go(x));
  };
}
