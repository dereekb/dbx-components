import { ListLoadingStateContext, switchMapMaybeObs } from '@dereekb/rxjs';
import { BehaviorSubject, Observable, of, shareReplay } from 'rxjs';
import { Directive, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { DbxListSelectionMode, DbxListView } from './list.view';
import { Maybe } from '@dereekb/util';
import { AbstractDbxListViewDirective } from './list.view.directive';

export const DEFAULT_DBX_VALUE_LIST_GRID_DIRECTIVE_TEMPLATE = '<dbx-list-grid-view [config]="config"></dbx-list-grid-view>';

/**
 * Abstract DbxListGridView implementation.
 */
@Directive()
export abstract class AbstractDbxListGridViewDirective<T> extends AbstractDbxListViewDirective<T> {}
