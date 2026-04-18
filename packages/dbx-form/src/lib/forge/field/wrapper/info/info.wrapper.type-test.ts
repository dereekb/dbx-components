/**
 * Type-level tests for the info wrapper.
 *
 * These tests verify that the wrapper interface type is correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import { DBX_FORGE_INFO_WRAPPER_TYPE_NAME, type DbxForgeInfoWrapper } from './info.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeInfoWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_INFO_WRAPPER_TYPE_NAME>();
