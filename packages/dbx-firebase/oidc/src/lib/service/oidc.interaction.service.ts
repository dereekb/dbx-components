import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable, switchMap, first } from 'rxjs';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxFirebaseOidcConfigService } from './oidc.configuration.service';
import { type OAuthInteractionConsentRequest, type OidcInteractionUid, type OAuthInteractionLoginResponse, type OAuthInteractionConsentResponse } from '@dereekb/firebase';

// MARK: Service
/**
 * Service for communicating with the backend OIDC interaction endpoints.
 *
 * Automatically includes the current user's Firebase Auth ID token
 * with each request for server-side verification.
 *
 * After successful login/consent submission, the server returns a redirect URL.
 * The component is responsible for navigating to it (e.g., via `window.location.href`).
 */
@Injectable({ providedIn: 'root' })
export class DbxFirebaseOidcInteractionService {
  private readonly http = inject(HttpClient);
  private readonly _authService = inject(DbxFirebaseAuthService);
  private readonly _oidcConfig = inject(DbxFirebaseOidcConfigService);

  /**
   * Base URL for the interaction API, derived from the OIDC config service.
   *
   * @returns The base URL string for the OIDC interaction endpoint.
   */
  get baseUrl(): string {
    return this._oidcConfig.oidcInteractionEndpointApiPath;
  }

  /**
   * Submit login to complete the login interaction.
   *
   * Automatically attaches the current user's Firebase ID token.
   *
   * @param uid - The OIDC interaction UID identifying the current login interaction.
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitLogin(uid: OidcInteractionUid): Observable<OAuthInteractionLoginResponse> {
    return this._authService.idTokenString$.pipe(
      first(),
      switchMap((idToken) => this.http.post<OAuthInteractionLoginResponse>(`${this.baseUrl}/${uid}/login`, { idToken }))
    );
  }

  /**
   * Submit consent decision to complete the consent interaction.
   *
   * Automatically attaches the current user's Firebase ID token. When `approved`
   * is true, optional `grants` may be passed to grant only a subset of the
   * requested scopes/claims/resource scopes; the server validates that any
   * subset is contained in the corresponding `missing*` set on the prompt.
   *
   * When `approved` is false, `grants` is ignored (not sent).
   *
   * @param uid - The OIDC interaction UID identifying the current consent interaction.
   * @param approved - Whether the user approved or denied the consent request.
   * @param grants - Optional subset of OIDC scopes / OIDC claims / resource scopes to grant.
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitConsent(uid: OidcInteractionUid, approved: boolean, grants?: Pick<OAuthInteractionConsentRequest, 'grantedOIDCScopes' | 'grantedOIDCClaims' | 'grantedResourceScopes'>): Observable<OAuthInteractionConsentResponse> {
    return this._authService.idTokenString$.pipe(
      first(),
      switchMap((idToken) => {
        const body: OAuthInteractionConsentRequest = approved && grants ? { idToken, approved, ...grants } : { idToken, approved };
        return this.http.post<OAuthInteractionConsentResponse>(`${this.baseUrl}/${uid}/consent`, body);
      })
    );
  }
}
