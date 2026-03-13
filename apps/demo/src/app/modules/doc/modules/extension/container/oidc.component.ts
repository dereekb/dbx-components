import { Component } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFirebaseOAuthLoginViewComponent, DbxFirebaseOAuthConsentViewComponent, DbxFirebaseOAuthConsentScopeDefaultViewComponent } from '@dereekb/dbx-firebase/oidc';
import { type OidcScope } from '@dereekb/firebase';
import { DemoAuthLoginViewComponent } from '../../../../demo/modules/auth/container/login.view.component';

/**
 * Demo page showing the OIDC/OAuth presentational components in all their states.
 */
@Component({
  templateUrl: './oidc.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DemoAuthLoginViewComponent, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFirebaseOAuthLoginViewComponent, DbxFirebaseOAuthConsentViewComponent]
})
export class DocExtensionOidcComponent {
  readonly exampleClientName = 'Example OAuth Client';

  readonly exampleScopes: OidcScope[] = ['openid', 'profile', 'email'];

  readonly exampleError = 'Something went wrong. Please try again.';

  readonly customScopeConfig: DbxInjectionComponentConfig = {
    componentClass: DbxFirebaseOAuthConsentScopeDefaultViewComponent
  };
}
