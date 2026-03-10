import { Component, input } from '@angular/core';
import { type ClickableIconAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Renders a Material icon button wrapped in a {@link DbxAnchorComponent} for navigation.
 *
 * The icon is sourced from the provided {@link ClickableIconAnchorLink}.
 *
 * @example
 * ```html
 * <dbx-anchor-icon [anchor]="{ icon: 'settings', url: '/settings' }"></dbx-anchor-icon>
 * ```
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
