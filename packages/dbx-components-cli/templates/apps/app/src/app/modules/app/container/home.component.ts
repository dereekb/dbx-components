import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentLayoutModule } from '@dereekb/dbx-web';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';

@Component({
  templateUrl: './home.component.html',
  imports: [DbxContentLayoutModule, DbxAppContextStateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class AppHomeComponent { }
