import { Directive, type ElementRef, input, inject } from '@angular/core';
import { type NgPopoverRef } from 'ng-overlay-container';
import { DbxPopoverService } from '../popover/popover.service';
import { DbxFilterPopoverComponent } from './filter.popover.component';
import { AbstractPopoverRefDirective } from '../popover/abstract.popover.ref.directive';
import { type FilterSource, type PresetFilterSource } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type DbxFilterComponentConfig } from './filter.config';

/**
 * Alias for {@link DbxFilterComponentConfig} used with filter button components.
 */
export type DbxFilterButtonConfig<F extends object> = DbxFilterComponentConfig<F>;

/**
 * Filter button config that only uses a custom filter component (no preset filter).
 */
export type DbxFilterButtonConfigWithCustomFilter<F extends object, CF extends FilterSource<F> = FilterSource<F>> = Omit<DbxFilterComponentConfig<F, any, CF, any>, 'presetFilter' | 'presetFilterComponentConfig'>;

/**
 * Filter button config that only uses a preset filter component (no custom filter).
 */
export type DbxFilterButtonConfigWithPresetFilter<F extends object, PF extends PresetFilterSource<F, any> = PresetFilterSource<F, any>> = Omit<DbxFilterComponentConfig<F, any, any, PF>, 'customFilter' | 'customFilterComponentConfig'>;

/**
 * Abstract base directive for buttons that open a filter popover. Subclasses provide the origin element.
 */
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
