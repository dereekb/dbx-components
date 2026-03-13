import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable, switchMap, first } from 'rxjs';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxFirebaseOidcConfigService } from './oidc.configuration.service';
import { type OAuthInteractionLoginRequest, type OAuthInteractionConsentRequest, type OidcInteractionUid } from '@dereekb/firebase';

// MARK: Types
/**
 * Response from the server after a successful interaction submission.
 *
 * The server returns a redirect URL that the client should navigate to
 * in order to complete the OIDC flow.
 */
export interface OidcInteractionResponse {
  readonly redirectTo: string;
}

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
   */
  get baseUrl(): string {
    return this._oidcConfig.oidcInteractionEndpointApiPath;
  }

  /**
   * Submit login to complete the login interaction.
   *
   * Automatically attaches the current user's Firebase ID token.
   *
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitLogin(uid: OidcInteractionUid): Observable<OidcInteractionResponse> {
    return this._authService.idTokenString$.pipe(
      first(),
      switchMap((idToken) => this.http.post<OidcInteractionResponse>(`${this.baseUrl}/${uid}/login`, { idToken } as OAuthInteractionLoginRequest))
    );
  }

  /**
   * Submit consent decision to complete the consent interaction.
   *
   * Automatically attaches the current user's Firebase ID token.
   *
   * @returns Observable that emits the redirect URL from the server response.
   */
  submitConsent(uid: OidcInteractionUid, approved: boolean): Observable<OidcInteractionResponse> {
    return this._authService.idTokenString$.pipe(
      first(),
      switchMap((idToken) => this.http.post<OidcInteractionResponse>(`${this.baseUrl}/${uid}/consent`, { idToken, approved } as OAuthInteractionConsentRequest))
    );
  }
}
