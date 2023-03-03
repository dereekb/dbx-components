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
    <dbx-icon-button #button (buttonClick)="showFilterPopover()" [buttonDisplay]="buttonDisplay"></dbx-icon-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFilterPopoverButtonComponent<F extends object = object> extends AbstractFilterPopoverButtonDirective<F> {
  private _buttonDisplay: DbxButtonDisplayContent = DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT;

  @Input()
  get buttonDisplay(): DbxButtonDisplayContent {
    return this._buttonDisplay;
  }

  set buttonDisplay(buttonDisplay: Maybe<DbxButtonDisplayContent>) {
    if (!buttonDisplay) {
      buttonDisplay = DEFAULT_FILTER_POPOVER_BUTTON_DISPLAY_CONTENT;
    }

    this._buttonDisplay = buttonDisplay;
  }

  @ViewChild('button', { read: ElementRef, static: false })
  buttonElement!: ElementRef;

  showFilterPopover(): void {
    const origin = this.buttonElement.nativeElement;
    this.showFilterPopoverAtOrigin(origin);
  }
}
