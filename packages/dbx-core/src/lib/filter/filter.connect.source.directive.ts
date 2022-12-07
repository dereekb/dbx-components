import { Directive, Host, OnInit } from '@angular/core';
import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';

/**
 * Connects the host FilterSource to a FilterSourceConnector.
 */
@Directive({
  selector: '[dbxFilterConnectSource]'
})
export class DbxFilterConnectSourceDirective<F = unknown> implements OnInit {
  constructor(@Host() readonly filterSource: FilterSource<F>, readonly filterSourceConnector: FilterSourceConnector<F>) {}

  ngOnInit(): void {
    this.filterSourceConnector.connectWithSource(this.filterSource);
  }
}
