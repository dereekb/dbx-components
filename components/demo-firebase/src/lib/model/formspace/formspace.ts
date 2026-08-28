import { type FormSpaceData, type FormSpaceFileSlot, type FormSpaceType, type FormSpaceTypeConfig } from '@dereekb/firebase';
import { MS_IN_DAY } from '@dereekb/util';

/**
 * The {@link FormSpaceType} of the demo app's example form.
 */
export const DEMO_EXAMPLE_FORM_SPACE_TYPE: FormSpaceType = 'demo_example';

/**
 * The required resume slot of {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}.
 */
export const DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT: FormSpaceFileSlot = 'resume';

/**
 * The optional attachment slot of {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}.
 */
export const DEMO_EXAMPLE_FORM_SPACE_ATTACHMENT_SLOT: FormSpaceFileSlot = 'attachment';

/**
 * The shape of the JSON a {@link DEMO_EXAMPLE_FORM_SPACE_TYPE} space parks in its `d` field.
 *
 * The framework never interprets `d` — this interface is the DEMO's contract with its own handler, which
 * is exactly how a downstream app narrows the generic at the point it reads the space.
 */
export interface DemoExampleFormSpaceData extends FormSpaceData {
  readonly fullName?: string;
  readonly message?: string;
}

/**
 * Every {@link FormSpaceTypeConfig} the demo app registers.
 *
 * Kept to one type on purpose: the point of the registry is that a second type is a data entry, not a code
 * change, and the emulator scenario spec exercises the whole lifecycle through this single one.
 */
export const DEMO_FORM_SPACE_TYPE_CONFIGS: FormSpaceTypeConfig[] = [
  {
    formSpaceType: DEMO_EXAMPLE_FORM_SPACE_TYPE,
    name: 'Demo Example Form',
    description: 'An example form space with a required resume and an optional attachment.',
    slots: [
      {
        slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT,
        name: 'Resume',
        required: true,
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 1024 * 1024
      },
      {
        slot: DEMO_EXAMPLE_FORM_SPACE_ATTACHMENT_SLOT,
        name: 'Attachment',
        required: false,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
        maxFileSizeBytes: 2 * 1024 * 1024
      }
    ],
    maxUploads: 10,
    expiresIn: 7 * MS_IN_DAY
  }
];
