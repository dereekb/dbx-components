import { SCHEDULER_SYSTEM_STATE_TYPE, firestoreSubObject, firestoreDate, schedulerSystemDataConverter, type SystemStateStoredData, type SystemStateStoredDataFieldConverterConfig, type SystemStateStoredDataConverterMap } from '@dereekb/firebase';

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

export const demoSystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = {
  [EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE]: exampleSystemDataConverter,
  // Framework-declared. Registering it is what makes `lat` read back as a Date instead of a raw
  // Timestamp, which the scheduler gate in @dereekb/firebase-server/model requires.
  [SCHEDULER_SYSTEM_STATE_TYPE]: schedulerSystemDataConverter
};
