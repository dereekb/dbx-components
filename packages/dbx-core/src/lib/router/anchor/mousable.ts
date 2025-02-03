import { type Maybe } from '@dereekb/util';

export type MouseEventType = 'enter' | 'leave';

export interface MouseEventPair<T> {
  readonly type: MouseEventType;
  readonly data: T;
}

export interface MousableFunction {
  onMouse?: (type: MouseEventType, event?: Maybe<MouseEvent>) => void;
}
