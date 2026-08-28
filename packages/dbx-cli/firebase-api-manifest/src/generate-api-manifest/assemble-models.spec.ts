import { describe, expect, it, vi } from 'vitest';
import { extractModelsFromSource } from '@dereekb/dbx-cli/manifest-extract';
import type { AssembleModelsInput } from './assemble-models';
import { assembleModels, collectModelEnums } from './assemble-models';

// A model whose persisted day-level sub-object is carried by `firestoreObjectArray({ firestoreField })`
// (the timesheet-days form) and whose nested field references an enum — exercising both Change C
// (firestoreField nested resolution through the converter registry) and Change A (enum collection
// recursing through nestedFields).
const TIMESHEET_SOURCE = `import { firestoreModelIdentity, snapshotConverterFunctions, firestoreSubObject, firestoreObjectArray, firestoreEnum, firestoreNumber, firestoreString } from '@dereekb/firebase';

/**
 * Timesheet day state.
 */
export enum WorkerTimesheetState {
  /** Active. */
  ACTIVE = 1,
  /** Paused. */
  PAUSED = 2,
  /** Archived. */
  ARCHIVED = 4
}

/**
 * Unreferenced enum — must NOT appear in the collected enum manifest.
 */
export enum UnusedColor {
  RED = 'r',
  BLUE = 'b'
}

export interface TimesheetDay {
  /** @dbxModelVariable state */
  s: WorkerTimesheetState;
  /** @dbxModelVariable hours */
  h: number;
}

export const workerTimesheetDay = firestoreSubObject<TimesheetDay>({
  objectField: { fields: { s: firestoreEnum<WorkerTimesheetState>({ default: WorkerTimesheetState.ACTIVE }), h: firestoreNumber({ default: 0 }) } }
});

/**
 * @dbxModel
 */
export interface WorkerTimesheet {
  /** @dbxModelVariable label */
  l: string;
  /** @dbxModelVariable days */
  d: TimesheetDay[];
}

export const workerTimesheetIdentity = firestoreModelIdentity('workerTimesheet', 'wt');

export const workerTimesheetConverter = snapshotConverterFunctions<WorkerTimesheet>({
  fields: {
    l: firestoreString({ default: '' }),
    d: firestoreObjectArray({ firestoreField: workerTimesheetDay })
  }
});
`;

function buildExtractions(): AssembleModelsInput['extractions'] {
  return [
    {
      sourcePackage: 'demo-firebase',
      sourceFile: 'components/demo-firebase/src/lib/model/timesheet/timesheet.ts',
      extraction: extractModelsFromSource({ name: 'timesheet.ts', text: TIMESHEET_SOURCE })
    }
  ];
}

describe('assembleModels (firestoreField nested resolution)', () => {
  const models = assembleModels({ extractions: buildExtractions() });
  const timesheet = models.find((m) => m.modelType === 'workerTimesheet');

  it('resolves the firestoreObjectArray({ firestoreField: <const> }) field into nested fields via the converter registry', () => {
    const days = timesheet?.fields.find((f) => f.name === 'd');
    expect(days?.nestedIsArray).toBe(true);
    expect(days?.nestedFields?.map((f) => f.name)).toEqual(['s', 'h']);
  });

  it('attaches the enumRef onto the nested sub-object field', () => {
    const days = timesheet?.fields.find((f) => f.name === 'd');
    const state = days?.nestedFields?.find((f) => f.name === 's');
    expect(state?.enumRef).toBe('WorkerTimesheetState');
  });
});

describe('collectModelEnums', () => {
  const extractions = buildExtractions();
  const models = assembleModels({ extractions });

  it('collects the value table for an enum referenced through a nested field', () => {
    const enums = collectModelEnums({ extractions, models });
    expect(Object.keys(enums)).toEqual(['WorkerTimesheetState']);
    expect(enums['WorkerTimesheetState']).toEqual({
      name: 'WorkerTimesheetState',
      description: 'Timesheet day state.',
      values: [
        { name: 'ACTIVE', value: 1, description: 'Active.' },
        { name: 'PAUSED', value: 2, description: 'Paused.' },
        { name: 'ARCHIVED', value: 4, description: 'Archived.' }
      ]
    });
  });

  it('excludes enums no emitted field references', () => {
    const enums = collectModelEnums({ extractions, models });
    expect(enums).not.toHaveProperty('UnusedColor');
  });

  it('returns an empty manifest when the emitted models reference no enums', () => {
    const enums = collectModelEnums({ extractions, models: [] });
    expect(enums).toEqual({});
  });
});

// The hellosubs billing shape that broke the manifest twice over, reduced to three files:
//   • `billing.enums.ts` declares the enums,
//   • `billing.ids.ts` declares the singleton document-id const,
//   • `billing.ts` declares the identities, interfaces, converters, and the
//     `singleItemFirestoreCollection` factories that reference both.
// Nothing here resolves inside a single file, which is exactly the point: the converter's `enumRef`
// and the singleton's document id both live one file over from the declaration that needs them.
const BILLING_ENUMS_SOURCE = `/**
 * Invoice payment terms.
 */
export enum BillingGroupInvoiceTerms {
  /** Due on receipt. */
  NET_0 = 0,
  /** Due in 15 days. */
  NET_15 = 1,
  /** Due in 30 days. */
  NET_30 = 3
}
`;

const BILLING_IDS_SOURCE = `export const BILLING_GROUP_SUMMARY_BILLING_SINGLE_IDENTIFIER = 'bgbs';
`;

const BILLING_SOURCE = `import { firestoreModelIdentity, snapshotConverterFunctions, optionalFirestoreEnum, firestoreNumber, firestoreString } from '@dereekb/firebase';
import { BillingGroupInvoiceTerms } from './billing.enums';
import { BILLING_GROUP_SUMMARY_BILLING_SINGLE_IDENTIFIER } from './billing.ids';

export const billingGroupIdentity = firestoreModelIdentity('billingGroup', 'bg');

/**
 * A group of things being billed together.
 *
 * @dbxModel
 */
export interface BillingGroup {
  /** @dbxModelVariable name */
  n: string;
}

export const billingGroupConverter = snapshotConverterFunctions<BillingGroup>({
  fields: { n: firestoreString({ default: '' }) }
});

export const billingGroupInvoiceSummaryIdentity = firestoreModelIdentity(billingGroupIdentity, 'billingGroupInvoiceSummary', 'bgis');

/**
 * Invoice summary for a BillingGroup.
 *
 * @dbxModel
 */
export interface BillingGroupInvoiceSummary {
  /** @dbxModelVariable invoiceTerms */
  it: Maybe<BillingGroupInvoiceTerms>;
}

export const billingGroupInvoiceSummaryConverter = snapshotConverterFunctions<BillingGroupInvoiceSummary>({
  fields: { it: optionalFirestoreEnum<BillingGroupInvoiceTerms>() }
});

export function billingGroupInvoiceSummaryFirestoreCollectionFactory(firestoreContext: FirestoreContext) {
  const factory = billingGroupInvoiceSummaryCollectionReferenceFactory(firestoreContext);

  return (parent: BillingGroupDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      modelIdentity: billingGroupInvoiceSummaryIdentity,
      converter: billingGroupInvoiceSummaryConverter,
      singleItemIdentifier: BILLING_GROUP_SUMMARY_BILLING_SINGLE_IDENTIFIER,
      collection: factory(parent),
      firestoreContext,
      parent
    });
  };
}

export const billingItemSummaryIdentity = firestoreModelIdentity(billingGroupIdentity, 'billingItemSummary', 'bgbis');

/**
 * Item summary for a BillingGroup.
 *
 * @dbxModel
 */
export interface BillingItemSummary {
  /** @dbxModelVariable total */
  t: number;
}

export const billingItemSummaryConverter = snapshotConverterFunctions<BillingItemSummary>({
  fields: { t: firestoreNumber({ default: 0 }) }
});

export function billingItemSummaryFirestoreCollectionFactory(firestoreContext: FirestoreContext) {
  const factory = billingItemSummaryCollectionReferenceFactory(firestoreContext);

  return (parent: BillingGroupDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      modelIdentity: billingItemSummaryIdentity,
      converter: billingItemSummaryConverter,
      collection: factory(parent),
      firestoreContext,
      parent
    });
  };
}
`;

function buildBillingExtractions(): AssembleModelsInput['extractions'] {
  return [
    { sourcePackage: 'billing-firebase', sourceFile: 'components/billing-firebase/src/lib/model/billing/billing.ts', extraction: extractModelsFromSource({ name: 'billing.ts', text: BILLING_SOURCE }) },
    { sourcePackage: 'billing-firebase', sourceFile: 'components/billing-firebase/src/lib/model/billing/billing.enums.ts', extraction: extractModelsFromSource({ name: 'billing.enums.ts', text: BILLING_ENUMS_SOURCE }) },
    { sourcePackage: 'billing-firebase', sourceFile: 'components/billing-firebase/src/lib/model/billing/billing.ids.ts', extraction: extractModelsFromSource({ name: 'billing.ids.ts', text: BILLING_IDS_SOURCE }) }
  ];
}

describe('assembleModels (cross-file enum refs)', () => {
  const extractions = buildBillingExtractions();
  const models = assembleModels({ extractions });

  it('resolves an enumRef against an enum declared in a sibling file', () => {
    const summary = models.find((m) => m.modelType === 'billingGroupInvoiceSummary');
    const terms = summary?.fields.find((f) => f.name === 'it');
    expect(terms?.enumRef).toBe('BillingGroupInvoiceTerms');
  });

  it('carries the sibling-file enum through to the collected enum manifest', () => {
    const enums = collectModelEnums({ extractions, models });
    expect(enums['BillingGroupInvoiceTerms']).toEqual({
      name: 'BillingGroupInvoiceTerms',
      description: 'Invoice payment terms.',
      values: [
        { name: 'NET_0', value: 0, description: 'Due on receipt.' },
        { name: 'NET_15', value: 1, description: 'Due in 15 days.' },
        { name: 'NET_30', value: 3, description: 'Due in 30 days.' }
      ]
    });
  });
});

describe('assembleModels (single-item document ids)', () => {
  const models = assembleModels({ extractions: buildBillingExtractions() });
  const invoiceSummary = models.find((m) => m.modelType === 'billingGroupInvoiceSummary');
  const itemSummary = models.find((m) => m.modelType === 'billingItemSummary');
  const billingGroup = models.find((m) => m.modelType === 'billingGroup');

  it('publishes an overridden document id resolved from a const declared in another file', () => {
    expect(invoiceSummary?.singleton).toBe(true);
    expect(invoiceSummary?.singleItemIdentifier).toBe('bgbs');
  });

  it('publishes the default document id when the collection factory omits singleItemIdentifier', () => {
    expect(itemSummary?.singleton).toBe(true);
    expect(itemSummary?.singleItemIdentifier).toBe('0');
  });

  it('leaves an ordinary multi-document collection unmarked', () => {
    expect(billingGroup?.singleton).toBeUndefined();
    expect(billingGroup?.singleItemIdentifier).toBeUndefined();
  });

  it('builds an example key that resolves the parent chain and the fixed document id', () => {
    expect(invoiceSummary?.exampleKey).toBe('bg/<billingGroupId>/bgis/bgbs');
    expect(itemSummary?.exampleKey).toBe('bg/<billingGroupId>/bgbis/0');
  });

  it('builds an example key with an id placeholder for a root multi-document model', () => {
    expect(billingGroup?.exampleKey).toBe('bg/<billingGroupId>');
  });
});

describe('assembleModels (unresolvable single-item document id)', () => {
  const UNRESOLVABLE_SOURCE = `import { firestoreModelIdentity, snapshotConverterFunctions, firestoreString } from '@dereekb/firebase';

export const billingPermissionTableIdentity = firestoreModelIdentity('billingPermissionTable', 'bgbp');

/**
 * @dbxModel
 */
export interface BillingPermissionTable {
  /** @dbxModelVariable label */
  l: string;
}

export const billingPermissionTableConverter = snapshotConverterFunctions<BillingPermissionTable>({
  fields: { l: firestoreString({ default: '' }) }
});

export function billingPermissionTableFirestoreCollectionFactory(firestoreContext: FirestoreContext) {
  return firestoreContext.rootSingleItemFirestoreCollection({
    modelIdentity: billingPermissionTableIdentity,
    converter: billingPermissionTableConverter,
    singleItemIdentifier: resolveTableIdentifier(),
    firestoreContext
  });
}
`;

  it('marks the model a singleton, omits the id, and warns rather than silently defaulting to "0"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const models = assembleModels({
      extractions: [{ sourcePackage: 'billing-firebase', sourceFile: 'components/billing-firebase/src/lib/model/billing/billing.permission.ts', extraction: extractModelsFromSource({ name: 'billing.permission.ts', text: UNRESOLVABLE_SOURCE }) }]
    });
    const table = models.find((m) => m.modelType === 'billingPermissionTable');

    expect(table?.singleton).toBe(true);
    expect(table?.singleItemIdentifier).toBeUndefined();
    expect(table?.exampleKey).toBe('bgbp/<billingPermissionTableId>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[single-item-id-unresolved]'));
    warn.mockRestore();
  });
});
