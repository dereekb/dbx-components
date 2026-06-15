import { provideZonelessChangeDetection } from '@angular/core';
import { DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { provideDbxForgeFormFieldDeclarations } from '../lib/forge/forge.providers';
import { provideDbxFormConfiguration } from '../lib/form.providers';

/**
 * Test providers for forge-based form specs.
 *
 * Drop-in replacement for the former formly `FORM_TEST_PROVIDERS`: wires the forge field
 * declarations, the core dbx-form configuration, and a no-op dynamic-form logger under zoneless
 * change detection.
 */
export const FORM_TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];
