/**
 * Type-level tests for the section wrapper.
 *
 * These tests verify that the wrapper interface type is correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import { type DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, type DbxForgeSectionWrapper } from './section.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeSectionWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_SECTION_WRAPPER_TYPE_NAME>();
