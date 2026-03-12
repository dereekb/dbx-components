import { Component, inject } from '@angular/core';
import { DbxContentContainerDirective, DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryClientCreateComponent } from '@dereekb/dbx-firebase/oidc';
import { type CreateOidcClientResult } from '@dereekb/firebase';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DbxRouterService } from '@dereekb/dbx-core';

@Component({
  templateUrl: './list.create.component.html',
  imports: [DbxTwoColumnRightComponent, DbxFirebaseOidcEntryClientCreateComponent, DbxContentContainerDirective],
  standalone: true
})
export class DemoAppOAuthClientCreatePageComponent {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly dbxRouterService = inject(DbxRouterService);

  onClientCreated(result: CreateOidcClientResult): void {
    const ref = this.demoAppRouterService.oauthClientRef(result.client_id);
    this.dbxRouterService.go(ref);
  }
}
