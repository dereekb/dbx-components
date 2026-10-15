import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective, DbxActionEnforceModifiedDirective, DbxActionAutoTriggerDirective } from '@dereekb/dbx-core';
import { type DocInteractionTestFilter } from './filter';
import { isSameDateDayRange } from '@dereekb/date';
import { type DbxActionFormMapValueFunction, DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { type DocInteractionTestDateFilterFormValue, DocInteractionTestDateFilterFormComponent } from './filter.date.form.component';
import { map, shareReplay } from 'rxjs';
import { type IsModifiedFunction } from '@dereekb/rxjs';
import { DbxFilterWrapperComponent } from '@dereekb/dbx-web';

/**
 * Custom date range filter for the date filter popover. Each change is applied right away.
 */
@Component({
  selector: 'doc-interaction-test-date-filter-custom-filter',
  template: `
    <dbx-filter-wrapper dbxActionEnforceModified dbxActionAutoTrigger useInstantTriggerPreset [showButtons]="false" style="display: block; padding: 12px 24px; overflow: hidden">
      <doc-interaction-test-date-filter-form dbxActionForm [dbxActionFormIsModified]="dateRangeIsModified" [dbxFormSource]="formTemplate$" dbxFormSourceMode="always" [dbxActionFormMapValue]="mapFormToFilterValue"></doc-interaction-test-date-filter-form>
    </dbx-filter-wrapper>
  `,
  providers: [provideFilterSourceDirective(DocInteractionTestDateFilterCustomFilterComponent)],
  imports: [DbxFilterWrapperComponent, DbxActionEnforceModifiedDirective, DbxActionAutoTriggerDirective, DocInteractionTestDateFilterFormComponent, DbxActionFormDirective, DbxFormSourceDirective]
})
export class DocInteractionTestDateFilterCustomFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  readonly formTemplate$ = this.filter$.pipe(
    map((x) => {
      const result: DocInteractionTestDateFilterFormValue = {
        range: x.date
          ? {
              start: x.date,
              end: x.toDate ?? x.date
            }
          : null
      };

      return result;
    }),
    shareReplay(1)
  );

  readonly dateRangeIsModified: IsModifiedFunction<DocInteractionTestDateFilterFormValue> = (x) => {
    return this.formTemplate$.pipe(
      map((template) => {
        return !isSameDateDayRange(template.range, x.range);
      })
    );
  };

  readonly mapFormToFilterValue: DbxActionFormMapValueFunction<DocInteractionTestDateFilterFormValue, DocInteractionTestFilter> = (x) => {
    const result: DocInteractionTestFilter = x.range
      ? {
          date: x.range.start,
          toDate: x.range.end
        }
      : {};

    return { value: result };
  };
}
