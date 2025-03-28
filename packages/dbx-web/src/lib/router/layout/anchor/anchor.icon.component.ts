import { Component, Input } from '@angular/core';
import { ClickableIconAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Component that displays an anchor and a mat-button.
 */
@Component({
  selector: 'dbx-anchor-icon',
  standalone: true,
  imports: [MatIcon, MatButton, DbxAnchorComponent],
  template: `
    <dbx-anchor [anchor]="anchor">
      <button mat-icon-button>
        <mat-icon>{{ anchor?.icon }}</mat-icon>
      </button>
    </dbx-anchor>
  `
})
export class DbxAnchorIconComponent {
  @Input()
  anchor: Maybe<ClickableIconAnchorLink>;
}
