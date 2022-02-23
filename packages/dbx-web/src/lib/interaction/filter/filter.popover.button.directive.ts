import { Directive, ElementRef, Input } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxPopoverService } from '../popover/popover.service';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFilterPopoverComponent, DbxFilterComponentParams } from './filter.popover.component';

export interface DbxFilterButtonConfig<F> extends DbxFilterComponentParams<F> { }

@Directive()
export abstract class AbstractFilterPopoverButtonDirective<F> extends AbstractSubscriptionDirective {

  @Input()
  config?: DbxFilterButtonConfig<F>;

  private _popoverRef?: NgPopoverRef<any, any>;

  constructor(private readonly popupService: DbxPopoverService) {
    super();
  }

  protected showFilterPopoverAtOrigin(origin: ElementRef): void {
    if (!this._popoverRef) {
      this._showFilterPopover(origin);
    }
  }

  private _showFilterPopover(origin: ElementRef): void {
    const config = this.config;

    if (!config) {
      throw new Error('Missing filterButtonConfig.');
    }

    this._popoverRef = DbxFilterPopoverComponent.openPopover(this.popupService, {
      origin,
      ...config
    });

    this.sub = this._popoverRef.afterClosed$.subscribe(() => {
      this._popoverRef = undefined;
    });
  }

}
