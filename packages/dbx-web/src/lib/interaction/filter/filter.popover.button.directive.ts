import { Directive, ElementRef, Input } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxPopoverService } from '../popover/popover.service';
import { DbxFilterPopoverComponent, DbxFilterComponentParams } from './filter.popover.component';
import { AbstractPopoverRefDirective } from '../popover/abstract.popover.ref.directive';

export type DbxFilterButtonConfig<F extends object> = DbxFilterComponentParams<F>;

@Directive()
export abstract class AbstractFilterPopoverButtonDirective<F extends object> extends AbstractPopoverRefDirective<unknown, unknown> {
  @Input()
  config?: DbxFilterButtonConfig<F>;

  constructor(private readonly popupService: DbxPopoverService) {
    super();
  }

  protected override _makePopoverRef(origin?: ElementRef): NgPopoverRef<unknown, unknown> {
    const config = this.config;

    if (!config) {
      throw new Error('Missing filterButtonConfig.');
    } else if (!origin) {
      throw new Error('Missing origin.');
    }

    return DbxFilterPopoverComponent.openPopover(this.popupService, {
      origin,
      ...config
    });
  }
}
