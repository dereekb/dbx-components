import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxAppContextStateDirective, DbxAuthImpersonationQuerySyncDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  imports: [DbxAppContextStateDirective, DbxAuthImpersonationQuerySyncDirective, UIView],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAppLayoutComponent {}
