import { Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';

/**
 * Toolbar-like component that wraps content. Generally sits at the top of a page.
 */
@Component({
  selector: 'dbx-flag',
  template: `
    <div class="dbx-flag">
      <mat-toolbar [color]="color">
        <ng-content></ng-content>
      </mat-toolbar>
    </div>
  `
  // TODO: styleUrls: ['./container.scss']
})
export class DbxFlagComponent {
  @Input()
  color: ThemePalette = 'accent';
}
