/**
 * Type-level tests for the working wrapper.
 *
 * These tests verify that the wrapper interface, WrapperTypeDefinition, and
 * factory function types are correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import type { WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_WORKING_WRAPPER_TYPE, DBX_FORGE_WORKING_WRAPPER_TYPE_NAME, type DbxForgeWorkingWrapper, forgeWorkingFieldWrapper } from './working.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeWorkingWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_WORKING_WRAPPER_TYPE_NAME>();

// -- WrapperTypeDefinition --
expectTypeOf(DBX_FORGE_WORKING_WRAPPER_TYPE).toExtend<WrapperTypeDefinition<DbxForgeWorkingWrapper>>();

// -- Factory function returns WrapperField --
expectTypeOf(forgeWorkingFieldWrapper).returns.toExtend<WrapperField>();
