import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UIView } from '@uirouter/angular';
import { DbxFirebaseDevelopmentDirective } from '@dereekb/dbx-firebase';
import { DbxStyleLayoutModule } from '@dereekb/dbx-web';

@Component({
  templateUrl: './layout.component.html',
  imports: [UIView, DbxStyleLayoutModule, DbxFirebaseDevelopmentDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class RootAppLayoutComponent { }
