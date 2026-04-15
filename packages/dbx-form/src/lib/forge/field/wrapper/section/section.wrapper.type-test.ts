/**
 * Type-level tests for the section wrapper.
 *
 * These tests verify that the wrapper interface, WrapperTypeDefinition, and
 * factory function types are correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import type { WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import { DBX_FORGE_SECTION_WRAPPER_TYPE, DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, type DbxForgeSectionWrapper, forgeDbxSectionFieldWrapper, forgeDbxSubsectionFieldWrapper } from './section.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeSectionWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_SECTION_WRAPPER_TYPE_NAME>();

// -- WrapperTypeDefinition --
expectTypeOf(DBX_FORGE_SECTION_WRAPPER_TYPE).toExtend<WrapperTypeDefinition<DbxForgeSectionWrapper>>();

// -- Factory functions return WrapperField --
expectTypeOf(forgeDbxSectionFieldWrapper).returns.toExtend<WrapperField>();
expectTypeOf(forgeDbxSubsectionFieldWrapper).returns.toExtend<WrapperField>();
