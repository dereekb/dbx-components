import { Component, inject, input } from '@angular/core';
import { DbxFlexGroupDirective, DbxFlexSizeDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';
import { DbxFirebaseLoginEmailContentRecoveryComponent, DbxFirebaseLoginEmailContentRecoverySentComponent, DbxFirebaseLoginEmailContentStore } from '@dereekb/dbx-firebase';

/**
 * Renders one default password recovery view against its own {@link DbxFirebaseLoginEmailContentStore}, preset with a
 * sample address and a password reset anchor so the view shows every element without sending anything.
 */
@Component({
  selector: 'dbx-firebase-style-demo-login-recovery-preview',
  template: `
    @if (sent()) {
      <dbx-firebase-login-email-content-recovery-sent></dbx-firebase-login-email-content-recovery-sent>
    } @else {
      <dbx-firebase-login-email-content-recovery></dbx-firebase-login-email-content-recovery>
    }
  `,
  host: {
    class: 'dbx-firebase-login-email-content d-block'
  },
  providers: [DbxFirebaseLoginEmailContentStore],
  imports: [DbxFirebaseLoginEmailContentRecoveryComponent, DbxFirebaseLoginEmailContentRecoverySentComponent]
})
export class DbxFirebaseStyleDemoLoginRecoveryPreviewComponent {
  readonly store = inject(DbxFirebaseLoginEmailContentStore);

  readonly sent = input<boolean>(false);

  constructor() {
    this.store.setup({
      passwordResetAnchor: {
        onClick: () => {
          // style demo only; there is no reset page to go to
        }
      },
      defaultValue: { username: 'user@components.dereekb.com', password: '' }
    });

    // records the sample address as the sent-to address; the template picks the view, not the store mode
    this.store.markRecoverySent();
  }
}

/**
 * Style-demo section showing the default password recovery views of the email login: the "request a password reset"
 * view and the "password reset email sent" view. Each tile renders against a preset store, so nothing is sent.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-firebase-login-recovery
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary The default dbx-firebase password recovery and recovery sent views.
 * @dbxDocsUiExampleRelated dbx-firebase-login
 */
@Component({
  selector: 'dbx-firebase-style-demo-login-recovery-section',
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxFirebaseStyleDemoLoginRecoveryPreviewComponent],
  template: `
    <dbx-docs-ui-example header="Firebase Password Recovery" hint="The default password recovery views of the email login.">
      <dbx-docs-ui-example-info>
        <p>
          <code>dbx-firebase-login-email-content-recovery</code>
          asks for the account's email address and sends the reset email.
          <code>dbx-firebase-login-email-content-recovery-sent</code>
          confirms where it was sent. Both read the
          <code>DbxFirebaseLoginEmailContentStore</code>
          and can be replaced through the
          <code>passwordRecoveryViews</code>
          option of
          <code>provideDbxFirebaseLogin()</code>
          .
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div dbxFlexGroup>
          <div [dbxFlexSize]="3">
            <div class="dbx-text-label-small dbx-hint dbx-pb1">Request reset</div>
            <dbx-firebase-style-demo-login-recovery-preview></dbx-firebase-style-demo-login-recovery-preview>
          </div>
          <div [dbxFlexSize]="3">
            <div class="dbx-text-label-small dbx-hint dbx-pb1">Reset email sent</div>
            <dbx-firebase-style-demo-login-recovery-preview [sent]="true"></dbx-firebase-style-demo-login-recovery-preview>
          </div>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxFirebaseStyleDemoLoginRecoverySectionComponent {}
