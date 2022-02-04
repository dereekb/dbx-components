import { Component, Input, ViewEncapsulation } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxSectionHeaderHType } from './section';

/**
 * Component used to style a section's header.
 */
@Component({
  selector: '.dbx-section-header',
  template: `
    <div class="dbx-section-header-content">
      <ng-container [ngSwitch]="h ?? 1">
        <h1 *ngSwitchCase="1" class="dbx-section-header-content-title">
          <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
        </h1>
        <h2 *ngSwitchCase="2" class="dbx-section-header-content-title">
          <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
        </h2>
        <h3 *ngSwitchCase="3" class="dbx-section-header-content-title">
          <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
        </h3>
        <h4 *ngSwitchCase="4" class="dbx-section-header-content-title">
          <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
        </h4>
        <h5 *ngSwitchCase="5" class="dbx-section-header-content-title">
          <ng-container *ngTemplateOutlet="headerContentTitleTemplate"></ng-container>
        </h5>
      </ng-container>
      <span class="spacer"></span>
      <ng-content></ng-content>
    </div>
    <p *ngIf="hint" class="dbx-section-hint">{{ hint }}</p>
    <ng-template #headerContentTitleTemplate>
        <mat-icon *ngIf="icon">{{icon}}</mat-icon><span class="title-text">{{ header }}</span>
    </ng-template>
  `
})
export class DbxSectionHeaderComponent {

  @Input()
  h?: Maybe<DbxSectionHeaderHType>;

  @Input()
  header?: Maybe<string>;

  @Input()
  icon?: Maybe<string>;

  @Input()
  hint?: Maybe<string>;

}
