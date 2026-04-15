/**
 * Type-level tests for the style wrapper.
 *
 * These tests verify that the wrapper interface, WrapperTypeDefinition, and
 * factory function types are correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import type { WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_STYLE_WRAPPER_TYPE, DBX_FORGE_STYLE_WRAPPER_TYPE_NAME, type DbxForgeStyleWrapper, forgeStyleWrapper } from './style.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeStyleWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_STYLE_WRAPPER_TYPE_NAME>();

// -- WrapperTypeDefinition --
expectTypeOf(DBX_FORGE_STYLE_WRAPPER_TYPE).toExtend<WrapperTypeDefinition<DbxForgeStyleWrapper>>();

// -- Factory function returns WrapperField --
expectTypeOf(forgeStyleWrapper).returns.toExtend<WrapperField>();
