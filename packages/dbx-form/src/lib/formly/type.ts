import { type ConfigOption } from '@ngx-formly/core';
import { type MaybeSo } from '@dereekb/util';

export type ValidationMessageOption = MaybeSo<ConfigOption['validationMessages']>[number];
