import { Directive, Injectable, Injector, Optional, Provider, SkipSelf } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';

/**
 * Token used by provideCalendarScheduleSelectionStoreIfDoesNotExist() to prevent injecting a parent DbxCalendarScheduleSelectionStore into the child view.
 */
@Injectable()
export class DbxCalendarScheduleSelectionStoreProviderBlock {
  constructor(@SkipSelf() readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}
}

@Directive({
  selector: '[dbxCalendarScheduleSelectionStoreParentBlocker]',
  providers: [DbxCalendarScheduleSelectionStoreProviderBlock]
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
    useFactory: (parentInjector: Injector, dbxCalendarScheduleSelectionStoreInjectionBlock?: DbxCalendarScheduleSelectionStoreProviderBlock, dbxCalendarScheduleSelectionStore?: DbxCalendarScheduleSelectionStore) => {
      if (!dbxCalendarScheduleSelectionStore || (dbxCalendarScheduleSelectionStore && dbxCalendarScheduleSelectionStoreInjectionBlock != null && dbxCalendarScheduleSelectionStoreInjectionBlock.dbxCalendarScheduleSelectionStore === dbxCalendarScheduleSelectionStore)) {
        // create a new dbxCalendarScheduleSelectionStore to use
        const injector = Injector.create({ providers: [{ provide: DbxCalendarScheduleSelectionStore }], parent: parentInjector });
        dbxCalendarScheduleSelectionStore = injector.get(DbxCalendarScheduleSelectionStore);
      }

      return dbxCalendarScheduleSelectionStore;
    },
    deps: [Injector, [new Optional(), DbxCalendarScheduleSelectionStoreProviderBlock], [new Optional(), new SkipSelf(), DbxCalendarScheduleSelectionStore]]
  };
}
