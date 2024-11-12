import { Directive, ElementRef, Input, inject } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxPopoverService } from '../popover/popover.service';
import { DbxFilterPopoverComponent, DbxFilterComponentParams } from './filter.popover.component';
import { AbstractPopoverRefDirective } from '../popover/abstract.popover.ref.directive';
import { FilterSource, PresetFilterSource } from '@dereekb/rxjs';

export type DbxFilterButtonConfig<F extends object> = DbxFilterComponentParams<F>;
export type DbxFilterButtonConfigWithCustomFilter<F extends object, CF extends FilterSource<F> = FilterSource<F>> = Omit<DbxFilterComponentParams<F, any, CF, any>, 'presetFilter' | 'presetFilterComponentConfig'>;
export type DbxFilterButtonConfigWithPresetFilter<F extends object, PF extends PresetFilterSource<F, any> = PresetFilterSource<F, any>> = Omit<DbxFilterComponentParams<F, any, any, PF>, 'customFilter' | 'customFilterComponentConfig'>;

@Directive()
export abstract class AbstractFilterPopoverButtonDirective<F extends object> extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly popupService = inject(DbxPopoverService);

  @Input()
  config?: DbxFilterComponentParams<F, any, any, any>;

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
