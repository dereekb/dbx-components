import { ChecklistItemDisplayContent, ChecklistItemFieldDataSetBuilder, ChecklistType, ChecklistItemFieldBuilderInput, flexLayoutWrapper } from "@dereekb/dbx-form";
import { KeyValueTransformMap, addPlusPrefixToNumber } from "@dereekb/util";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { Observable } from "rxjs";

export interface DocFormExampleChecklistValues {
  itemA: string;
  itemB: string;
  itemC: string;
  itemArray: string[];
}

export type DocFormExampleChecklistDisplayWithDataFn = (builder: DocFormExampleChecklistItemFieldDataSetBuilder) => Observable<ChecklistItemDisplayContent>;

export interface DocFormExampleChecklistFieldsCustomDisplayFieldConfig {
  displayWithData?: DocFormExampleChecklistDisplayWithDataFn;
}

export type DocFormExampleChecklistFieldsCustomDisplayConfig = KeyValueTransformMap<DocFormExampleChecklistValues, DocFormExampleChecklistFieldsCustomDisplayFieldConfig>;
export type DocFormExampleChecklistItemFieldDataSetBuilder = ChecklistItemFieldDataSetBuilder<DocFormExampleChecklistValues, ChecklistType<DocFormExampleChecklistValues>>;

export interface DocFormExampleChecklistFieldsConfig {
  dataObs: Observable<DocFormExampleChecklistValues>;
  display?: DocFormExampleChecklistFieldsCustomDisplayConfig;
}

export function docFormExampleChecklistFields({ dataObs, display }: DocFormExampleChecklistFieldsConfig): FormlyFieldConfig[] {
  const b: DocFormExampleChecklistItemFieldDataSetBuilder = new ChecklistItemFieldDataSetBuilder(dataObs);

  b.showValueField('itemA', {
    label: 'itemA Label'
  }, (x: string) => x);

  b.showValueField('itemB', {
    label: 'itemB Label'
  }, (x: string) => x);

  b.showValueField('itemC', {
    label: 'itemC Label'
  }, (x: string) => x);

  b.showValueFieldArrayCount('itemArray', {
    label: 'itemArray Label'
  });

  if (display) {
    (Object.keys(display) as (keyof DocFormExampleChecklistValues)[]).forEach((key) => {
      const config: DocFormExampleChecklistFieldsCustomDisplayFieldConfig = display[key];
      const contentToMerge: Partial<ChecklistItemFieldBuilderInput> = {};

      if (config.displayWithData) {
        contentToMerge.displayContentObs = config.displayWithData(b);
      }

      b.merge(key, contentToMerge);
    });
  }

  return b.build();
}

export function docFormExampleChecklistFieldsSection({ key = undefined, config }: { key?: string, config: DocFormExampleChecklistFieldsConfig }): FormlyFieldConfig {
  const fields = docFormExampleChecklistFields(config).map(field => ({ field }));

  return {
    key,
    fieldGroup: [flexLayoutWrapper(fields)]
  };
}
