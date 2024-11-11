import { Directive, Host, OnInit, inject } from '@angular/core';
import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';

/**
 * Connects the host FilterSource to a FilterSourceConnector.
 */
@Directive({
  selector: '[dbxFilterConnectSource]'
})
export class DbxFilterConnectSourceDirective<F = unknown> implements OnInit {
  readonly filterSource = inject(FilterSource<F>, { host: true });
  readonly filterSourceConnector = inject(FilterSourceConnector<F>);

  ngOnInit(): void {
    this.filterSourceConnector.connectWithSource(this.filterSource);
  }
}
