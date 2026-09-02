import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { DbxAnchorComponent, DbxContentLayoutModule } from '@dereekb/dbx-web';

@Component({
  templateUrl: './home.component.html',
  imports: [DbxContentLayoutModule, DbxAnchorComponent, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAppHomeComponent {}
