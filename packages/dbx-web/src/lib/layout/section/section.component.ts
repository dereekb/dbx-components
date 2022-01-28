import { Component, Input } from '@angular/core';

/**
 * Component used to format content on a page within a section.
 */
@Component({
  selector: 'dbx-section',
  template: `
  <div class="dbx-section">
    <div class="dbx-section-header">
      <div class="dbx-section-header-content">
        <h2 class="dbx-section-header-content-title"><mat-icon *ngIf="icon">{{icon}}</mat-icon><span class="title-text">{{ header }}</span></h2>
        <span class="spacer"></span>
        <ng-content select="[sectionHeader]"></ng-content>
      </div>
      <p *ngIf="hint" class="dbx-section-hint">{{ hint }}</p>
    </div>
    <div class="dbx-section-content">
      <ng-content></ng-content>
    </div>
  </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbNgxSectionComponent {

  @Input()
  header?: string;

  @Input()
  icon?: string;

  @Input()
  hint?: string;

}
