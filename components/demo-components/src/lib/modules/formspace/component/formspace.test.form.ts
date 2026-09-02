import { dbxForgeTextAreaField, dbxForgeTextField, dbxForgeToggleField } from '@dereekb/dbx-form';

/**
 * Max length of the test FormSpace's title.
 */
export const DEMO_TEST_FORM_SPACE_TITLE_MAX_LENGTH = 100;

/**
 * Max length of the test FormSpace's notes.
 */
export const DEMO_TEST_FORM_SPACE_NOTES_MAX_LENGTH = 1000;

/**
 * Returns every field of the test FormSpace form: title, notes, and the agreement toggle.
 *
 * @returns Array of forge field configurations for the test form space.
 */
export function demoTestFormSpaceFields() {
  return [demoTestFormSpaceTitleField(), demoTestFormSpaceNotesField(), demoTestFormSpaceAgreedField()];
}

/**
 * Creates the title field of the test FormSpace form.
 *
 * @returns A forge text field configuration for the title.
 */
export function demoTestFormSpaceTitleField() {
  return dbxForgeTextField({ key: 'title', label: 'Title', maxLength: DEMO_TEST_FORM_SPACE_TITLE_MAX_LENGTH, required: true });
}

/**
 * Creates the notes field of the test FormSpace form.
 *
 * @returns A forge text area field configuration for the notes.
 */
export function demoTestFormSpaceNotesField() {
  return dbxForgeTextAreaField({ key: 'notes', label: 'Test Information', maxLength: DEMO_TEST_FORM_SPACE_NOTES_MAX_LENGTH });
}

/**
 * Creates the agreement toggle of the test FormSpace form.
 *
 * @returns A forge toggle field configuration for the agreement.
 */
export function demoTestFormSpaceAgreedField() {
  return dbxForgeToggleField({ key: 'agreed', label: 'Agreed', hint: 'Whether the terms of this test submission are agreed to.' });
}
