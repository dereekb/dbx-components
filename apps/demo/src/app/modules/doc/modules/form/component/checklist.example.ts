import { type Configurable, type KeyValueTransformMap } from '@dereekb/util';
import { type ChecklistItemDisplayContent, ChecklistItemFieldDataSetBuilder, type ChecklistType, type ChecklistItemFieldBuilderInput, flexLayoutWrapper } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type Observable } from 'rxjs';

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

/**
 * Builds checklist formly fields from a data observable and optional custom display configuration.
 *
 * @param config - The checklist fields configuration
 * @param config.dataObs - Observable of the checklist data
 * @param config.display - Optional custom display configuration per field
 * @returns The built formly field configs
 *
 * @example
 * ```ts
 * const fields = docFormExampleChecklistFields({ dataObs: myData$, display: myDisplay });
 * ```
 */
export function docFormExampleChecklistFields({ dataObs, display }: DocFormExampleChecklistFieldsConfig): FormlyFieldConfig[] {
  const b: DocFormExampleChecklistItemFieldDataSetBuilder = new ChecklistItemFieldDataSetBuilder(dataObs);

  b.showValueField(
    'itemA',
    {
      label: 'itemA Label'
    },
    (x: string) => x
  );

  b.showValueField(
    'itemB',
    {
      label: 'itemB Label'
    },
    (x: string) => x
  );

  b.showValueField(
    'itemC',
    {
      label: 'itemC Label'
    },
    (x: string) => x
  );

  b.showValueFieldArrayCount('itemArray', {
    label: 'itemArray Label'
  });

  if (display) {
    (Object.keys(display) as (keyof DocFormExampleChecklistValues)[]).forEach((key) => {
      const config: DocFormExampleChecklistFieldsCustomDisplayFieldConfig = display[key];
      const contentToMerge: Partial<Configurable<ChecklistItemFieldBuilderInput>> = {};

      if (config.displayWithData) {
        contentToMerge.displayContent = config.displayWithData(b);
      }

      b.merge(key, contentToMerge);
    });
  }

  return b.build();
}

/**
 * Wraps checklist fields in a flex layout section field group.
 *
 * @param options - The section options
 * @param options.key - Optional formly key for the section
 * @param options.config - The checklist fields configuration
 * @returns A formly field config wrapping the checklist fields
 *
 * @example
 * ```ts
 * const section = docFormExampleChecklistFieldsSection({ config: myConfig });
 * ```
 */
export function docFormExampleChecklistFieldsSection({ key = undefined, config }: { key?: string; config: DocFormExampleChecklistFieldsConfig }): FormlyFieldConfig {
  const fields = docFormExampleChecklistFields(config).map((field) => ({ field }));

  return {
    key,
    fieldGroup: [
      flexLayoutWrapper(fields, {
        // example also makes use of flexLayoutWrapper to wrap items around.
        breakpoint: 'full',
        size: 3
      })
    ]
  };
}
