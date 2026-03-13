import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';

// MARK: Types
export interface OAuthInteractionLoginRequest {
  readonly idToken: string;
}

export interface OAuthInteractionConsentRequest {
  readonly approved: boolean;
}

// MARK: Service
/**
 * Service for communicating with the backend OIDC interaction endpoints.
 */
@Injectable({ providedIn: 'root' })
export class OAuthInteractionService {
  private readonly http = inject(HttpClient);

  /**
   * Base URL for the interaction API.
   * Should be configured via DI or environment config.
   */
  private _baseUrl = '/api/interaction';

  setBaseUrl(url: string): void {
    this._baseUrl = url;
  }

  /**
   * Submit login proof (Firebase ID token) to complete the login interaction.
   */
  submitLogin(uid: string, idToken: string): Observable<unknown> {
    return this.http.post(`${this._baseUrl}/${uid}/login`, { idToken } as OAuthInteractionLoginRequest);
  }

  /**
   * Submit consent decision to complete the consent interaction.
   */
  submitConsent(uid: string, approved: boolean): Observable<unknown> {
    return this.http.post(`${this._baseUrl}/${uid}/consent`, { approved } as OAuthInteractionConsentRequest);
  }
}
