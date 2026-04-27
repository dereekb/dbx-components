import type { ExamplePattern } from '../form-patterns.js';

export const FORM_PATTERN_ADDRESS_FORM: ExamplePattern = {
  slug: 'address-form',
  name: 'Address form',
  summary: 'Full US-style address (line 1, optional line 2, city, state, zip, optional country) as a nested group.',
  usesFormSlugs: ['address-group', 'address-fields', 'address-line', 'city', 'state', 'zip-code', 'country'],
  snippets: {
    minimal: `dbxForgeAddressGroup({ key: 'address' })`,
    brief: `// Nested under \`address\` in the form value
const addressField = dbxForgeAddressGroup({ key: 'billingAddress' });`,
    full: `import { dbxForgeAddressGroup } from '@dereekb/dbx-form';

export const checkoutFormConfig: FormConfig<CheckoutValue> = {
  fields: [
    dbxForgeAddressGroup({ key: 'shipping' }),
    dbxForgeAddressGroup({ key: 'billing' })
  ]
};

export interface CheckoutValue {
  readonly shipping: AddressValue;
  readonly billing: AddressValue;
}`
  },
  notes: 'Use `dbxForgeAddressFields({})` (plural) to get the bare FieldDef[] for inlining into an existing parent instead of a nested group. Use `dbxForgeAddressListField()` for a repeatable list of addresses.'
};
