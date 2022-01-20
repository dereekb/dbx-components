import { Component, Input } from '@angular/core';

/**
 * Component that formats a card-box of content.
 */
@Component({
  selector: 'dbx-card-box',
  template: `
  <div class="dbx-card-box">
    <div class="dbx-section-header">
      <div class="dbx-section-header-content">
        <h4 class="dbx-section-header-content-title"><mat-icon *ngIf="icon">{{icon}}</mat-icon><span *ngIf="header" class="title-text">{{ header }}</span></h4>
        <span class="spacer"></span>
        <ng-content select="[sectionHeader]"></ng-content>
      </div>
    </div>
    <div class="dbx-card-box-content">
      <ng-content></ng-content>
    </div>
  </div>
  `
})
export class DbNgxCardBoxComponent {

  @Input()
  header?: string;

  @Input()
  icon?: string;

}
