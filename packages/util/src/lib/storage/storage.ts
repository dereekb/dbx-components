import { type UnixDateTimeNumber } from '../date/date';

export type StoredDataString = string;
export type StoredDataStorageKey = string;

export interface StoredData {
  storedAt: UnixDateTimeNumber | undefined;
  data: StoredDataString;
}

export interface ReadStoredData<T> extends StoredData {
  expired: boolean;
  convertedData: T;
}
