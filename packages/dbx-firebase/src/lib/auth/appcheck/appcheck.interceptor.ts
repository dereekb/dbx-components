import { urlWithoutParameters } from '@dereekb/util';
import { DBX_FIREBASE_OPTIONS_TOKEN, DbxFirebaseOptions } from '../../firebase/options';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { getToken } from 'firebase/app-check';
import { Observable, switchMap, first, map, from } from 'rxjs';
import { Inject, Injectable } from '@angular/core';
import { AppCheck } from '@angular/fire/app-check';

interface EnabledAppCheckRoute {
  isWildcard: boolean;
  match: string;
}

/**
 * HTTP Interceptor that sets the X-Firebase-AppCheck for any requests to the routes configured in DbxFirebaseOptions.
 */
@Injectable()
export class DbxFirebaseAppCheckHttpInterceptor implements HttpInterceptor {
  private _isEnabled: boolean;
  private _appCheckRoutes: EnabledAppCheckRoute[];

  constructor(@Inject(DBX_FIREBASE_OPTIONS_TOKEN) private dbxFirebaseOptions: DbxFirebaseOptions, private appCheck: AppCheck) {
    let routes: EnabledAppCheckRoute[] = [];

    if (appCheck != null) {
      routes = (this.dbxFirebaseOptions.appCheck?.appCheckRoutes ?? ['/api/*']).map((route) => {
        const wildcardIndex = route.indexOf('*');
        const isWildcard = wildcardIndex === route.length - 1;
        const match = isWildcard ? route.substring(0, wildcardIndex) : route;

        return {
          isWildcard,
          match
        };
      });
    }

    this._appCheckRoutes = routes;
    this._isEnabled = routes.length > 0;
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let obs: Observable<HttpEvent<unknown>>;

    if (this._isEnabled) {
      obs = this.matchesAnyRoute(req.url).pipe(
        switchMap((isMatch) => {
          let nextEvent: Observable<HttpEvent<unknown>>;

          if (isMatch) {
            nextEvent = from(
              getToken(this.appCheck).then((appCheckTokenResponse) => {
                const token = appCheckTokenResponse.token;
                let nextRequest: HttpRequest<unknown> = req;

                if (token) {
                  nextRequest = req.clone({
                    headers: req.headers.set('X-Firebase-AppCheck', token)
                  });
                }

                return nextRequest;
              })
            ).pipe(switchMap((nextRequest) => next.handle(nextRequest)));
          } else {
            nextEvent = next.handle(req);
          }

          return nextEvent;
        })
      );
    } else {
      obs = next.handle(req);
    }

    return obs;
  }

  private matchesAnyRoute(inputUrl: string): Observable<boolean> {
    const url = urlWithoutParameters(inputUrl);

    function isEnabledRouteMatch(enabledRoute: EnabledAppCheckRoute): boolean {
      if (enabledRoute.isWildcard) {
        return url.startsWith(enabledRoute.match);
      } else {
        return url === enabledRoute.match;
      }
    }

    return from(this._appCheckRoutes).pipe(
      first((route) => isEnabledRouteMatch(route), false),
      map((x) => Boolean(x))
    );
  }
}
