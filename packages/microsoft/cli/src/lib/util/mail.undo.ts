import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphMessageWriteResult, microsoftGraphMoveMessageRequest, moveMessages } from '@dereekb/microsoft';
import { type EmailAddress, type ISO8601DateString, type Maybe, type Milliseconds, type Seconds } from '@dereekb/util';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { MSGRAPH_CLI_NAME } from '../config/cli.config';
import { DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS, MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE, MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE, msGraphCliRunDeadline, msGraphCliSelectionMaxRetryAfterSeconds } from './mail.select';
import { type MsGraphCliDryRunOutput, type MsGraphCliWriteResultsOutput, msGraphCliDryRunOutput, msGraphCliWriteResultsOutput, runMsGraphCliMessageWrites } from './mail.write';

// MARK: Constants
/**
 * The version of the undo journal format.
 */
export const MSGRAPH_CLI_UNDO_JOURNAL_VERSION = 1;

/**
 * The folder under the config dir that holds the undo journals (mode 0700; each journal is 0600).
 */
export const MSGRAPH_CLI_UNDO_DIR_NAME = 'undo';

/**
 * How many journals the undo folder keeps; older ones are pruned after each new journal.
 */
export const MSGRAPH_CLI_UNDO_MAX_JOURNALS = 50;

/**
 * How many journals `mail undo --list` prints, newest first.
 */
export const MSGRAPH_CLI_UNDO_LIST_MAX = 20;

/**
 * The code of the refusal when the undo journal cannot be written. Nothing was changed.
 */
export const MSGRAPH_CLI_UNDO_UNWRITABLE_CODE = 'UNDO_JOURNAL_UNWRITABLE';

// MARK: Journal
/**
 * What a journal can undo: a `mail move`, or a soft `mail delete` (a move to Deleted Items).
 */
export type MsGraphCliUndoJournalKind = 'move' | 'delete';

/**
 * A folder in an undo journal.
 */
export interface MsGraphCliUndoJournalFolder {
  readonly id: string;
  readonly name?: Maybe<string>;
}

/**
 * Where a journal's messages went.
 */
export interface MsGraphCliUndoJournalDestination {
  /**
   * The folder as the run was given it (an id or a well-known name).
   */
  readonly given: string;
  readonly id?: Maybe<string>;
  readonly name?: Maybe<string>;
}

/**
 * The undo journal of one `mail move` or soft `mail delete`. It holds no filter, search text or subject: only the
 * mailbox, the folders and the message ids.
 */
export interface MsGraphCliUndoJournal {
  readonly version: typeof MSGRAPH_CLI_UNDO_JOURNAL_VERSION;
  readonly kind: MsGraphCliUndoJournalKind;
  readonly createdAt: ISO8601DateString;
  readonly mailbox?: Maybe<EmailAddress>;
  readonly immutableIds: boolean;
  /**
   * Where the messages were. Null when the run took ids: their folders are not known, so `mail undo` needs `--to`.
   */
  readonly source: Maybe<MsGraphCliUndoJournalFolder>;
  readonly destination: MsGraphCliUndoJournalDestination;
  /**
   * The moved messages' ids at the destination (the same ids with immutable ids).
   */
  readonly ids: string[];
  /**
   * The ids `mail undo` has moved back so far.
   */
  readonly undone: string[];
  readonly undoneAt?: Maybe<ISO8601DateString>;
  /**
   * False while the run is writing, or when it was cut off.
   */
  readonly complete: boolean;
}

/**
 * The undo folder under a config dir.
 *
 * @param configDir - The CLI config dir (`msGraphCliPaths().configDir`).
 * @returns The folder path.
 */
export function msGraphCliUndoDir(configDir: string): string {
  return join(configDir, MSGRAPH_CLI_UNDO_DIR_NAME);
}

/**
 * A journal's file name, `<yyyymmddThhmmssZ>-<kind>-<random8>.json`, so names sort by time.
 *
 * @param kind - The journal kind.
 * @param date - When the run started.
 * @returns The file name.
 */
export function msGraphCliUndoJournalFileName(kind: MsGraphCliUndoJournalKind, date: Date): string {
  const stamp = date
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replaceAll(/[-:]/g, '');
  return `${stamp}-${kind}-${randomBytes(4).toString('hex')}.json`;
}

/**
 * The ids a write result adds to a journal: the ok ones, at their destination.
 *
 * @param results - One group's results.
 * @returns The ids to append.
 */
export function msGraphCliUndoJournalIds(results: readonly MicrosoftGraphMessageWriteResult[]): string[] {
  return results.filter((x) => x.status >= 200 && x.status < 300).map((x) => x.message?.id ?? x.id);
}

async function writeJournalFile(file: string, journal: MsGraphCliUndoJournal): Promise<void> {
  // write a temp file and rename it over the journal, so a killed run never leaves a half-written journal
  const temp = join(dirname(file), `.${basename(file)}.${process.pid}.tmp`);
  await writeFile(temp, JSON.stringify(journal, null, 2), { mode: 0o600 });
  await rename(temp, file);
}

/**
 * The run details a journal's header records, known once the run has resolved its folders.
 */
export type MsGraphCliUndoJournalHeader = Pick<MsGraphCliUndoJournal, 'mailbox' | 'immutableIds' | 'source' | 'destination'>;

/**
 * Writes one run's undo journal as the run goes, so a run that is cut off still leaves a journal of what it moved.
 */
export interface MsGraphCliUndoJournalWriter {
  readonly file: string;
  /**
   * Whether the header was written (a run with nothing to move writes no journal).
   */
  readonly written: () => boolean;
  /**
   * Writes the header (no ids yet). Call before the first group.
   */
  readonly begin: (header: MsGraphCliUndoJournalHeader) => Promise<void>;
  /**
   * Adds a group's ok ids and rewrites the journal.
   */
  readonly append: (results: readonly MicrosoftGraphMessageWriteResult[]) => Promise<void>;
  /**
   * Marks the journal complete, then prunes old journals (only in the default folder).
   */
  readonly finish: () => Promise<void>;
}

/**
 * Input to {@link openMsGraphCliUndoJournal}.
 */
export interface OpenMsGraphCliUndoJournalInput {
  readonly configDir: string;
  readonly kind: MsGraphCliUndoJournalKind;
  /**
   * `--undo-file`: write the journal here instead of the undo folder. It is never pruned.
   */
  readonly file?: Maybe<string>;
  /**
   * When the run started. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Prepares a run's undo journal: makes sure its folder exists (0700) and is writable, BEFORE anything is changed.
 * Nothing is written until {@link MsGraphCliUndoJournalWriter.begin}.
 *
 * @param input - The config dir, kind and optional `--undo-file`.
 * @returns The writer.
 * @throws {CliError} `UNDO_JOURNAL_UNWRITABLE` when the folder cannot be created or written; the run must not act.
 */
export async function openMsGraphCliUndoJournal(input: OpenMsGraphCliUndoJournalInput): Promise<MsGraphCliUndoJournalWriter> {
  const now = input.now ?? new Date();
  const defaultDir = msGraphCliUndoDir(input.configDir);
  const file = input.file ?? join(defaultDir, msGraphCliUndoJournalFileName(input.kind, now));
  const dir = dirname(file);

  try {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await access(dir, constants.W_OK);
  } catch (e) {
    throw new CliError({
      message: `Cannot write the undo journal (${dir}: ${(e as Error).message}). Nothing was changed.`,
      code: MSGRAPH_CLI_UNDO_UNWRITABLE_CODE,
      suggestion: 'Pass --undo-file <path> to write it elsewhere, or --no-undo to run without one.'
    });
  }

  let journal: Maybe<MsGraphCliUndoJournal>;

  return {
    file,
    written: () => journal != null,
    begin: async (header) => {
      journal = { version: MSGRAPH_CLI_UNDO_JOURNAL_VERSION, kind: input.kind, createdAt: now.toISOString(), ...header, ids: [], undone: [], complete: false };
      await writeJournalFile(file, journal);
    },
    append: async (results) => {
      const ids = msGraphCliUndoJournalIds(results);

      if (journal && ids.length > 0) {
        journal = { ...journal, ids: [...journal.ids, ...ids] };
        await writeJournalFile(file, journal);
      }
    },
    finish: async () => {
      if (journal) {
        journal = { ...journal, complete: true };
        await writeJournalFile(file, journal);

        if (input.file == null) {
          await pruneMsGraphCliUndoJournals(input.configDir);
        }
      }
    }
  };
}

/**
 * What a move or delete adds to its output when it wrote a journal.
 */
export interface MsGraphCliUndoOutput {
  readonly file: string;
  /**
   * The command that moves the messages back.
   */
  readonly command: string;
}

const SHELL_QUOTE_ESCAPE = String.raw`'\''`;

function shellArgument(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", SHELL_QUOTE_ESCAPE)}'`;
}

/**
 * Builds the `undo` field of a move or delete's output.
 *
 * @param file - The journal file.
 * @param tokenSource - The run's `--token-source`, repeated in the command.
 * @returns The output field.
 */
export function msGraphCliUndoOutput(file: string, tokenSource?: Maybe<string>): MsGraphCliUndoOutput {
  const source = tokenSource ? ` --token-source ${shellArgument(tokenSource)}` : '';
  return { file, command: `${MSGRAPH_CLI_NAME} mail undo ${shellArgument(file)}${source}` };
}

// MARK: Read / list / prune
/**
 * Reads an undo journal.
 *
 * @param file - The journal file.
 * @returns The journal.
 * @throws {CliError} `NOT_FOUND` when the file does not exist, `INVALID_ARGUMENT` when it is not an undo journal.
 */
export async function readMsGraphCliUndoJournal(file: string): Promise<MsGraphCliUndoJournal> {
  let text: string;

  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CliError({ message: `No undo journal at ${file}.`, code: 'NOT_FOUND', suggestion: `Run ${MSGRAPH_CLI_NAME} mail undo --list to see the saved journals.` });
    }

    throw e;
  }

  let journal: Maybe<MsGraphCliUndoJournal>;

  try {
    journal = JSON.parse(text) as MsGraphCliUndoJournal;
  } catch {
    journal = undefined;
  }

  if (journal?.version !== MSGRAPH_CLI_UNDO_JOURNAL_VERSION || (journal.kind !== 'move' && journal.kind !== 'delete') || !Array.isArray(journal.ids)) {
    throw new CliError({ message: `${file} is not an msgraph-cli undo journal.`, code: 'INVALID_ARGUMENT', suggestion: `Pass a file from ${MSGRAPH_CLI_NAME} mail undo --list, or an output's undo.file.` });
  }

  return { ...journal, undone: journal.undone ?? [] };
}

async function journalFileNames(configDir: string): Promise<string[]> {
  let names: string[];

  try {
    names = await readdir(msGraphCliUndoDir(configDir));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      names = [];
    } else {
      throw e;
    }
  }

  // newest first: names start with the run's UTC time
  return names
    .filter((x) => x.endsWith('.json') && !x.startsWith('.'))
    .sort()
    .reverse();
}

/**
 * A journal in the undo folder.
 */
export interface MsGraphCliUndoJournalEntry {
  readonly file: string;
  readonly journal: MsGraphCliUndoJournal;
}

/**
 * Lists the journals in the undo folder, newest first. Unreadable files are skipped.
 *
 * @param configDir - The CLI config dir.
 * @returns The journals.
 */
export async function listMsGraphCliUndoJournals(configDir: string): Promise<MsGraphCliUndoJournalEntry[]> {
  const dir = msGraphCliUndoDir(configDir);
  const entries: MsGraphCliUndoJournalEntry[] = [];

  for (const name of await journalFileNames(configDir)) {
    const file = join(dir, name);

    try {
      entries.push({ file, journal: await readMsGraphCliUndoJournal(file) });
    } catch {
      // not a journal (or removed meanwhile); skip it
    }
  }

  return entries;
}

/**
 * Deletes all but the newest journals in the undo folder.
 *
 * @param configDir - The CLI config dir.
 * @param keep - How many to keep. Defaults to {@link MSGRAPH_CLI_UNDO_MAX_JOURNALS}.
 * @returns The files deleted.
 */
export async function pruneMsGraphCliUndoJournals(configDir: string, keep = MSGRAPH_CLI_UNDO_MAX_JOURNALS): Promise<string[]> {
  const dir = msGraphCliUndoDir(configDir);
  const pruned = (await journalFileNames(configDir)).slice(keep).map((x) => join(dir, x));

  for (const file of pruned) {
    await unlink(file).catch(() => undefined);
  }

  return pruned;
}

/**
 * The ids of a journal that `mail undo` has not moved back yet.
 *
 * @param journal - The journal.
 * @returns The pending ids, in order.
 */
export function msGraphCliUndoPendingIds(journal: Pick<MsGraphCliUndoJournal, 'ids' | 'undone'>): string[] {
  const undone = new Set(journal.undone);
  return journal.ids.filter((x) => !undone.has(x));
}

function isSameMailbox(a: Maybe<EmailAddress>, b: Maybe<EmailAddress>): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

/**
 * One row of `mail undo --list`.
 */
export interface MsGraphCliUndoListRow {
  readonly file: string;
  readonly kind: MsGraphCliUndoJournalKind;
  readonly createdAt: ISO8601DateString;
  readonly mailbox: Maybe<EmailAddress>;
  readonly from: Maybe<string>;
  readonly to: string;
  readonly count: number;
  readonly undone: number;
  readonly complete: boolean;
}

/**
 * Builds the rows of `mail undo --list`: the newest {@link MSGRAPH_CLI_UNDO_LIST_MAX} journals, of one mailbox when
 * given.
 *
 * @param entries - The journals, newest first.
 * @param mailbox - Only this mailbox's journals (`--mailbox`); every journal when absent.
 * @returns The rows.
 */
export function msGraphCliUndoListRows(entries: readonly MsGraphCliUndoJournalEntry[], mailbox?: Maybe<EmailAddress>): MsGraphCliUndoListRow[] {
  return entries
    .filter((x) => mailbox == null || isSameMailbox(x.journal.mailbox, mailbox))
    .slice(0, MSGRAPH_CLI_UNDO_LIST_MAX)
    .map(({ file, journal }) => ({
      file,
      kind: journal.kind,
      createdAt: journal.createdAt,
      mailbox: journal.mailbox ?? null,
      from: journal.source ? (journal.source.name ?? journal.source.id) : null,
      to: journal.destination.name ?? journal.destination.given,
      count: journal.ids.length,
      undone: journal.undone.length,
      complete: journal.complete
    }));
}

/**
 * Picks the journal `mail undo` acts on when none is given: the newest one (of `--mailbox`, when given) that still
 * has ids to move back.
 *
 * @param configDir - The CLI config dir.
 * @param mailbox - Only this mailbox's journals.
 * @returns The journal.
 * @throws {CliError} `NOT_FOUND` when there is none.
 */
export async function findMsGraphCliPendingUndoJournal(configDir: string, mailbox?: Maybe<EmailAddress>): Promise<MsGraphCliUndoJournalEntry> {
  const entry = (await listMsGraphCliUndoJournals(configDir)).find((x) => (mailbox == null || isSameMailbox(x.journal.mailbox, mailbox)) && msGraphCliUndoPendingIds(x.journal).length > 0);

  if (!entry) {
    const of = mailbox ? ` for ${mailbox}` : '';
    throw new CliError({ message: `No undo journal${of} has anything left to undo.`, code: 'NOT_FOUND', suggestion: `Run ${MSGRAPH_CLI_NAME} mail undo --list to see the saved journals, or restore by filter: mail move --folder deleteditems --from <addr> --to inbox.` });
  }

  return entry;
}

// MARK: Undo
/**
 * Input to {@link undoMsGraphCliJournal}.
 */
export interface UndoMsGraphCliJournalInput {
  readonly graphContext: MicrosoftGraphContext;
  readonly file: string;
  readonly journal: MsGraphCliUndoJournal;
  /**
   * `--to`: move the messages here instead of the journal's source. Required when the journal has no source.
   */
  readonly to?: Maybe<string>;
  /**
   * `--mailbox`: refused when it differs from the journal's mailbox.
   */
  readonly mailbox?: Maybe<EmailAddress>;
  readonly dryRun?: Maybe<boolean>;
  /**
   * The time budget in seconds; 0 turns it off. Defaults to {@link DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS}.
   */
  readonly maxSeconds?: Maybe<Seconds>;
  readonly startedAt: Milliseconds;
  /**
   * The clock. Defaults to `Date.now`; a spec passes a fake.
   */
  readonly now?: Maybe<() => Milliseconds>;
  readonly progress?: Maybe<(line: string) => void>;
  /**
   * Above this many results only the failed rows are listed; unset lists every row.
   */
  readonly maxRows?: Maybe<number>;
}

/**
 * What `mail undo` adds to the write results.
 */
export interface MsGraphCliUndoRunSummary {
  readonly file: string;
  readonly restoredTo: MsGraphCliUndoJournalFolder;
  /**
   * Ids still not moved back: cut off by the time budget, or failed (a 404 means the message was purged).
   */
  readonly remaining: number;
  /**
   * Whether every pending id was attempted (failures stay pending; re-run to retry them).
   */
  readonly complete: boolean;
}

/**
 * What `mail undo` prints.
 */
export type MsGraphCliUndoRunOutput = (MsGraphCliWriteResultsOutput & MsGraphCliUndoRunSummary) | (MsGraphCliWriteResultsOutput & { readonly file: string; readonly alreadyUndone: true }) | (MsGraphCliDryRunOutput & { readonly file: string; readonly restoredTo: MsGraphCliUndoJournalFolder; readonly toUndo: number });

/**
 * Moves a journal's messages back: its pending ids to `to` (or the journal's source), through `$batch`, within
 * the time budget. Each group's ok ids are recorded in the journal's `undone`, so a re-run continues where this one
 * stopped, and a fully undone journal answers `alreadyUndone: true`.
 *
 * @param input - The journal, the destination override and the budget.
 * @returns The output to print.
 * @throws {CliError} `INVALID_ARGUMENT` for a mailbox that differs from the journal's, or an ids-run journal without `--to`.
 */
export async function undoMsGraphCliJournal(input: UndoMsGraphCliJournalInput): Promise<MsGraphCliUndoRunOutput> {
  const { graphContext, file, journal } = input;

  if (input.mailbox != null && !isSameMailbox(input.mailbox, journal.mailbox)) {
    throw new CliError({ message: `This journal is for ${journal.mailbox ?? 'the signed-in mailbox'}, not ${input.mailbox}.`, code: 'INVALID_ARGUMENT', suggestion: "Drop --mailbox: mail undo uses the journal's mailbox." });
  }

  const pending = msGraphCliUndoPendingIds(journal);
  let result: MsGraphCliUndoRunOutput;

  if (pending.length === 0) {
    result = { ...msGraphCliWriteResultsOutput([]), file, alreadyUndone: true };
  } else {
    const destination = input.to ?? journal.source?.id;

    if (!destination) {
      throw new CliError({ message: 'This run took ids, so their folders are unknown: pass --to inbox (or another folder).', code: 'INVALID_ARGUMENT', suggestion: `e.g. ${MSGRAPH_CLI_NAME} mail undo ${shellArgument(file)} --to inbox` });
    }

    const restoredTo: MsGraphCliUndoJournalFolder = input.to == null && journal.source ? journal.source : { id: destination };
    const moveInput = { mailbox: journal.mailbox, immutableIds: journal.immutableIds, destination };

    if (input.dryRun) {
      const sample = pending.slice(0, MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE).map((id) => microsoftGraphMoveMessageRequest({ ...moveInput, id }));
      const shown = pending.length > sample.length ? `; only the first ${sample.length} of ${pending.length} requests are shown` : '';
      result = { ...msGraphCliDryRunOutput(sample, `A real run moves ${pending.length} message(s) back to ${restoredTo.name ?? restoredTo.id} through $batch, ${MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE} per HTTP call${shown}.`), file, restoredTo, toUndo: pending.length };
    } else {
      const deadline = msGraphCliRunDeadline({ maxSeconds: input.maxSeconds ?? DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS, startedAt: input.startedAt, now: input.now });
      let current = journal;

      const results = await runMsGraphCliMessageWrites({
        ids: pending,
        label: 'mail undo',
        progress: input.progress,
        groupSize: MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE,
        shouldStop: deadline.shouldStop,
        send: (ids) => moveMessages(graphContext)({ ...moveInput, ids, maxRetryAfterSeconds: msGraphCliSelectionMaxRetryAfterSeconds(deadline) }),
        afterGroup: async (group) => {
          // record the journal's own ids (not the moved-back ids), so pending stays ids − undone
          const ok = group.filter((x) => x.status >= 200 && x.status < 300).map((x) => x.id);

          if (ok.length > 0) {
            const undone = [...current.undone, ...ok];
            const done = msGraphCliUndoPendingIds({ ids: current.ids, undone }).length === 0;
            current = { ...current, undone, ...(done ? { undoneAt: new Date().toISOString() } : {}) };
            await writeJournalFile(file, current);
          }
        }
      });

      result = { ...msGraphCliWriteResultsOutput(results, { maxRows: input.maxRows }), file, restoredTo, remaining: msGraphCliUndoPendingIds(current).length, complete: results.length === pending.length };
    }
  }

  return result;
}
