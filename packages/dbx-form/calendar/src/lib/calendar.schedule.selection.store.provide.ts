import { Directive, Injectable, Injector, Optional, type Provider, SkipSelf, inject } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';

/**
 * Token used by provideCalendarScheduleSelectionStoreIfDoesNotExist() to prevent injecting a parent DbxCalendarScheduleSelectionStore into the child view.
 */
@Injectable()
export class DbxCalendarScheduleSelectionStoreProviderBlock {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore, { skipSelf: true });
}

@Directive({
  selector: '[dbxCalendarScheduleSelectionStoreParentBlocker]',
  providers: [DbxCalendarScheduleSelectionStoreProviderBlock],
  standalone: true
})
export class DbxCalendarScheduleSelectionStoreInjectionBlockDirective {}

/**
 * Creates a Provider that initializes a new DbxCalendarScheduleSelectionStore if a parent does not exist.
 *
 * If a DbxCalendarScheduleSelectionStoreInjectionBlock is available in the context, and references the same dbxCalendarScheduleSelectionStore that is attempting to be injected, a new DbxCalendarScheduleSelectionStore is created.
 *
 * @returns
 */
export function provideCalendarScheduleSelectionStoreIfParentIsUnavailable(): Provider {
  return {
    provide: DbxCalendarScheduleSelectionStore,
    useFactory: (dbxCalendarScheduleSelectionStoreInjectionBlock?: DbxCalendarScheduleSelectionStoreProviderBlock, dbxCalendarScheduleSelectionStore?: DbxCalendarScheduleSelectionStore) => {
      if (!dbxCalendarScheduleSelectionStore || (dbxCalendarScheduleSelectionStore && dbxCalendarScheduleSelectionStoreInjectionBlock?.dbxCalendarScheduleSelectionStore === dbxCalendarScheduleSelectionStore)) {
        // create a new dbxCalendarScheduleSelectionStore to use
        const parentInjector = inject(Injector);
        const injector = Injector.create({ providers: [{ provide: DbxCalendarScheduleSelectionStore }], parent: parentInjector });
        dbxCalendarScheduleSelectionStore = injector.get(DbxCalendarScheduleSelectionStore);
      }

      return dbxCalendarScheduleSelectionStore;
    },
    deps: [
      [new Optional(), DbxCalendarScheduleSelectionStoreProviderBlock],
      [new Optional(), new SkipSelf(), DbxCalendarScheduleSelectionStore]
    ]
  };
}
