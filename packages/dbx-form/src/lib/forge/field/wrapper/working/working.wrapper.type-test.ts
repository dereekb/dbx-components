/**
 * Type-level tests for the working wrapper.
 *
 * These tests verify that the wrapper interface and WrapperTypeDefinition
 * types are correct at compile time.
 */
import { expectTypeOf } from 'vitest';
import { type DBX_FORGE_WORKING_WRAPPER_TYPE_NAME, type DbxForgeWorkingWrapper } from './working.wrapper';

// -- Wrapper interface --
expectTypeOf<DbxForgeWorkingWrapper['type']>().toEqualTypeOf<typeof DBX_FORGE_WORKING_WRAPPER_TYPE_NAME>();
