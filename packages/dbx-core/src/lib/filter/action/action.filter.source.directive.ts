import { HandleActionFunction } from '../../action/action.handler';
import { AbstractFilterSourceDirective } from '../filter.abstract.source.directive';
import { DbxActionContextDirective } from '../../action/directive/context/action.directive';
import { Directive, ViewChild } from '@angular/core';
import { of } from 'rxjs';

/**
 * Abstract filter source for components that use an action to filter.
 */
@Directive()
export abstract class AbstractActionFilterSourceDirective<F> extends AbstractFilterSourceDirective<F> {

  @ViewChild('filterAction', { static: true, read: DbxActionContextDirective })
  readonly filterAction!: DbxActionContextDirective;

  applyFilter(): void {
    this.filterAction.sourceInstance.setIsModified(true); // Force setting modified.
    this.filterAction.trigger();
  }

  /**
   * Pre-set action handler for the template to use to set the filter.
   */
  setFilterAction: HandleActionFunction<F> = (filter: F) => {
    this.setFilter(filter);
    return of(true);
  }

}
