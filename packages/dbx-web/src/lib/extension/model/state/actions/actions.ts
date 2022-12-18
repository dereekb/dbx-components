import { DbxModelModuleStateTypeConfiguration } from './../config';
import { createAction, props } from '@ngrx/store';
import { ArrayOrValue } from '@dereekb/util';

export const dbxModelResetState = createAction('[App/Model] Reset State');

export const dbxModelAddTypeConfiguration = createAction('[App/Model] Add Types Configuration', props<ArrayOrValue<DbxModelModuleStateTypeConfiguration>>());
