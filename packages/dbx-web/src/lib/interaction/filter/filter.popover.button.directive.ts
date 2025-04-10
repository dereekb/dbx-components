import { Directive, ElementRef, input, inject } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxPopoverService } from '../popover/popover.service';
import { DbxFilterPopoverComponent } from './filter.popover.component';
import { AbstractPopoverRefDirective } from '../popover/abstract.popover.ref.directive';
import { FilterSource, PresetFilterSource } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { DbxFilterComponentConfig } from './filter.config';

export type DbxFilterButtonConfig<F extends object> = DbxFilterComponentConfig<F>;
export type DbxFilterButtonConfigWithCustomFilter<F extends object, CF extends FilterSource<F> = FilterSource<F>> = Omit<DbxFilterComponentConfig<F, any, CF, any>, 'presetFilter' | 'presetFilterComponentConfig'>;
export type DbxFilterButtonConfigWithPresetFilter<F extends object, PF extends PresetFilterSource<F, any> = PresetFilterSource<F, any>> = Omit<DbxFilterComponentConfig<F, any, any, PF>, 'customFilter' | 'customFilterComponentConfig'>;

@Directive()
export abstract class AbstractFilterPopoverButtonDirective<F extends object> extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly popupService = inject(DbxPopoverService);
  readonly config = input<Maybe<DbxFilterComponentConfig<F, any, any, any>>>(undefined);

  protected override _makePopoverRef(origin?: ElementRef): NgPopoverRef<unknown, unknown> {
    const config = this.config();

    if (!config) {
      throw new Error('AbstractFilterPopoverButtonDirective(): Missing config.');
    } else if (!origin) {
      throw new Error('AbstractFilterPopoverButtonDirective(): Missing origin.');
    }

    return DbxFilterPopoverComponent.openPopover(this.popupService, {
      origin,
      ...config
    });
  }
}
