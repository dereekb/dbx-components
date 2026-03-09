import { type Firestore } from 'firebase-admin/firestore';
import type * as admin from 'firebase-admin';

// MARK: Config
/**
 * Configuration for the OAuth/OIDC module.
 */
export interface OAuthModuleConfig {
  /**
   * The OIDC issuer URL (e.g., 'https://accounts.example.com').
   * Must be the canonical URL where the OIDC provider is accessible.
   */
  readonly issuer: string;
  /**
   * Firestore instance for persistence.
   */
  readonly firestore: Firestore;
  /**
   * Firebase Admin Auth instance for findAccount.
   */
  readonly auth: admin.auth.Auth;
  /**
   * Encryption secret for JWKS private key storage.
   * 64-character hex string (32-byte AES-256 key).
   */
  readonly jwksEncryptionSecret: string;
  /**
   * Prefix for OIDC Firestore collections.
   * Defaults to 'oidc_'.
   */
  readonly collectionPrefix?: string;
  /**
   * Frontend URL for the login interaction page.
   * The interaction uid will be appended as a query parameter.
   */
  readonly loginUrl: string;
  /**
   * Frontend URL for the consent interaction page.
   */
  readonly consentUrl: string;
  /**
   * GCS bucket name for JWKS publishing (optional).
   */
  readonly gcsBucket?: string;
  /**
   * GCS path for JWKS file (optional). Defaults to 'jwks.json'.
   */
  readonly gcsJwksPath?: string;
  /**
   * Routes to exclude from AppCheck middleware.
   * Defaults to OIDC and interaction routes.
   */
  readonly excludeFromAppCheck?: string[];
  /**
   * Token lifetime overrides.
   */
  readonly tokenLifetimes?: Partial<OAuthTokenLifetimes>;
}

export interface OAuthTokenLifetimes {
  /**
   * Access token lifetime in seconds. Defaults to 900 (15 min).
   */
  readonly accessToken: number;
  /**
   * Refresh token lifetime in seconds (absolute). Defaults to 2592000 (30 days).
   */
  readonly refreshToken: number;
  /**
   * Authorization code lifetime in seconds. Defaults to 60.
   */
  readonly authorizationCode: number;
}

export const DEFAULT_TOKEN_LIFETIMES: OAuthTokenLifetimes = {
  accessToken: 900,
  refreshToken: 30 * 24 * 60 * 60,
  authorizationCode: 60
};

export const OAUTH_MODULE_CONFIG_TOKEN = 'OAUTH_MODULE_CONFIG_TOKEN';
