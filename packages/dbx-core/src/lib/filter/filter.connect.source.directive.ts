import { Directive, type OnInit, inject } from '@angular/core';
import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';

/**
 * Connects the host element's {@link FilterSource} to an ancestor {@link FilterSourceConnector} on init. Place on an element whose own directive contributes a `FilterSource` (via `host: true`) so it auto-wires to the parent connector.
 *
 * @dbxFilter
 * @dbxFilterSlug connect-source
 * @dbxFilterRelated source, source-connector
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
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
