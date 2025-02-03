import { Component, Input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxSectionHeaderConfig, DbxSectionHeaderHType } from './section';

/**
 * Component used to style a section's header.
 */
@Component({
  selector: 'dbx-section-header,.dbx-section-header',
  template: `
    <div class="dbx-section-header-content">
      <ng-container *ngIf="showTitle">
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
      </ng-container>
      <ng-content></ng-content>
    </div>
    <p *ngIf="hint && !hintInline" class="dbx-section-hint dbx-hint">{{ hint }}</p>
    <ng-template #headerContentTitleTemplate>
      <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
      <span class="title-text">
        {{ header }}
        <span *ngIf="hint && hintInline" class="dbx-section-hint-inline dbx-hint">{{ hint }}</span>
      </span>
    </ng-template>
  `,
  host: {
    '[class.dbx-section-header-full-title]': 'onlyHeader',
    '[class.dbx-section-header-padded]': 'paddedHeader'
  }
})
export class DbxSectionHeaderComponent {
  @Input()
  paddedHeader?: Maybe<boolean>;

  @Input()
  h?: Maybe<DbxSectionHeaderHType>;

  @Input()
  header?: Maybe<string>;

  @Input()
  onlyHeader?: Maybe<boolean> = false;

  @Input()
  icon?: Maybe<string>;

  @Input()
  hint?: Maybe<string>;

  @Input()
  hintInline?: Maybe<boolean>;

  constructor() {}

  @Input()
  set headerConfig(headerConfig: Maybe<DbxSectionHeaderConfig>) {
    if (headerConfig) {
      if (headerConfig.h !== undefined) {
        this.h = headerConfig.h;
      }

      if (headerConfig.header !== undefined) {
        this.header = headerConfig.header;
      }

      if (headerConfig.onlyHeader !== undefined) {
        this.onlyHeader = headerConfig.onlyHeader;
      }

      if (headerConfig.icon !== undefined) {
        this.icon = headerConfig.icon;
      }

      if (headerConfig.hint !== undefined) {
        this.hint = headerConfig.hint;
      }

      if (headerConfig.hintInline !== undefined) {
        this.hintInline = headerConfig.hintInline;
      }
    }
  }

  get showTitle() {
    return Boolean(this.header || this.icon);
  }
}
