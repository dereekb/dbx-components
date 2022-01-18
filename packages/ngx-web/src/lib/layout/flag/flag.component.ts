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
  `,
  styleUrls: ['./container.scss']
})
export class DbNgxFlagComponent {

  @Input()
  color: ThemePalette = 'accent';

}
