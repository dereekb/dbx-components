/**
 * Type-level tests for the info wrapper.
 *
 * These tests verify that the wrapper interface, WrapperTypeDefinition, and
 * factory function types are correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import type { WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_INFO_WRAPPER_TYPE, DBX_FORGE_INFO_WRAPPER_TYPE_NAME, type DbxForgeInfoWrapper, forgeInfoFieldWrapper } from './info.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeInfoWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_INFO_WRAPPER_TYPE_NAME>();

// -- WrapperTypeDefinition --
expectTypeOf(DBX_FORGE_INFO_WRAPPER_TYPE).toExtend<WrapperTypeDefinition<DbxForgeInfoWrapper>>();

// -- Factory function returns WrapperField --
expectTypeOf(forgeInfoFieldWrapper).returns.toExtend<WrapperField>();
