import { Directive, type OnInit, inject } from '@angular/core';
import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';

/**
 * Connects the host element's {@link FilterSource} to an ancestor {@link FilterSourceConnector} on initialization.
 *
 * Place on an element that has a `FilterSource` (via `host: true`) to automatically
 * wire it up to a parent `FilterSourceConnector`.
 *
 * @example
 * ```html
 * <div dbxFilterSourceConnector>
 *   <my-filter-form dbxFilterSource dbxFilterConnectSource></my-filter-form>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterConnectSource]',
  standalone: true
})
export class DbxFilterConnectSourceDirective<F = unknown> implements OnInit {
  readonly filterSource = inject(FilterSource<F>, { host: true });
  readonly filterSourceConnector = inject(FilterSourceConnector<F>);

  ngOnInit(): void {
    this.filterSourceConnector.connectWithSource(this.filterSource);
  }
}
