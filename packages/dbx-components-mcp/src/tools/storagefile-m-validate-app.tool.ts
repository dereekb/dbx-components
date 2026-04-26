/**
 * `dbx_storagefile_m_validate_app` tool.
 *
 * Cross-file verifier for downstream app StorageFile configuration.
 * Reads the component package's `src/lib/model/storagefile/` and the
 * API app's `src/app/common/model/storagefile/` +
 * `src/app/common/model/notification/`, then asserts every declared
 * `StorageFilePurpose` is wired through the upload-service initializer
 * path AND, for purposes that declare processing subtasks, through
 * the storage-file processing handler.
 *
 * Accepts two required inputs:
 *   - `componentDir`: relative path to the `-firebase` component package.
 *   - `apiDir`: relative path to the API app.
 *
 * Paths escaping the cwd are rejected.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createTwoSideValidateTool } from './validate-tool.js';
import { formatResult, inspectAppStorageFiles, validateAppStorageFiles } from './storagefile-m-validate-app/index.js';

// MARK: Tool definition
const DBX_STORAGEFILE_M_VALIDATE_APP_TOOL: Tool = {
  name: 'dbx_storagefile_m_validate_app',
  description: [
    'Validate that every `StorageFilePurpose` declared in a `-firebase` component package is wired through the upload-service path in the API app: a paired `*_UPLOADED_FILE_TYPE_IDENTIFIER` constant, a `StorageFileInitializeFromUploadServiceInitializer` whose `type:` references it, the surrounding `storageFileInitializeFromUploadService({ initializer })` factory, and a NestJS provider with `provide: StorageFileInitializeFromUploadService, useFactory: <factory>`.',
    '',
    'For purposes that declare processing subtasks (a `<Foo>ProcessingSubtask` union alias and at least one `*_PROCESSING_SUBTASK` constant), the validator additionally verifies a `StorageFileProcessingPurposeSubtaskProcessorConfig` whose `target:` references the purpose, with a `flow:` array that covers every declared subtask, and that the surrounding `storageFileProcessingNotificationTaskHandler({ processors })` call exists.',
    '',
    'Cross-file tracing follows direct entries and spread (`...workerFileInitializers`) through every `.ts` file under `src/lib/model/storagefile/` on the component side and `src/app/common/model/storagefile/` + `src/app/common/model/notification/` on the API side.',
    '',
    'External identifiers imported from `@dereekb/*` are trusted — spreads and `type:` / `target:` references that resolve into upstream packages do not produce orphan/unresolved errors.',
    '',
    'Provide both:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: {
        type: 'string',
        description: 'Relative path to the `-firebase` component package (e.g. `components/demo-firebase`).'
      },
      apiDir: {
        type: 'string',
        description: 'Relative path to the API app (e.g. `apps/demo-api`).'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const storageFileMValidateAppTool: DbxTool = createTwoSideValidateTool({
  definition: DBX_STORAGEFILE_M_VALIDATE_APP_TOOL,
  inspectAndValidate: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectAppStorageFiles(componentAbs, apiAbs);
    return validateAppStorageFiles(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  format: formatResult
});
