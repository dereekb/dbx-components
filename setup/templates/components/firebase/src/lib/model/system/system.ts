import { firestoreSubObject, firestoreDate, snapshotConverterFunctions, SystemStateStoredData, SystemStateStoredDataFieldConverterConfig, SystemStateStoredDataConverterMap } from '@dereekb/firebase';

export const EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE = 'example';

export interface ExampleSystemData extends SystemStateStoredData {
  lastUpdate: Date;
}

export const exampleSystemDataConverter: SystemStateStoredDataFieldConverterConfig<ExampleSystemData> = firestoreSubObject<ExampleSystemData>({
  objectField: {
    fields: {
      lastUpdate: firestoreDate({ saveDefaultAsNow: true })
    }
  }
});

export const APP_CODE_PREFIX_CAMELSystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = {
  [EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE]: exampleSystemDataConverter
};
