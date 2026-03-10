import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type ThemePalette } from '@angular/material/core';
import { MatToolbarModule } from '@angular/material/toolbar';

/**
 * A themed toolbar banner that wraps projected content, typically placed at the top of a page to highlight status or actions.
 *
 * @example
 * ```html
 * <dbx-flag color="warn">
 *   <span>Important notice</span>
 * </dbx-flag>
 * ```
 */
@Component({
  selector: 'dbx-flag',
  template: `
    <div class="dbx-flag">
      <mat-toolbar [color]="color()">
        <ng-content></ng-content>
      </mat-toolbar>
    </div>
  `,
  imports: [MatToolbarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFlagComponent {
  readonly color = input<ThemePalette>('accent');
}
