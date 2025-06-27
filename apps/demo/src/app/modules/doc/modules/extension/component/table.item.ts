import { ModelKeyRef } from '@dereekb/util';

export interface ExampleTableData extends ModelKeyRef {
  readonly name: string;
  readonly columnValues: number[];
}

export interface ExampleTableGroupData {
  readonly groupName: string;
}
