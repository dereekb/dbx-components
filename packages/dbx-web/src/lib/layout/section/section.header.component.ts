import { Component, Input } from '@angular/core';

/**
 * Component used to style a section's header.
 */
@Component({
  selector: '.dbx-section-header',
  template: `
    <div class="dbx-section-header-content">
      <h1 class="dbx-section-header-content-title"><mat-icon *ngIf="icon">{{icon}}</mat-icon><span class="title-text">{{ header }}</span></h1>
      <span class="spacer"></span>
      <ng-content></ng-content>
    </div>
    <p *ngIf="hint" class="dbx-section-hint">{{ hint }}</p>
  `
})
export class DbxSectionHeaderComponent {

  @Input()
  header?: string;

  @Input()
  icon?: string;

  @Input()
  hint?: string;

}
