import { SegueRefOrSegueRefRouterLink } from '../../router/segue';

/**
 * Auth routes configurations for an app.
 */
export abstract class DbxAppAuthRoutes {
  abstract readonly loginRef: SegueRefOrSegueRefRouterLink;
  abstract readonly loggedOutRef?: SegueRefOrSegueRefRouterLink;
  abstract readonly onboardRef?: SegueRefOrSegueRefRouterLink;
  abstract readonly appRef: SegueRefOrSegueRefRouterLink;
}
