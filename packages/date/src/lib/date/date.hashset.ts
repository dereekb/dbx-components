import { HashSet } from '@dereekb/util';

export class DateSet extends HashSet<number, Date> {

  constructor(values?: Date[]) {
    super({ readKey: (date) => date.getTime() }, values);
  }

}
