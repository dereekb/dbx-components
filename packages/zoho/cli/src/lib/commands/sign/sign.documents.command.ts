import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { getSignContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { outputResult } from '../../util/output';
import { withSignPagination } from '../../util/args';
import { runZohoSignPaginatedList } from '../../util/pagination';
import { zohoSignCreateDocument, zohoSignCreateDocumentFromTemplate, zohoSignDeleteDocument, zohoSignDownloadCompletionCertificate, zohoSignDownloadPdf, zohoSignExtendDocument, zohoSignGetDocument, zohoSignGetDocumentFormData, zohoSignGetDocuments, zohoSignGetEmbeddedSigningUrl, zohoSignSendDocumentForSignature, zohoSignUpdateDocument } from '@dereekb/zoho';

/**
 * Builds the optional `search_columns` filter object from the shared search-column options, returning
 * `undefined` when none were provided so the list request omits the filter entirely.
 *
 * @param argv - The yargs-parsed arguments carrying the per-column filter values.
 * @returns A populated search-columns map, or `undefined` when no filters were supplied.
 */
function buildSearchColumns(argv: any): Record<string, string> | undefined {
  const columns: Record<string, string> = {};

  if (argv.requestName) columns['request_name'] = argv.requestName;
  if (argv.folderName) columns['folder_name'] = argv.folderName;
  if (argv.ownerFullName) columns['owner_full_name'] = argv.ownerFullName;
  if (argv.recipientEmail) columns['recipient_email'] = argv.recipientEmail;
  if (argv.recipientName) columns['recipient_name'] = argv.recipientName;
  if (argv.formName) columns['form_name'] = argv.formName;

  return Object.keys(columns).length > 0 ? columns : undefined;
}

const documentsListCommand: CommandModule = {
  command: 'list',
  describe: 'List sign requests (documents)',
  builder: (yargs: Argv) =>
    withSignPagination(yargs)
      .option('sort-column', { type: 'string', describe: 'Column to sort by (e.g. request_name, created_time, recipient_email)' })
      .option('sort-order', { type: 'string', choices: ['ASC', 'DESC'] as const, describe: 'Sort direction' })
      .option('request-name', { type: 'string', describe: 'Filter by request name' })
      .option('folder-name', { type: 'string', describe: 'Filter by folder name' })
      .option('owner-full-name', { type: 'string', describe: 'Filter by owner full name' })
      .option('recipient-email', { type: 'string', describe: 'Filter by recipient email' })
      .option('recipient-name', { type: 'string', describe: 'Filter by recipient name' })
      .option('form-name', { type: 'string', describe: 'Filter by form name' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const initialInput = {
        start_index: argv.startIndex,
        row_count: argv.rowCount,
        sort_column: argv.sortColumn,
        sort_order: argv.sortOrder,
        search_columns: buildSearchColumns(argv)
      };
      await runZohoSignPaginatedList({ argv, initialInput, fetchPage: (input) => zohoSignGetDocuments(signContext)(input) });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsGetCommand: CommandModule = {
  command: 'get <requestId>',
  describe: 'Get a sign request by ID',
  builder: (yargs: Argv) => yargs.positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const result = await zohoSignGetDocument(signContext)({ requestId: argv.requestId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsFormDataCommand: CommandModule = {
  command: 'form-data <requestId>',
  describe: 'Get filled form-field values for a completed request',
  builder: (yargs: Argv) => yargs.positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const result = await zohoSignGetDocumentFormData(signContext)({ requestId: argv.requestId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsCreateCommand: CommandModule = {
  command: 'create',
  describe: 'Create a draft sign request from a local file',
  builder: (yargs: Argv) =>
    yargs
      .option('file', { type: 'string', demandOption: true, describe: 'Path to the local document to upload' })
      .option('data', { type: 'string', demandOption: true, describe: 'JSON request data (ZohoSignRequestData: request_name, is_sequential, actions, ...)' })
      .option('content-type', { type: 'string', default: 'application/pdf', describe: 'MIME type of the uploaded file' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const requestData = JSON.parse(argv.data);
      const buffer = await readFile(argv.file);
      const file = new File([buffer], basename(argv.file), { type: argv.contentType });
      const result = await zohoSignCreateDocument(signContext)({ requestData, file });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsCreateFromTemplateCommand: CommandModule = {
  command: 'create-from-template',
  describe: 'Create a sign request from a template',
  builder: (yargs: Argv) =>
    yargs
      .option('template-id', { type: 'string', demandOption: true, describe: 'Template ID' })
      .option('data', { type: 'string', demandOption: true, describe: 'JSON template data (ZohoSignCreateDocumentFromTemplateData: request_name, actions, field_data, ...)' })
      .option('quick-send', { type: 'boolean', default: true, describe: 'Send immediately (true) or leave as a draft (false)' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const data = JSON.parse(argv.data);
      const result = await zohoSignCreateDocumentFromTemplate(signContext)({ templateId: argv.templateId, data, isQuickSend: argv.quickSend });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsUpdateCommand: CommandModule = {
  command: 'update <requestId>',
  describe: 'Update a draft sign request',
  builder: (yargs: Argv) => yargs.positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' }).option('data', { type: 'string', demandOption: true, describe: 'JSON partial request data to apply' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const data = JSON.parse(argv.data);
      const result = await zohoSignUpdateDocument(signContext)({ requestId: argv.requestId, data });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsSendCommand: CommandModule = {
  command: 'send <requestId>',
  describe: 'Submit a draft request to its recipients for signing',
  builder: (yargs: Argv) => yargs.positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' }).option('data', { type: 'string', describe: 'Optional JSON partial request data to apply before sending' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const data = argv.data ? JSON.parse(argv.data) : undefined;
      const result = await zohoSignSendDocumentForSignature(signContext)({ requestId: argv.requestId, data });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsExtendCommand: CommandModule = {
  command: 'extend <requestId>',
  describe: 'Extend the expiration date of an in-progress request',
  builder: (yargs: Argv) => yargs.positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' }).option('expire-by', { type: 'string', demandOption: true, describe: 'New expiration date string (e.g. "30 November 2024")' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const result = await zohoSignExtendDocument(signContext)({ requestId: argv.requestId, expire_by: argv.expireBy });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsDeleteCommand: CommandModule = {
  command: 'delete <requestId>',
  describe: 'Delete a request (optionally recalling an in-progress one)',
  builder: (yargs: Argv) =>
    yargs.positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' }).option('recall-inprogress', { type: 'boolean', describe: 'Recall an in-progress request before deleting' }).option('reason', { type: 'string', describe: 'Reason for recalling/deleting' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const result = await zohoSignDeleteDocument(signContext)({ requestId: argv.requestId, recall_inprogress: argv.recallInprogress, reason: argv.reason });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsDownloadCommand: CommandModule = {
  command: 'download <requestId>',
  describe: 'Download the signed PDF (or ZIP) for a request to a local file',
  builder: (yargs: Argv) =>
    yargs
      .positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' })
      .option('output', { type: 'string', demandOption: true, describe: 'Path to write the downloaded file to' })
      .option('with-coc', { type: 'boolean', describe: 'Include the completion certificate' })
      .option('merge', { type: 'boolean', describe: 'Merge all signed documents into one file' })
      .option('password', { type: 'string', describe: 'Password for protected documents' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const response = await zohoSignDownloadPdf(signContext)({ requestId: argv.requestId, with_coc: argv.withCoc, merge: argv.merge, password: argv.password });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(argv.output, buffer);
      outputResult({ saved: true, path: argv.output, bytes: buffer.length });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsCertificateCommand: CommandModule = {
  command: 'certificate <requestId>',
  describe: 'Download the completion certificate PDF for a request to a local file',
  builder: (yargs: Argv) => yargs.positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' }).option('output', { type: 'string', demandOption: true, describe: 'Path to write the certificate to' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const response = await zohoSignDownloadCompletionCertificate(signContext)({ requestId: argv.requestId });

      if (!response.ok) {
        throw new Error(`Certificate download failed with status ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(argv.output, buffer);
      outputResult({ saved: true, path: argv.output, bytes: buffer.length });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const documentsEmbedUrlCommand: CommandModule = {
  command: 'embed-url <requestId> <actionId>',
  describe: 'Generate an embedded signing URL for a recipient action',
  builder: (yargs: Argv) =>
    yargs
      .positional('requestId', { type: 'string', demandOption: true, describe: 'Request (envelope) ID' })
      .positional('actionId', { type: 'string', demandOption: true, describe: 'Recipient action ID' })
      .option('host', { type: 'string', demandOption: true, describe: 'Hosting origin embedded in the token (https required in production)' }),
  handler: async (argv: any) => {
    try {
      const signContext = getSignContext(argv);
      const result = await zohoSignGetEmbeddedSigningUrl(signContext)({ requestId: argv.requestId, actionId: argv.actionId, host: argv.host });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const SIGN_DOCUMENTS_COMMAND: CommandModule = {
  command: 'documents',
  describe: 'Zoho Sign document (request) operations',
  builder: (yargs: Argv) =>
    yargs
      .command(documentsListCommand)
      .command(documentsGetCommand)
      .command(documentsFormDataCommand)
      .command(documentsCreateCommand)
      .command(documentsCreateFromTemplateCommand)
      .command(documentsUpdateCommand)
      .command(documentsSendCommand)
      .command(documentsExtendCommand)
      .command(documentsDeleteCommand)
      .command(documentsDownloadCommand)
      .command(documentsCertificateCommand)
      .command(documentsEmbedUrlCommand)
      .demandCommand(1, 'Please specify a documents subcommand.')
      .example([
        ['$0 sign documents list --row-count 10', 'List first 10 sign requests'],
        ['$0 sign documents get 12345', 'Get a request by ID'],
        ['$0 sign documents create --file ./nda.pdf --data \'{"request_name":"NDA","is_sequential":true,"actions":[{"action_type":"SIGN","recipient_name":"Jane","recipient_email":"jane@example.com"}]}\'', 'Create a draft from a file'],
        ['$0 sign documents download 12345 --output ./signed.pdf --with-coc --merge', 'Download the signed PDF']
      ]),
  handler: noop
};
