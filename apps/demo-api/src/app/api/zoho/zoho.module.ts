import { Module } from '@nestjs/common';
import { ZOHO_ACCOUNTS_PROFILE_READ_SCOPE, type ZohoOAuthScope } from '@dereekb/zoho';
import { appZohoAccountsOAuthModuleMetadata } from '@dereekb/zoho/nestjs';
import { appZohoUserExternalConnectionOAuthModuleMetadata } from '@dereekb/firebase-server/zoho';
import { DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE } from 'demo-firebase';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH, UserExternalConnectionModule } from '../../common/model/userexternalconnection';

/**
 * Zoho scopes the `zoho_admin` connection requests: exactly the CRM, Recruit and Desk MODULE scopes the
 * `zoho-cli` commands use (records, notes/attachments/emails, tickets and their threads/comments/time
 * entries, contacts, tasks/events, search, agents/departments), plus the profile read every Zoho
 * connection needs to identify the account.
 *
 * Least privilege, because the access token is minted out to a CLI: deliberately none of the
 * `*.settings.*`, org, users or functions-execute scopes zoho-cli's own interactive login asks for —
 * nothing that administers the Zoho org itself. Zoho Sign / Analytics need a different OAuth client,
 * so they are not covered by this connection.
 */
export const DEMO_ZOHO_ADMIN_OAUTH_SCOPES: readonly ZohoOAuthScope[] = [
  // CRM + Recruit: list/get/search/insert/upsert/update/delete records, emails, attachments
  'ZohoCRM.modules.ALL',
  'ZohoRecruit.modules.ALL',
  // Desk: tickets (incl. threads, comments, attachments, followers, tags, time), contacts, activities
  'Desk.tickets.ALL',
  'Desk.contacts.ALL',
  'Desk.tasks.ALL',
  'Desk.events.ALL',
  'Desk.search.READ',
  // agents + departments listings
  'Desk.basic.READ',
  ZOHO_ACCOUNTS_PROFILE_READ_SCOPE
];

/**
 * The per-user Zoho OAuth client.
 *
 * No dependency module and no `ZohoAccountsAccessTokenCacheService`: that cache holds the
 * SERVER-to-server token, and a per-user connect has no server token to cache. The existing
 * `firebaseZohoAccountsAccessTokenCacheService` is untouched by this.
 */
@Module(appZohoAccountsOAuthModuleMetadata({}))
export class DemoZohoAccountsOAuthModule {}

/**
 * Mounts the Zoho connect endpoints at `/oauth/zoho`.
 *
 * The app supplies only where the user is returned to; the redirect URI is derived by the framework
 * from the server environment's OAuth origin and the same path the controller mounts on.
 */
@Module(
  appZohoUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: DemoZohoAccountsOAuthModule,
    // UserExternalConnectionModule supplies both the persistence actions and the shared state coder
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoZohoOAuthCallbackModule {}

/**
 * Mounts the ADMIN Zoho connect endpoints at `/oauth/zoho_admin`: a second Zoho connection with its own
 * consent and the {@link DEMO_ZOHO_ADMIN_OAUTH_SCOPES}, that exists only to be minted out to `zoho-cli`
 * through `DemoExternalConnectionTokenApiModule`.
 *
 * Same Zoho OAuth client as {@link DemoZohoOAuthCallbackModule} (one shared
 * {@link DemoZohoAccountsOAuthModule}), so its redirect URI `<oauth origin>/oauth/zoho_admin/callback`
 * MUST be registered as an Authorized Redirect URI on that client in the Zoho API console, alongside
 * `/oauth/zoho/callback` — Zoho refuses an unregistered redirect outright. Its routes are excluded from
 * the global `/api` prefix in `app.ts`, and its service is registered with the OAuth registry in
 * `api.module.ts` under `zohoUserExternalConnectionOAuthServiceToken('zoho_admin')`.
 *
 * Only an admin can obtain a state for it (`adminOnly` in `UserExternalConnectionModule`'s policies).
 */
@Module(
  appZohoUserExternalConnectionOAuthModuleMetadata({
    providerType: DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    scopes: DEMO_ZOHO_ADMIN_OAUTH_SCOPES,
    dependencyModule: DemoZohoAccountsOAuthModule,
    imports: [UserExternalConnectionModule],
    successPath: DEMO_EXTERNAL_CONNECTION_RETURN_PATH,
    failurePath: DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH
  })
)
export class DemoZohoAdminOAuthCallbackModule {}

@Module({
  imports: [DemoZohoOAuthCallbackModule, DemoZohoAdminOAuthCallbackModule],
  exports: [DemoZohoOAuthCallbackModule, DemoZohoAdminOAuthCallbackModule]
})
export class DemoApiZohoModule {}
