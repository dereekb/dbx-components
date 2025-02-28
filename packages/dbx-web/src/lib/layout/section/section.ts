import { type Maybe } from '@dereekb/util';

export type DbxSectionHeaderHType = 1 | 2 | 3 | 4 | 5;

export interface DbxSectionHeaderConfig {
  h?: Maybe<DbxSectionHeaderHType>;
  header?: Maybe<string>;
  onlyHeader?: Maybe<boolean>;
  icon?: Maybe<string>;
  hint?: Maybe<string>;
  hintInline?: Maybe<boolean>;
}
