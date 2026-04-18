/**
 * Type-level tests for the style wrapper.
 *
 * These tests verify that the wrapper interface type is correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import { DBX_FORGE_STYLE_WRAPPER_TYPE_NAME, type DbxForgeStyleWrapper } from './style.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeStyleWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_STYLE_WRAPPER_TYPE_NAME>();
