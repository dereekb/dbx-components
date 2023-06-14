import { Component } from '@angular/core';
import { ClickableFilterPreset, AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_PRESETS, DOC_INTERACTION_DATE_TEST_PRESETS } from './filter';
import { DateRangeType } from '@dereekb/date';
import { fixedDateRangeField, DbxDateTimeValueMode, DbxActionFormMapValueFunction } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DocInteractionTestDateFilterFormValue } from './filter.date.form.component';
import { map, shareReplay } from 'rxjs';

@Component({
  selector: 'doc-interaction-test-date-filter-preset-filter',
  template: `
    <dbx-filter-wrapper style="display: block; padding: 12px 24px; overflow: hidden" dbxAction dbxActionAutoTrigger instantTrigger [showButtons]="false">
      <doc-interaction-test-date-filter-form dbxActionForm [dbxFormSource]="formTemplate$" [dbxActionFormMapValue]="mapFormToFilterValue"></doc-interaction-test-date-filter-form>
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
