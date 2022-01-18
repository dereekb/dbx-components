import { Component, Input } from '@angular/core';

/**
 * Component used to style a page that is made up of app sections.
 */
@Component({
  selector: 'dbx-section-page',
  template: `
  <div class="dbx-section-page">
    <div class="dbx-section-header">
      <div class="dbx-section-header-content">
        <h1 class="dbx-section-header-content-title"><mat-icon *ngIf="icon">{{icon}}</mat-icon><span class="title-text">{{ header }}</span></h1>
        <span class="spacer"></span>
        <ng-content select="[sectionHeader]"></ng-content>
      </div>
    </div>
    <ng-content></ng-content>
  </div>
  `,
  styleUrls: ['./container.scss']
})
export class DbNgxSectionPageComponent {

  @Input()
  header: string;

  @Input()
  icon?: string;

}
