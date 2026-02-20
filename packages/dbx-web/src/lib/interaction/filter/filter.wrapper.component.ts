import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AbstractDbxActionHandlerDirective, FilterSourceDirective, provideActionStoreSource } from '@dereekb/dbx-core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxButtonModule } from '../../button/button.module';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { WorkInstance } from '@dereekb/rxjs';

/**
 * Action component used to simplify creating a filter form.
 *
 * Provides a ActionContextStoreSource and configures the action to set the filter on a FilterSourceDirective when triggered.
 */
@Component({
  selector: 'dbx-filter-wrapper',
  templateUrl: './filter.wrapper.component.html',
  providers: [provideActionStoreSource(null)],
  standalone: true,
  imports: [DbxButtonModule, MatButtonModule, MatIconModule, FlexLayoutModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFilterWrapperComponent<F = unknown> extends AbstractDbxActionHandlerDirective<F> {
  readonly filterSourceDirective = inject(FilterSourceDirective<F>);

  readonly showButtons = input(true);
  readonly applyRaised = input(true);
  readonly applyIcon = input('filter_list');
  readonly applyText = input('Filter');

  constructor() {
    super();

    // TODO: Consider throwing an error if dbxAction is provided at the same time as this, since the source would not be used?

    // configure handler function
    this._dbxActionHandlerInstance.setHandlerFunction((filter: F, instance: WorkInstance<F, unknown>) => {
      this.filterSourceDirective.setFilter(filter);
      instance.success(true);
    });
  }

  applyFilter(): void {
    this.source.setIsModified(true); // Force setting modified.
    this.source.trigger();
  }

  resetFilter(): void {
    this.filterSourceDirective.resetFilter();
  }
}
