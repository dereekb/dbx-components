import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatToolbarModule } from '@angular/material/toolbar';

/**
 * Toolbar-like component that wraps content. Generally sits at the top of a page.
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
