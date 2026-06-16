import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxFlexGroupDirective, DbxFlexSizeDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';
import { DbxFirebaseLoginComponent } from '@dereekb/dbx-firebase';
import { DbxFirebaseOAuthLoginViewComponent } from '@dereekb/dbx-firebase/oidc';

/**
 * Style-demo section showing the presentational `dbx-firebase-oauth-login-view` in its three render states —
 * `no_user` (projecting the real `dbx-firebase-login` provider buttons), `submitting`, and `error` — so the login
 * surfaces are visible in the playground. Rendering makes no network calls; the provider buttons resolve from the
 * host app's login configuration at render time.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-firebase-login
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary The dbx-firebase-oauth-login-view in its no_user, submitting, and error render states.
 * @dbxDocsUiExampleRelated dbx-firebase-login
 */
@Component({
  selector: 'dbx-firebase-style-demo-login-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxFirebaseLoginComponent, DbxFirebaseOAuthLoginViewComponent],
  template: `
    <dbx-docs-ui-example header="Firebase Login" hint="The OIDC login view in each render state.">
      <dbx-docs-ui-example-info>
        <p>
          <code>dbx-firebase-oauth-login-view</code>
          is presentational: it renders the login UI for a given
          <code>loginStateCase</code>
          . The
          <code>no_user</code>
          tile projects the real
          <code>dbx-firebase-login</code>
          provider buttons; the
          <code>submitting</code>
          and
          <code>error</code>
          tiles show the loading and error+retry styling. Rendering makes no network calls — the buttons resolve from the host app's login configuration at render time.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div dbxFlexGroup>
          <div [dbxFlexSize]="2">
            <div class="dbx-text-label-small dbx-hint dbx-pb1">No user</div>
            <dbx-firebase-oauth-login-view [loginStateCase]="'no_user'">
              <dbx-firebase-login></dbx-firebase-login>
            </dbx-firebase-oauth-login-view>
          </div>
          <div [dbxFlexSize]="2">
            <div class="dbx-text-label-small dbx-hint dbx-pb1">Submitting</div>
            <dbx-firebase-oauth-login-view [loginStateCase]="'submitting'"></dbx-firebase-oauth-login-view>
          </div>
          <div [dbxFlexSize]="2">
            <div class="dbx-text-label-small dbx-hint dbx-pb1">Error</div>
            <dbx-firebase-oauth-login-view [loginStateCase]="'error'" [error]="'Example authentication error for styling.'"></dbx-firebase-oauth-login-view>
          </div>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxFirebaseStyleDemoLoginSectionComponent {}
