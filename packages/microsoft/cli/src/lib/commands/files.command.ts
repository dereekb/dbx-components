import { CliError } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphConflictBehavior,
  type MicrosoftGraphContext,
  type MicrosoftGraphDriveItemRefInput,
  type MicrosoftGraphRequestInput,
  MICROSOFT_GRAPH_DRIVE_SIMPLE_UPLOAD_MAX_BYTES,
  copyDriveItem,
  type MicrosoftGraphDriveItem,
  findMicrosoftGraphWorkbookWorksheet,
  getDriveItem,
  getWorkbookRange,
  listWorkbookWorksheets,
  microsoftGraphCollectPages,
  microsoftGraphCopyDriveItemRequest,
  microsoftGraphCreateDriveUploadSessionRequest,
  microsoftGraphCreateFolderRequest,
  microsoftGraphDeleteDriveItemRequest,
  microsoftGraphDownloadDriveItemRequest,
  microsoftGraphDriveChildrenPageInput,
  microsoftGraphDriveItemSummary,
  microsoftGraphDriveUploadChunkSize,
  microsoftGraphRequest,
  microsoftGraphSimpleUploadRequest,
  microsoftGraphSiteByUrlPath,
  microsoftGraphUpdateDriveItemRequest,
  microsoftGraphWorkbookRowsToObjects,
  moveDriveItem,
  resolveSiteDrive,
  searchDriveItems,
  uploadDriveFile
} from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { basename, posix } from 'node:path';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { parseMsGraphCliEnumOption } from '../util/auto.reply';
import { msGraphCliConfirmOptions, msGraphCliDryRunOptions, msGraphCliDryRunOutput, requireMsGraphCliConfirmation } from '../util/mail.write';
import { downloadMsGraphCliFile, msGraphCliIdleTimeoutMs, msGraphCliIdleTimeoutOption } from '../util/file.download';
import { openMsGraphCliFileUploadSource } from '../util/file.source';
import { outputMsGraphCliResult } from '../util/output';
import { msGraphCliContentTypeForFile } from './request.command';

const CONFLICT_BEHAVIORS: readonly MicrosoftGraphConflictBehavior[] = ['fail', 'rename', 'replace'];

// MARK: Options
/**
 * Adds the drive options every `files` command takes: `--drive`, or `--site` with an optional `--library`.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
export function msGraphCliDriveOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('drive', { type: 'string', describe: 'A drive id (a SharePoint library, or a shared OneDrive). Default: your own OneDrive' })
    .option('site', { type: 'string', describe: 'A SharePoint site URL, e.g. https://contoso.sharepoint.com/sites/Team (needs Sites.Read.All)' })
    .option('library', { type: 'string', describe: "With --site: the document library's name (default: the site's default library)" });
}

function itemOptions<T>(yargs: Argv<T>) {
  return msGraphCliDriveOptions(yargs).positional('id', { type: 'string', describe: 'The drive item id' }).option('path', { type: 'string', describe: 'The item path from the drive root, in place of an id' });
}

/**
 * Resolves the drive the drive options name: `--drive`, or the `--site` library, or undefined for the user's
 * own OneDrive.
 *
 * @param graphContext - The Graph context.
 * @param argv - The parsed options.
 * @param argv.drive - The `--drive` id.
 * @param argv.site - The `--site` URL.
 * @param argv.library - The `--library` name.
 * @returns The drive id, or undefined.
 * @throws {CliError} `INVALID_ARGUMENT` for `--library` without `--site`, both `--drive` and `--site`, or a bad site URL.
 */
export async function resolveMsGraphCliDriveId(graphContext: MicrosoftGraphContext, argv: { readonly drive?: Maybe<string>; readonly site?: Maybe<string>; readonly library?: Maybe<string> }): Promise<Maybe<string>> {
  let result: Maybe<string> = argv.drive;

  if (argv.drive && argv.site) {
    throw new CliError({ message: 'Pass --drive or --site, not both.', code: 'INVALID_ARGUMENT' });
  } else if (argv.library && !argv.site) {
    throw new CliError({ message: '--library needs --site.', code: 'INVALID_ARGUMENT' });
  } else if (argv.site) {
    try {
      microsoftGraphSiteByUrlPath(argv.site);
    } catch (e) {
      throw new CliError({ message: (e as Error).message, code: 'INVALID_ARGUMENT' });
    }

    result = (await resolveSiteDrive(graphContext)({ siteUrl: argv.site, library: argv.library })).id;
  }

  return result;
}

/**
 * Resolves the item the options name (`[id]` or `--path`) in the drive the drive options name.
 *
 * @param graphContext - The Graph context.
 * @param argv - The parsed options.
 * @returns The item reference.
 * @throws {CliError} `INVALID_ARGUMENT` when neither an id nor `--path` is given.
 */
export async function resolveMsGraphCliItemRef(graphContext: MicrosoftGraphContext, argv: any): Promise<MicrosoftGraphDriveItemRefInput> {
  if (!argv.id && !argv.path) {
    throw new CliError({ message: 'Pass an item id or --path.', code: 'INVALID_ARGUMENT' });
  }

  return { driveId: await resolveMsGraphCliDriveId(graphContext, argv), id: argv.id, path: argv.path };
}

/**
 * Resolves a destination folder (`--to <id>` or `--to-path <path>`) to its id; the drive root when neither.
 *
 * @param graphContext - The Graph context.
 * @param input - The destination drive and folder.
 * @param input.driveId - The destination drive, or undefined for the user's own OneDrive.
 * @param input.to - The folder id.
 * @param input.toPath - The folder path.
 * @returns The folder id.
 */
async function resolveFolderId(graphContext: MicrosoftGraphContext, input: { readonly driveId: Maybe<string>; readonly to?: Maybe<string>; readonly toPath?: Maybe<string> }): Promise<string> {
  return input.to ? input.to : (await getDriveItem(graphContext)({ driveId: input.driveId, ...(input.toPath ? { path: input.toPath } : { id: 'root' }) })).id;
}

// MARK: Read
const FILES_SEARCH_COMMAND: CommandModule = {
  command: 'search <query>',
  describe: 'Search a drive (default: your OneDrive)',
  builder: (yargs: Argv) => msGraphCliDriveOptions(yargs).positional('query', { type: 'string', demandOption: true, describe: 'Search text' }).option('top', { type: 'number', describe: 'Maximum items to return (default 25)' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputMsGraphCliResult(await searchDriveItems(graphContext)({ driveId: await resolveMsGraphCliDriveId(graphContext, argv), query: argv.query, top: argv.top }));
  })
};

const FILES_GET_COMMAND: CommandModule = {
  command: 'get [id]',
  describe: "Get one drive item's metadata, by id or --path",
  builder: (yargs: Argv) =>
    itemOptions(yargs).example([
      ['$0 files get 01ABCDEF', 'An item by id'],
      ['$0 files get --path Documents/report.docx', 'An item by path'],
      ['$0 files get --site https://contoso.sharepoint.com/sites/Team --path Policies/handbook.pdf', 'An item in a SharePoint library']
    ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputMsGraphCliResult(await getDriveItem(graphContext)(await resolveMsGraphCliItemRef(graphContext, argv)));
  })
};

export const FILES_LIST_COMMAND: CommandModule = {
  command: 'list [id]',
  describe: "List a folder's items (default: the drive root), compact by default",
  builder: (yargs: Argv) =>
    itemOptions(yargs)
      .option('top', { type: 'number', describe: 'Items per page (default 200)' })
      .option('all-pages', { type: 'boolean', default: false, describe: 'Follow @odata.nextLink and return every page (up to --max-pages)' })
      .option('max-pages', { type: 'number', describe: 'With --all-pages: stop after this many pages (default 20)' })
      .option('next', { type: 'string', describe: 'Continue a listing from the nextLink a previous call returned (the folder options are ignored)' })
      .option('type', { type: 'string', choices: ['file', 'folder'], describe: 'Keep only files or only folders (a OneNote notebook, listed as type package, counts as a file)' })
      .option('urls', { type: 'boolean', default: false, describe: "Include each item's webUrl" })
      .option('full', { type: 'boolean', default: false, describe: 'Return the full driveItems (much larger, and they carry pre-authenticated download URLs)' })
      .example([
        ['$0 files list', 'Your OneDrive root'],
        ['$0 files list --site https://contoso.sharepoint.com/sites/Team --path Policies --type file', 'The files of a SharePoint folder'],
        ['$0 files list --drive b!xyz 01ABCDEF --all-pages', 'Every item of a folder by id'],
        ['$0 files list --next "<nextLink>"', 'The next page of a previous listing']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const pageInput = argv.next ? { path: '', nextLink: String(argv.next) } : microsoftGraphDriveChildrenPageInput({ driveId: await resolveMsGraphCliDriveId(graphContext, argv), id: argv.id, path: argv.path, top: argv.top, full: argv.full });
    const { items, nextLink } = await microsoftGraphCollectPages(graphContext)<MicrosoftGraphDriveItem>({ ...pageInput, maxPages: argv.allPages ? argv.maxPages : 1 });
    const kept = argv.type ? items.filter((x) => (x.folder == null ? 'file' : 'folder') === argv.type) : items;
    outputMsGraphCliResult({ items: argv.full ? kept : kept.map((x) => microsoftGraphDriveItemSummary(x, argv.urls)), ...(nextLink ? { nextLink } : {}) });
  })
};

export const FILES_SHEET_COMMAND: CommandModule = {
  command: 'sheet [id]',
  describe: "Read an .xlsx worksheet's cells (read-only), by id or --path. To edit a workbook, download it and use a local xlsx tool",
  builder: (yargs: Argv) =>
    itemOptions(yargs)
      .option('list', { type: 'boolean', default: false, describe: "List the workbook's worksheets instead of reading one" })
      .option('sheet', { type: 'string', describe: 'The worksheet name (case-insensitive) or id. Default: the first worksheet' })
      .option('range', { type: 'string', describe: "An A1 address within the sheet, e.g. A1:F200. Default: the sheet's used range" })
      .option('values-only', { type: 'boolean', default: true, describe: 'For the used range: skip cells that have formatting but no value (--no-values-only to keep them)' })
      .option('header', { type: 'boolean', default: false, describe: 'Return each row as an object keyed by the first row' })
      .option('text', { type: 'boolean', default: false, describe: 'Return the displayed (formatted) text instead of the raw values' })
      .example([
        ['$0 files sheet --path Reports/roster.xlsx --list', "List a workbook's worksheets"],
        ['$0 files sheet 01ABCDEF --sheet Texas --header', 'Read a worksheet as objects keyed by its header row'],
        ['$0 files sheet --drive b!xyz 01ABCDEF --sheet Texas --range A1:F50', 'Read part of a sheet in a SharePoint library']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const item = await resolveMsGraphCliItemRef(graphContext, argv);
    const worksheets = (await listWorkbookWorksheets(graphContext)(item)).value;

    if (argv.list) {
      outputMsGraphCliResult(worksheets.map(({ id, name, position, visibility }) => ({ id, name, position, visibility })));
    } else {
      const worksheet = findMicrosoftGraphWorkbookWorksheet(worksheets, argv.sheet);

      if (!worksheet) {
        throw new CliError({ message: `No worksheet named "${argv.sheet}".`, code: 'NOT_FOUND', suggestion: `The workbook has: ${worksheets.map((x) => x.name).join(', ')}` });
      }

      const range = await getWorkbookRange(graphContext)({ ...item, sheet: worksheet.id, address: argv.range, valuesOnly: argv.valuesOnly });
      const cells: readonly (readonly unknown[])[] = argv.text ? (range.text ?? []) : range.values;
      outputMsGraphCliResult({ sheet: worksheet.name, address: range.address, rowCount: range.rowCount, columnCount: range.columnCount, rows: argv.header ? microsoftGraphWorkbookRowsToObjects(cells) : cells });
    }
  })
};

const FILES_DRIVE_COMMAND: CommandModule = {
  command: 'drive',
  describe: "Resolve a SharePoint site's library (--site, --library) to its drive id",
  builder: (yargs: Argv) => msGraphCliDriveOptions(yargs).demandOption('site'),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputMsGraphCliResult(await resolveSiteDrive(graphContext)({ siteUrl: argv.site, library: argv.library }));
  })
};

/**
 * What `files download` prints: where the bytes went, never the bytes.
 */
export interface MsGraphCliDownloadOutput {
  readonly file: string;
  readonly bytes: number;
  readonly contentType?: string;
}

const FILES_DOWNLOAD_COMMAND: CommandModule = {
  command: 'download [id]',
  describe: "Download a file's bytes to --out, streamed to disk as they arrive",
  builder: (yargs: Argv) => msGraphCliIdleTimeoutOption(itemOptions(yargs).option('out', { type: 'string', demandOption: true, describe: 'The file to write (mode 0600). It appears only once the download is complete' })),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const ref = await resolveMsGraphCliItemRef(graphContext, argv);
    const output: MsGraphCliDownloadOutput = await downloadMsGraphCliFile({ graphContext, request: microsoftGraphDownloadDriveItemRequest(ref), out: argv.out, idleTimeout: msGraphCliIdleTimeoutMs(argv.idleTimeout) });
    outputMsGraphCliResult(output);
  })
};

// MARK: Write
export const FILES_UPLOAD_COMMAND: CommandModule = {
  command: 'upload <local>',
  describe: `Upload a file: one PUT up to ${MICROSOFT_GRAPH_DRIVE_SIMPLE_UPLOAD_MAX_BYTES / (1024 * 1024)} MB, else an upload session in 320 KiB-multiple chunks`,
  builder: (yargs: Argv) =>
    msGraphCliDryRunOptions(msGraphCliDriveOptions(yargs))
      .positional('local', { type: 'string', demandOption: true, describe: 'The local file' })
      .option('to', { type: 'string', describe: 'The destination folder id (default: the drive root)' })
      .option('to-path', { type: 'string', describe: 'The destination folder path from the drive root, in place of --to' })
      .option('name', { type: 'string', describe: 'The uploaded file name (default: the local name)' })
      .option('conflict', { type: 'string', default: 'fail', describe: `When the name exists: ${CONFLICT_BEHAVIORS.join(' | ')}` })
      .option('chunk-size', { type: 'number', describe: 'Bytes per upload session chunk, rounded down to a multiple of 320 KiB (default 10 MiB)' })
      .example([['$0 files upload ./report.xlsx --to-path Documents/Reports --conflict rename', 'Upload into a folder, renaming on a clash']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    // the file is read one chunk at a time, just before that chunk's PUT, so memory holds one chunk at most
    const source = await openMsGraphCliFileUploadSource(argv.local);

    try {
      const name = argv.name ?? basename(argv.local);
      const driveId = await resolveMsGraphCliDriveId(graphContext, argv);
      const target = { driveId, parentId: argv.to, parentPath: argv.toPath, name, contentType: msGraphCliContentTypeForFile(name), conflictBehavior: parseMsGraphCliEnumOption('conflict', argv.conflict, CONFLICT_BEHAVIORS) };

      if (argv.dryRun) {
        const simple = source.size <= MICROSOFT_GRAPH_DRIVE_SIMPLE_UPLOAD_MAX_BYTES;
        const chunkSize = microsoftGraphDriveUploadChunkSize(argv.chunkSize);
        const request: MicrosoftGraphRequestInput = simple ? { ...microsoftGraphSimpleUploadRequest({ ...target, bytes: new Uint8Array(0) }), body: undefined } : microsoftGraphCreateDriveUploadSessionRequest(target);
        outputMsGraphCliResult(msGraphCliDryRunOutput([request], simple ? `The PUT body is the file's ${source.size} bytes.` : `Then ${Math.ceil(source.size / chunkSize)} chunk PUT(s) of up to ${chunkSize} bytes to the session's uploadUrl, without an Authorization header.`));
      } else {
        outputMsGraphCliResult(await uploadDriveFile(graphContext)({ ...target, bytes: source, chunkSize: argv.chunkSize }));
      }
    } finally {
      await source.close();
    }
  })
};

const FILES_MKDIR_COMMAND: CommandModule = {
  command: 'mkdir <path>',
  describe: 'Create a folder at a path from the drive root',
  builder: (yargs: Argv) =>
    msGraphCliDryRunOptions(msGraphCliDriveOptions(yargs))
      .positional('path', { type: 'string', demandOption: true, describe: 'The new folder path, e.g. Documents/Reports' })
      .option('conflict', { type: 'string', default: 'fail', describe: `When the name exists: ${CONFLICT_BEHAVIORS.join(' | ')}` }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const path = posix.normalize(String(argv.path)).replaceAll(/^\/+|\/+$/g, '');
    const parentPath = posix.dirname(path);
    const request = microsoftGraphCreateFolderRequest({ driveId: await resolveMsGraphCliDriveId(graphContext, argv), parentPath: parentPath === '.' ? undefined : parentPath, name: posix.basename(path), conflictBehavior: parseMsGraphCliEnumOption('conflict', argv.conflict, CONFLICT_BEHAVIORS) });
    outputMsGraphCliResult(argv.dryRun ? msGraphCliDryRunOutput([request]) : await microsoftGraphRequest(graphContext)(request));
  })
};

const FILES_RENAME_COMMAND: CommandModule = {
  command: 'rename [id]',
  describe: 'Rename an item (it keeps its id)',
  builder: (yargs: Argv) => msGraphCliDryRunOptions(itemOptions(yargs)).option('name', { type: 'string', demandOption: true, describe: 'The new name' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const request = microsoftGraphUpdateDriveItemRequest({ ...(await resolveMsGraphCliItemRef(graphContext, argv)), name: argv.name });
    outputMsGraphCliResult(argv.dryRun ? msGraphCliDryRunOutput([request]) : await microsoftGraphRequest(graphContext)(request));
  })
};

function destinationOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('to', { type: 'string', describe: 'The destination folder id' })
    .option('to-path', { type: 'string', describe: 'The destination folder path, in place of --to (default: the drive root)' })
    .option('to-drive', { type: 'string', describe: "The destination folder's drive id (default: the item's drive)" });
}

export const FILES_MOVE_COMMAND: CommandModule = {
  command: 'move [id]',
  describe: 'Move an item to another folder of the same drive (it keeps its id). Another drive is refused: use copy, then delete',
  builder: (yargs: Argv) => msGraphCliDryRunOptions(destinationOptions(itemOptions(yargs))).option('name', { type: 'string', describe: 'Also rename it' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const ref = await resolveMsGraphCliItemRef(graphContext, argv);
    const parentDriveId = argv.toDrive ?? ref.driveId;
    const parentId = await resolveFolderId(graphContext, { driveId: parentDriveId, to: argv.to, toPath: argv.toPath });
    const input = { ...ref, parentId, parentDriveId: argv.toDrive, name: argv.name };
    outputMsGraphCliResult(argv.dryRun ? msGraphCliDryRunOutput([microsoftGraphUpdateDriveItemRequest(input)]) : await moveDriveItem(graphContext)(input));
  })
};

const FILES_COPY_COMMAND: CommandModule = {
  command: 'copy [id]',
  describe: 'Copy an item, also into another drive (--to-drive). Graph copies in the background; --wait polls until done',
  builder: (yargs: Argv) =>
    msGraphCliDryRunOptions(destinationOptions(itemOptions(yargs)))
      .option('name', { type: 'string', describe: "The copy's name (default: the original's)" })
      .option('wait', { type: 'boolean', default: false, describe: 'Poll the copy monitor until it completes and print the new item id' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const ref = await resolveMsGraphCliItemRef(graphContext, argv);
    const parentDriveId = argv.toDrive ?? ref.driveId;
    const parentId = await resolveFolderId(graphContext, { driveId: parentDriveId, to: argv.to, toPath: argv.toPath });
    const input = { ...ref, parentId, parentDriveId, name: argv.name };

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphCopyDriveItemRequest(input)], argv.wait ? 'Then GETs of the Location monitor URL (pre-authenticated, no token) until the copy completes.' : undefined));
    } else {
      const { monitorUrl: _monitorUrl, ...status } = await copyDriveItem(graphContext)({ ...input, wait: argv.wait });
      outputMsGraphCliResult(status);
    }
  })
};

export const FILES_DELETE_COMMAND: CommandModule = {
  command: 'delete [id]',
  describe: 'Delete an item to the recycle bin, or --hard to delete it permanently. Needs --yes',
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(itemOptions(yargs)), 'Confirm the delete')
      .option('hard', { type: 'boolean', default: false, describe: 'Delete permanently (permanentDelete): skips the recycle bin and cannot be recovered' })
      .example([['$0 files delete --path Documents/old.txt --yes', 'Move a file to the recycle bin']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const ref = await resolveMsGraphCliItemRef(graphContext, argv);
    const request = microsoftGraphDeleteDriveItemRequest({ ...ref, hard: argv.hard });

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([request]));
    } else {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: argv.hard ? 'permanently delete the item' : 'delete the item' });
      await microsoftGraphRequest(graphContext)(request);
      outputMsGraphCliResult({ deleted: true, ...(ref.id ? { id: ref.id } : { path: ref.path }), permanent: argv.hard === true });
    }
  })
};

/**
 * The `files` command: OneDrive and SharePoint library reads and writes.
 */
export const FILES_COMMAND: CommandModule = {
  command: 'files',
  describe: 'Read and write OneDrive and SharePoint files (--drive, or --site [--library])',
  builder: (yargs: Argv) =>
    yargs
      .command(FILES_SEARCH_COMMAND)
      .command(FILES_GET_COMMAND)
      .command(FILES_LIST_COMMAND)
      .command(FILES_DRIVE_COMMAND)
      .command(FILES_SHEET_COMMAND)
      .command(FILES_DOWNLOAD_COMMAND)
      .command(FILES_UPLOAD_COMMAND)
      .command(FILES_MKDIR_COMMAND)
      .command(FILES_RENAME_COMMAND)
      .command(FILES_MOVE_COMMAND)
      .command(FILES_COPY_COMMAND)
      .command(FILES_DELETE_COMMAND)
      .demandCommand(1, 'Please specify a files subcommand.'),
  handler: () => undefined
};
