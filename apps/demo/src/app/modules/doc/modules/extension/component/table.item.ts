import { ModelKeyRef } from '@dereekb/util';

export interface ExampleTableData extends ModelKeyRef {
  readonly name: string;
}

export interface ExampleTableGroupData {
  readonly groupName: string;
}
