import { describe, expect, it } from 'vitest';
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
