import { BehaviorSubject, combineLatest, distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs';
import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { AbstractFilterPopoverButtonDirective } from './filter.popover.button.directive';
import { DbxButtonDisplayContent, dbxButtonDisplayContentType, DbxButtonDisplayContentType, DbxButtonDisplayDelegate } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

const DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT: DbxButtonDisplayContent = {
  icon: 'filter_list'
};

@Component({
  selector: 'dbx-filter-popover-button',
  template: `
    <ng-container [ngSwitch]="buttonDisplayType">
      <button *ngSwitchCase="'text_button'" #button mat-button (click)="showFilterPopover()" class="dbx-preset-filter-menu-button" aria-label="open filter">
        <mat-icon class="dbx-icon-spacer" *ngIf="buttonDisplay.icon">{{ buttonDisplay.icon }}</mat-icon>
        <span>{{ buttonDisplay.text }}</span>
      </button>
      <button *ngSwitchCase="'icon_button'" #button mat-icon-button (click)="showFilterPopover()" aria-label="open filter" matTooltip="Filter" matTooltipPosition="above">
        <mat-icon>{{ buttonDisplay.icon }}</mat-icon>
      </button>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFilterPopoverButtonComponent<F extends object = object> extends AbstractFilterPopoverButtonDirective<F> {
  private _buttonDisplay: DbxButtonDisplayContent = DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT;
  private _buttonDisplayType: DbxButtonDisplayContentType = 'icon_button';

  @Input()
  get buttonDisplay(): DbxButtonDisplayContent {
    return this._buttonDisplay;
  }

  set buttonDisplay(buttonDisplay: Maybe<DbxButtonDisplayContent>) {
    if (!buttonDisplay) {
      buttonDisplay = DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT;
    }

    this._buttonDisplay = buttonDisplay;
    this._buttonDisplayType = dbxButtonDisplayContentType(buttonDisplay);
  }

  get buttonDisplayType() {
    return this._buttonDisplayType;
  }

  @ViewChild('button', { read: ElementRef, static: false })
  buttonElement!: ElementRef;

  showFilterPopover(): void {
    const origin = this.buttonElement.nativeElement;
    this.showFilterPopoverAtOrigin(origin);
  }
}
