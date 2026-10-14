import { Component, computed, effect, inject, input } from '@angular/core';
import { AbstractDbxActionHandlerDirective, FilterSourceDirective, provideActionStoreSource } from '@dereekb/dbx-core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxButtonModule } from '../../button/button.module';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type WorkInstance } from '@dereekb/rxjs';
import { areEqualPOJOValues, type Maybe } from '@dereekb/util';
import { first } from 'rxjs';
import { DbxFilterPopoverPendingChanges } from './filter.popover.pending';

/**
 * Wraps filter form content with apply/reset buttons, integrating with the action system.
 *
 * Provides an ActionContextStoreSource and applies the filter value to the nearest FilterSourceDirective on trigger.
 *
 * Inside a filter popover, a wrapper whose Apply button is hidden applies its last change before the popover closes (see {@link applyOnClose}),
 * so a change made right before clicking the popover's close button or outside of it is not lost.
 *
 * @example
 * ```html
 * <dbx-filter-wrapper [applyText]="'Apply'" [applyIcon]="'filter_list'">
 *   <my-filter-form dbxActionForm></my-filter-form>
 * </dbx-filter-wrapper>
 * ```
 */
@Component({
  selector: 'dbx-filter-wrapper',
  templateUrl: './filter.wrapper.component.html',
  providers: [provideActionStoreSource(null)],
  imports: [DbxButtonModule, MatButtonModule, MatIconModule, FlexLayoutModule]
})
export class DbxFilterWrapperComponent<F = unknown> extends AbstractDbxActionHandlerDirective<F> {
  readonly filterSourceDirective = inject(FilterSourceDirective<F>);

  readonly showButtons = input(true);
  readonly applyRaised = input(true);
  readonly applyIcon = input('filter_list');
  readonly applyText = input('Filter');

  /**
   * Whether or not to apply a pending change before the filter popover this wrapper is in closes.
   *
   * Defaults to `!showButtons`: a wrapper without its own Apply button applies by itself (such as with dbxActionAutoTrigger),
   * so its last change is kept. With the Apply button shown, closing without clicking it discards the change.
   */
  readonly applyOnClose = input<Maybe<boolean>>();

  readonly applyOnCloseSignal = computed(() => {
    const applyOnClose = this.applyOnClose();
    const showButtons = this.showButtons();
    return applyOnClose ?? !showButtons;
  });

  constructor() {
    super();

    // TODO: Consider throwing an error if dbxAction is provided at the same time as this, since the source would not be used?

    // configure handler function
    this._dbxActionHandlerInstance.setHandlerFunction((filter: F, instance: WorkInstance<F, unknown>) => {
      this.filterSourceDirective.setFilter(filter);
      instance.success(true);
    });

    const pendingChanges = inject(DbxFilterPopoverPendingChanges, { optional: true });

    if (pendingChanges) {
      // inside a filter popover: apply a change the action has not applied yet before the popover closes
      effect((onCleanup) => {
        if (this.applyOnCloseSignal()) {
          onCleanup(pendingChanges.registerApplyPending(() => this.applyPendingFilter()));
        }
      });
    }
  }

  /**
   * Applies a change the action has not applied yet, synchronously.
   *
   * Takes the value a trigger would ready right now from the action's value source (such as dbxActionForm) and sets it on the filter source
   * when it differs from the current filter. It skips the action's trigger path and its delays, so it works right before the content is destroyed.
   */
  applyPendingFilter(): void {
    const value = this.source.valueSnapshot()?.value;

    if (value != null) {
      let currentFilter: Maybe<F>;
      this.filterSourceDirective.filter$
        .pipe(first())
        .subscribe((x) => (currentFilter = x))
        .unsubscribe();

      if (!areEqualPOJOValues<Maybe<F>>(value, currentFilter)) {
        this.filterSourceDirective.setFilter(value);
      }
    }
  }

  applyFilter(): void {
    this.source.setIsModified(true); // Force setting modified.
    this.source.trigger();
  }

  resetFilter(): void {
    this.filterSourceDirective.resetFilter();
  }
}
