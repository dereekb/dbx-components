import { Component } from '@angular/core';
import { ClickableFilterPreset, AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter, DOC_INTERACTION_DATE_TEST_PRESETS } from './filter';
import { isSameDateDayRange } from '@dereekb/date';
import { DbxActionFormMapValueFunction } from '@dereekb/dbx-form';
import { DocInteractionTestDateFilterFormValue } from './filter.date.form.component';
import { map, shareReplay } from 'rxjs';
import { IsModifiedFunction } from '@dereekb/rxjs';

@Component({
  selector: 'doc-interaction-test-date-filter-preset-filter',
  template: `
    <dbx-filter-wrapper dbxAction dbxActionEnforceModified dbxActionAutoTrigger instantTrigger [showButtons]="false" style="display: block; padding: 12px 24px; overflow: hidden">
      <doc-interaction-test-date-filter-form dbxActionForm [dbxActionFormIsModified]="dateRangeIsModified" [dbxFormSource]="formTemplate$" [dbxActionFormMapValue]="mapFormToFilterValue"></doc-interaction-test-date-filter-form>
    </dbx-filter-wrapper>
  `,
  providers: [provideFilterSourceDirective(DocInteractionTestDateFilterPresetFilterComponent)]
})
export class DocInteractionTestDateFilterPresetFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  readonly presets: ClickableFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_DATE_TEST_PRESETS;

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
