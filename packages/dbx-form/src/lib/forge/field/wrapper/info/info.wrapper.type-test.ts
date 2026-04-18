/**
 * Type-level tests for the info wrapper.
 *
 * These tests verify that the wrapper interface and WrapperTypeDefinition
 * types are correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import type { WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_INFO_WRAPPER_TYPE, DBX_FORGE_INFO_WRAPPER_TYPE_NAME, type DbxForgeInfoWrapper } from './info.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeInfoWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_INFO_WRAPPER_TYPE_NAME>();

// -- WrapperTypeDefinition --
expectTypeOf(DBX_FORGE_INFO_WRAPPER_TYPE).toExtend<WrapperTypeDefinition<DbxForgeInfoWrapper>>();
