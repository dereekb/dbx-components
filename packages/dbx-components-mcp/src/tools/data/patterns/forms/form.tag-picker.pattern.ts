import type { ExamplePattern } from '../form-patterns.js';

export const FORM_PATTERN_TAG_PICKER: ExamplePattern = {
  slug: 'tag-picker',
  name: 'Tag picker',
  summary: 'Multi-select searchable chips over a string tag list.',
  usesFormSlugs: ['searchable-string-chip', 'searchable-chip', 'pickable-chip'],
  snippets: {
    minimal: `dbxForgeSearchableStringChipField({
  key: 'tags',
  props: { search: (text) => searchTags(text), displayForValue: (values) => of(values.map(valueAsDisplay)) }
})`,
    brief: `const tagField = dbxForgeSearchableStringChipField({
  key: 'tags',
  label: 'Tags',
  hint: 'Type to search or add a new tag',
  props: {
    search: (text) => searchTags(text),
    displayForValue: (values) => of(values.map(valueAsDisplay))
  }
});`,
    full: `import { dbxForgeSearchableStringChipField } from '@dereekb/dbx-form';
import { of } from 'rxjs';

const searchTags = (text: string) => inject(TagService).search(text);
const valueAsDisplay = (v: string) => ({ value: v, label: v });

export const articleFormConfig: FormConfig<ArticleValue> = {
  fields: [
    dbxForgeTextField({ key: 'title', required: true }),
    dbxForgeSearchableStringChipField({
      key: 'tags',
      label: 'Tags',
      hint: 'Type to search or add a new tag',
      props: {
        search: searchTags,
        displayForValue: (values) => of(values.map(valueAsDisplay)),
        allowStringValues: true
      }
    })
  ]
};

export interface ArticleValue {
  readonly title: string;
  readonly tags?: string[];
}`
  },
  notes: 'Switch to `dbxForgeSearchableChipField<T>()` when your tags are objects rather than strings. Use `dbxForgePickableChipField<T>()` for a static (non-searched) option set.'
};
