import type admin from 'firebase-admin';
import { Module } from '@nestjs/common';
import { OAuthModule } from '@dereekb/firebase-server/oidc';
import { FIREBASE_AUTH_TOKEN, FirebaseServerAuthModule } from '@dereekb/firebase-server';

/**
 * Demo OAuth/OIDC module.
 *
 * Configures the OIDC provider for the demo application using the async factory pattern.
 * Firestore is automatically injected via `FIREBASE_FIRESTORE_TOKEN` by `OAuthModule`.
 */
@Module({
  imports: [
    OAuthModule.forRootAsync({
      imports: [FirebaseServerAuthModule],
      useFactory: (auth: admin.auth.Auth) => ({
        issuer: process.env['OIDC_ISSUER_URL'] ?? 'http://localhost:5001/demo/us-central1/api',
        auth,
        jwksEncryptionSecret: process.env['JWKS_ENCRYPTION_SECRET'] ?? '0'.repeat(64),
        loginUrl: '/oauth/login',
        consentUrl: '/oauth/consent',
        collectionPrefix: 'oidc_'
      }),
      inject: [FIREBASE_AUTH_TOKEN]
    })
  ],
  exports: [OAuthModule]
})
export class DemoApiOAuthModule {}
