import { Component, input, Input } from '@angular/core';
import { ClickableIconAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Component that displays an anchor and a mat-button.
 */
@Component({
  selector: 'dbx-anchor-icon',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, DbxAnchorComponent],
  template: `
    <dbx-anchor [anchor]="anchor()">
      <button mat-icon-button>
        <mat-icon>{{ anchor()?.icon }}</mat-icon>
      </button>
    </dbx-anchor>
  `
})
export class DbxAnchorIconComponent {
  readonly anchor = input<Maybe<ClickableIconAnchorLink>>();
}
