import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFirebaseOAuthLoginViewComponent, DbxFirebaseOAuthConsentViewComponent, DbxFirebaseOAuthConsentScopeDefaultViewComponent, type OAuthConsentScopesFormValue } from '@dereekb/dbx-firebase/oidc';
import { type OAuthInteractionConsentResponse, type OAuthInteractionLoginDetails } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DemoAuthLoginViewComponent } from '../../../../demo/modules/auth/container/login.view.component';

/**
 * Demo page showing the OIDC/OAuth presentational components in all their states.
 */
@Component({
  templateUrl: './oidc.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DemoAuthLoginViewComponent, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFirebaseOAuthLoginViewComponent, DbxFirebaseOAuthConsentViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionOidcComponent {
  readonly exampleDetails: OAuthInteractionLoginDetails = {
    client_id: 'example-client-id',
    client_name: 'Example OAuth Client',
    client_uri: 'https://example.com',
    logo_uri: 'https://example.com/logo.png',
    scopes: 'openid profile email'
  };

  readonly exampleError = 'Something went wrong. Please try again.';

  readonly customScopeConfig: DbxInjectionComponentConfig = {
    componentClass: DbxFirebaseOAuthConsentScopeDefaultViewComponent
  };

  readonly noopApproveHandler: WorkUsingContext<OAuthConsentScopesFormValue, OAuthInteractionConsentResponse> = (_value, context) => {
    context.reject(new Error('Demo: approve is disabled.'));
  };

  readonly noopDenyHandler: WorkUsingContext<void, OAuthInteractionConsentResponse> = (_value, context) => {
    context.reject(new Error('Demo: deny is disabled.'));
  };
}
