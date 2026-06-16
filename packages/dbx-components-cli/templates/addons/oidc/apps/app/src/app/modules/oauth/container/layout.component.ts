import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UIView } from '@uirouter/angular';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DbxContentPageDirective, DbxContentContainerDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [DbxContentPageDirective, DbxContentContainerDirective, DbxAppContextStateDirective, UIView],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class APP_CODE_PREFIXOAuthLayoutComponent {}
