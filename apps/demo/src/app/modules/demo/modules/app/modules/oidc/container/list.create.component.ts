import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxContentContainerDirective, DbxTwoColumnRightComponent } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryClientCreateComponent } from '@dereekb/dbx-firebase/oidc';
import { type CreateOidcClientResult } from '@dereekb/firebase';
import { DemoAppRouterService } from '../../../demo.app.router.service';
import { DbxRouterService } from '@dereekb/dbx-core';

@Component({
  templateUrl: './list.create.component.html',
  imports: [DbxTwoColumnRightComponent, DbxFirebaseOidcEntryClientCreateComponent, DbxContentContainerDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAppOidcClientCreatePageComponent {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly dbxRouterService = inject(DbxRouterService);

  onClientCreated(result: CreateOidcClientResult): void {
    const ref = this.demoAppRouterService.oidcClientRef(result.client_id);
    void this.dbxRouterService.go(ref);
  }
}
