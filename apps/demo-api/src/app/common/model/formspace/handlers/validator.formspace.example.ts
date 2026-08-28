import { type FormSpaceFileValidationResult, type FormSpaceFileValidatorConfig, type FormSpaceFileValidatorInput } from '@dereekb/firebase-server/model';
import { bufferHasValidPdfMarkings } from '@dereekb/util';
import { DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, DEMO_EXAMPLE_FORM_SPACE_TYPE } from 'demo-firebase';

/**
 * The reason a supporting document is rejected.
 *
 * Free text rather than a code because it is written for the OWNER: the FormSpace carries it on the file's
 * entry and the client renders it beside the file that failed.
 */
export const DEMO_EXAMPLE_FORM_SPACE_NOT_A_PDF_REASON = 'This file is not a readable PDF. Re-export it and upload it again.';

/**
 * The demo app's validator for {@link DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT}.
 *
 * Sniffs the PDF header and EOF marker rather than trusting the declared content type, which is the point of
 * validating at all: `storage.rules` and the upload policy both check what the CLIENT said the file was, and
 * neither can look at a byte of it.
 *
 * Deliberately deterministic. A model-backed check — the shape the `resume` purpose uses, and what a real
 * app would reach for here — would make the emulator scenario spec depend on an inference; the `pending`
 * verdict exists precisely so that shape stays available without this one having to take it.
 *
 * @param input - The file to check and the slot it fills.
 * @returns The verdict.
 */
async function validateDemoExampleFormSpaceDocument(input: FormSpaceFileValidatorInput): Promise<FormSpaceFileValidationResult> {
  const bytes = await input.fileDetailsAccessor.loadFileBytes();
  const valid = bufferHasValidPdfMarkings(Buffer.from(bytes));

  return valid ? { verdict: 'valid' } : { verdict: 'invalid', reason: DEMO_EXAMPLE_FORM_SPACE_NOT_A_PDF_REASON };
}

/**
 * Registers {@link validateDemoExampleFormSpaceDocument} for the demo example form's documents slot.
 */
export const DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_VALIDATOR: FormSpaceFileValidatorConfig = {
  formSpaceType: DEMO_EXAMPLE_FORM_SPACE_TYPE,
  slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT,
  validate: validateDemoExampleFormSpaceDocument
};

/**
 * Every {@link FormSpaceFileValidatorConfig} the demo app registers.
 *
 * The processor asserts at wiring time that this list covers every slot declaring `validationRequired`, so a
 * slot added to {@link DEMO_FORM_SPACE_TYPE_CONFIGS} without a validator fails the app's boot rather than
 * accepting every file silently.
 */
export const DEMO_FORM_SPACE_FILE_VALIDATORS: FormSpaceFileValidatorConfig[] = [DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_VALIDATOR];
