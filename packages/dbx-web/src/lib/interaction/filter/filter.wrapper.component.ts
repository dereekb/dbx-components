import { Component, Input, inject } from '@angular/core';
import { AbstractDbxActionHandlerDirective, FilterSourceDirective, provideActionStoreSource } from '@dereekb/dbx-core';
import { of } from 'rxjs';

/**
 * Action component used to simplify creating a filter form.
 *
 * Provides a DbxAction and configures the action to set the filter on a FilterSourceDirective when triggered.
 */
@Component({
  selector: 'dbx-filter-wrapper',
  templateUrl: './filter.wrapper.component.html',
  providers: [provideActionStoreSource(null)]
})
export class DbxFilterWrapperComponent<F = unknown> extends AbstractDbxActionHandlerDirective<F> {
  readonly filterSourceDirective = inject(FilterSourceDirective<F>);

  @Input()
  showButtons = true;

  @Input()
  applyRaised = true;

  @Input()
  applyIcon = 'filter_list';

  @Input()
  applyText = 'Filter';

  constructor() {
    super();

    // configure handler function
    this._dbxActionHandlerInstance.handlerFunction = (filter: F) => {
      this.filterSourceDirective.setFilter(filter);
      return of(true);
    };
  }

  applyFilter(): void {
    this.source.setIsModified(true); // Force setting modified.
    this.source.trigger();
  }

  resetFilter(): void {
    this.filterSourceDirective.resetFilter();
  }
}
