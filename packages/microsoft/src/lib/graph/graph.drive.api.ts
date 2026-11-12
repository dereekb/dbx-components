import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type MicrosoftGraphRequestInput, microsoftGraphRequest } from './graph.api';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphRawRequestInput, type MicrosoftGraphRawResponse, microsoftGraphRequestRaw } from './graph.raw.api';
import { type MicrosoftGraphDrive, type MicrosoftGraphDriveItem, type MicrosoftGraphPage, type MicrosoftGraphSite } from './graph.type';
import { microsoftGraphUploadSessionPut } from './graph.upload.api';

/**
 * Files up to this size upload with one PUT; larger ones through an upload session.
 */
export const MICROSOFT_GRAPH_DRIVE_SIMPLE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Every upload session chunk except the last must be a multiple of this size.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession#upload-bytes-to-the-upload-session
 */
export const MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MULTIPLE_BYTES = 320 * 1024;

/**
 * A chunk must stay under 60 MiB.
 */
export const MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MAX_BYTES = 60 * 1024 * 1024;

/**
 * The default chunk: 10 MiB, which is 32 × 320 KiB.
 */
export const DEFAULT_MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_BYTES = 32 * MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MULTIPLE_BYTES;

/**
 * What a name clash does: fail, pick a new name, or replace the existing item.
 */
export type MicrosoftGraphConflictBehavior = 'fail' | 'rename' | 'replace';

/**
 * The instance annotation that carries {@link MicrosoftGraphConflictBehavior}. It is a query parameter on a
 * simple upload, and a body field on a folder create and on an upload session's `item`.
 */
export const MICROSOFT_GRAPH_CONFLICT_BEHAVIOR_KEY = '@microsoft.graph.conflictBehavior';

/**
 * Rounds a requested chunk size down to a multiple of 320 KiB, at least 320 KiB and under 60 MiB.
 *
 * @param requested - The requested bytes per chunk. Defaults to 10 MiB.
 * @returns The chunk size to use.
 */
export function microsoftGraphDriveUploadChunkSize(requested?: Maybe<number>): number {
  const multiple = MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MULTIPLE_BYTES;
  const largest = Math.floor((MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MAX_BYTES - 1) / multiple) * multiple;
  const rounded = Math.floor((requested ?? DEFAULT_MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_BYTES) / multiple) * multiple;
  return Math.min(Math.max(rounded, multiple), largest);
}

// MARK: Addressing
/**
 * Which drive a call works in: a drive id (a SharePoint library, or another user's OneDrive), or the user's
 * own OneDrive when absent.
 */
export interface MicrosoftGraphDriveInput {
  readonly driveId?: Maybe<string>;
}

/**
 * An item in a drive, by id or by path from the drive root. Neither means the drive root.
 */
export interface MicrosoftGraphDriveItemRefInput extends MicrosoftGraphDriveInput {
  /**
   * The item id. Takes precedence over `path`.
   */
  readonly id?: Maybe<string>;
  /**
   * The item path from the drive root, e.g. `Documents/report.docx`.
   */
  readonly path?: Maybe<string>;
}

/**
 * Returns the root path of a drive.
 *
 * @param input - The drive.
 * @returns `/me/drive`, or `/drives/{id}`.
 */
export function microsoftGraphDrivePath(input: MicrosoftGraphDriveInput): string {
  return input.driveId ? `/drives/${encodeURIComponent(input.driveId)}` : '/me/drive';
}

/**
 * Encodes a drive path segment by segment, dropping leading and trailing slashes.
 *
 * @param path - The path, e.g. `/Documents/Q1 report.xlsx`.
 * @returns The encoded path, e.g. `Documents/Q1%20report.xlsx`.
 */
export function microsoftGraphEncodeDrivePath(path: string): string {
  return path
    .split('/')
    .filter((x) => x.length > 0)
    .map(encodeURIComponent)
    .join('/');
}

/**
 * Returns the path of a drive item, optionally followed by an action or navigation (`content`, `children`,
 * `copy`). Path addressing closes the path with a colon before the suffix (`root:/a/b:/content`).
 *
 * @param input - The drive and item.
 * @param suffix - The action or navigation.
 * @returns The path.
 */
export function microsoftGraphDriveItemPath(input: MicrosoftGraphDriveItemRefInput, suffix?: Maybe<string>): string {
  const drive = microsoftGraphDrivePath(input);
  const encodedPath = input.path ? microsoftGraphEncodeDrivePath(input.path) : '';
  let result: string;

  const slashSuffix = suffix ? '/' + suffix : '';

  if (input.id) {
    result = `${drive}/items/${encodeURIComponent(input.id)}${slashSuffix}`;
  } else if (encodedPath) {
    // path addressing closes the path with a colon before an action
    result = `${drive}/root:/${encodedPath}${suffix ? ':' + slashSuffix : ''}`;
  } else {
    result = `${drive}/root${slashSuffix}`;
  }

  return result;
}

/**
 * A new child of a folder: the folder by id or path (the root when neither), and the child's name.
 */
export interface MicrosoftGraphDriveChildInput extends MicrosoftGraphDriveInput {
  readonly parentId?: Maybe<string>;
  readonly parentPath?: Maybe<string>;
  readonly name: string;
}

/**
 * Returns the path of a not-yet-existing child followed by an action: `items/{parent}:/{name}:/content` or
 * `root:/{parentPath}/{name}:/createUploadSession`.
 *
 * @param input - The drive, parent and name.
 * @param action - The action, e.g. `content`.
 * @returns The path.
 */
export function microsoftGraphDriveChildPath(input: MicrosoftGraphDriveChildInput, action: string): string {
  const drive = microsoftGraphDrivePath(input);
  const name = encodeURIComponent(input.name);
  let result: string;

  if (input.parentId) {
    result = `${drive}/items/${encodeURIComponent(input.parentId)}:/${name}:/${action}`;
  } else {
    const parent = input.parentPath ? microsoftGraphEncodeDrivePath(input.parentPath) : '';
    const parentPrefix = parent ? parent + '/' : '';
    result = `${drive}/root:/${parentPrefix}${name}:/${action}`;
  }

  return result;
}

/**
 * Returns the Graph path that looks up a SharePoint site by its URL: `/sites/{host}:/{path}`, or
 * `/sites/{host}` for the root site.
 *
 * @param siteUrl - The site URL, e.g. `https://contoso.sharepoint.com/sites/Team`.
 * @returns The path.
 * @throws {Error} When the value is not an https URL.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/site-getbypath
 */
export function microsoftGraphSiteByUrlPath(siteUrl: string): string {
  let url: URL;

  try {
    url = new URL(siteUrl);
  } catch {
    throw new Error(`"${siteUrl}" is not a site URL, e.g. https://contoso.sharepoint.com/sites/Team.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`"${siteUrl}" must be an https URL.`);
  }

  const path = microsoftGraphEncodeDrivePath(decodeURIComponent(url.pathname));
  return path ? `/sites/${url.host}:/${path}` : `/sites/${url.host}`;
}

/**
 * Returns whether a drive is the library the caller named: by its name or the last segment of its URL
 * (`Shared Documents` is shown as `Documents`), ignoring case.
 *
 * @param drive - The drive.
 * @param library - The library name.
 * @returns Whether it matches.
 */
export function isMicrosoftGraphDriveNamed(drive: MicrosoftGraphDrive, library: string): boolean {
  const wanted = library.trim().toLowerCase();
  const urlName = drive.webUrl ? decodeURIComponent(drive.webUrl.replace(/\/+$/, '').split('/').pop() ?? '') : '';
  return drive.name?.toLowerCase() === wanted || urlName.toLowerCase() === wanted;
}

export interface MicrosoftGraphResolveSiteDriveInput {
  readonly siteUrl: string;
  /**
   * The document library's name. The site's default library when absent.
   */
  readonly library?: Maybe<string>;
}

/**
 * Thrown by {@link resolveSiteDrive} when the site has no library with the given name.
 */
export class MicrosoftGraphLibraryNotFoundError extends Error {
  readonly libraries: string[];

  constructor(library: string, libraries: string[]) {
    super(`The site has no document library named "${library}". Its libraries: ${libraries.join(', ') || '(none)'}.`);
    this.name = 'MicrosoftGraphLibraryNotFoundError';
    this.libraries = libraries;
  }
}

/**
 * Finds a SharePoint site's document library: the site through `/sites/{host}:/{path}`, then the library
 * among `/sites/{id}/drives`, or the site's default drive. Requires `Sites.Read.All`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves the drive.
 * @throws {MicrosoftGraphLibraryNotFoundError} When no library has the given name.
 */
export function resolveSiteDrive(context: MicrosoftGraphContext): (input: MicrosoftGraphResolveSiteDriveInput) => Promise<MicrosoftGraphDrive> {
  const request = microsoftGraphRequest(context);

  return async (input) => {
    const site = await request<MicrosoftGraphSite>({ method: 'GET', path: microsoftGraphSiteByUrlPath(input.siteUrl), query: { $select: 'id,name,webUrl' } });
    const sitePath = `/sites/${encodeURIComponent(site.id)}`;
    let drive: MicrosoftGraphDrive;

    if (input.library) {
      const library = input.library;
      const drives = await request<MicrosoftGraphPage<MicrosoftGraphDrive>>({ method: 'GET', path: `${sitePath}/drives`, query: { $select: 'id,name,driveType,webUrl' } });
      const match = drives.value.find((x) => isMicrosoftGraphDriveNamed(x, library));

      if (!match) {
        throw new MicrosoftGraphLibraryNotFoundError(
          library,
          drives.value.map((x) => x.name ?? x.id)
        );
      }

      drive = match;
    } else {
      drive = await request<MicrosoftGraphDrive>({ method: 'GET', path: `${sitePath}/drive`, query: { $select: 'id,name,driveType,webUrl' } });
    }

    return drive;
  };
}

// MARK: Read
export interface MicrosoftGraphSearchDriveItemsInput extends MicrosoftGraphDriveInput {
  readonly query: string;
  readonly top?: Maybe<number>;
}

/**
 * Searches a drive (`/me/drive/root/search`). Requires `Files.Read` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that searches the drive and resolves the first page of matches.
 */
export function searchDriveItems(context: MicrosoftGraphContext): (input: MicrosoftGraphSearchDriveItemsInput) => Promise<MicrosoftGraphPage<MicrosoftGraphDriveItem>> {
  const request = microsoftGraphRequest(context);

  return (input) => {
    // OData string literals escape a single quote by doubling it
    const q = input.query.replaceAll("'", "''");
    return request({ method: 'GET', path: `${microsoftGraphDrivePath(input)}/root/search(q='${encodeURIComponent(q)}')`, query: { $top: input.top ?? 25 } });
  };
}

export type MicrosoftGraphGetDriveItemInput = MicrosoftGraphDriveItemRefInput;

/**
 * Reads a drive item's metadata by id or by path. Requires `Files.Read` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads one drive item by id or path.
 * @throws {Error} When neither an id nor a path is given.
 */
export function getDriveItem(context: MicrosoftGraphContext): (input: MicrosoftGraphGetDriveItemInput) => Promise<MicrosoftGraphDriveItem> {
  const request = microsoftGraphRequest(context);

  return (input) => {
    if (!input.id && !input.path) {
      throw new Error('getDriveItem requires an id or a path.');
    }

    return request({ method: 'GET', path: microsoftGraphDriveItemPath(input) });
  };
}

/**
 * Builds the GET of a file's bytes. Graph answers 302 to a pre-authenticated URL, which fetch follows.
 *
 * @param input - The drive and item.
 * @returns The raw request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-get-content
 */
export function microsoftGraphDownloadDriveItemRequest(input: MicrosoftGraphDriveItemRefInput): MicrosoftGraphRawRequestInput {
  return { method: 'GET', path: microsoftGraphDriveItemPath(input, 'content') };
}

// MARK: Write requests
export interface MicrosoftGraphUploadDriveItemInput extends MicrosoftGraphDriveChildInput {
  readonly bytes: Uint8Array;
  readonly contentType?: Maybe<string>;
  readonly conflictBehavior?: Maybe<MicrosoftGraphConflictBehavior>;
}

/**
 * Builds the single PUT that uploads a small file. The conflict behavior is a query parameter here.
 *
 * @param input - The drive, parent, name, bytes and conflict behavior.
 * @returns The raw request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
 */
export function microsoftGraphSimpleUploadRequest(input: MicrosoftGraphUploadDriveItemInput): MicrosoftGraphRawRequestInput {
  return { method: 'PUT', path: microsoftGraphDriveChildPath(input, 'content'), query: { [MICROSOFT_GRAPH_CONFLICT_BEHAVIOR_KEY]: input.conflictBehavior }, body: input.bytes, contentType: input.contentType };
}

/**
 * Builds the POST that opens an upload session for a large file. The conflict behavior is a field of the
 * body's `item` here.
 *
 * @param input - The drive, parent, name and conflict behavior.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
 */
export function microsoftGraphCreateDriveUploadSessionRequest(input: Omit<MicrosoftGraphUploadDriveItemInput, 'bytes'>): MicrosoftGraphRequestInput {
  const item: Record<string, unknown> = { name: input.name };

  if (input.conflictBehavior) {
    item[MICROSOFT_GRAPH_CONFLICT_BEHAVIOR_KEY] = input.conflictBehavior;
  }

  return { method: 'POST', path: microsoftGraphDriveChildPath(input, 'createUploadSession'), body: { item } };
}

export interface MicrosoftGraphCreateFolderInput extends MicrosoftGraphDriveChildInput {
  /**
   * Defaults to `fail`.
   */
  readonly conflictBehavior?: Maybe<MicrosoftGraphConflictBehavior>;
}

/**
 * Builds the POST that creates a folder (Graph answers 201 with it). The conflict behavior is a body field.
 *
 * @param input - The drive, parent, name and conflict behavior.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-post-children
 */
export function microsoftGraphCreateFolderRequest(input: MicrosoftGraphCreateFolderInput): MicrosoftGraphRequestInput {
  return {
    method: 'POST',
    path: microsoftGraphDriveItemPath({ driveId: input.driveId, id: input.parentId, path: input.parentPath }, 'children'),
    body: { name: input.name, folder: {}, [MICROSOFT_GRAPH_CONFLICT_BEHAVIOR_KEY]: input.conflictBehavior ?? 'fail' }
  };
}

/**
 * Builds the PATCH that renames an item and/or moves it to another folder of the same drive. The item keeps
 * its id.
 *
 * @param input - The item, its new name and/or the destination folder id.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-move
 */
export function microsoftGraphUpdateDriveItemRequest(input: MicrosoftGraphDriveItemRefInput & { readonly name?: Maybe<string>; readonly parentId?: Maybe<string> }): MicrosoftGraphRequestInput {
  const body: Record<string, unknown> = {};

  if (input.name) {
    body['name'] = input.name;
  }

  if (input.parentId) {
    body['parentReference'] = { id: input.parentId };
  }

  return { method: 'PATCH', path: microsoftGraphDriveItemPath(input), body };
}

export interface MicrosoftGraphCopyDriveItemInput extends MicrosoftGraphDriveItemRefInput {
  /**
   * The destination folder id.
   */
  readonly parentId: string;
  /**
   * The destination drive. Copy, unlike move, can cross drives.
   */
  readonly parentDriveId?: Maybe<string>;
  /**
   * The copy's name. The source's name when absent.
   */
  readonly name?: Maybe<string>;
}

/**
 * Builds the POST that starts a copy (Graph answers 202 with the monitor URL in `Location`).
 *
 * @param input - The source, destination folder and drive, and new name.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-copy
 */
export function microsoftGraphCopyDriveItemRequest(input: MicrosoftGraphCopyDriveItemInput): MicrosoftGraphRequestInput {
  const parentReference: Record<string, string> = { id: input.parentId };

  if (input.parentDriveId) {
    parentReference['driveId'] = input.parentDriveId;
  }

  return { method: 'POST', path: microsoftGraphDriveItemPath(input, 'copy'), body: { parentReference, ...(input.name ? { name: input.name } : {}) } };
}

/**
 * Builds the delete of an item: DELETE to the recycle bin, or `permanentDelete` (unrecoverable) when `hard`.
 *
 * @param input - The item and whether to delete permanently.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-delete
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-permanentdelete
 */
export function microsoftGraphDeleteDriveItemRequest(input: MicrosoftGraphDriveItemRefInput & { readonly hard?: Maybe<boolean> }): MicrosoftGraphRequestInput {
  return input.hard ? { method: 'POST', path: microsoftGraphDriveItemPath(input, 'permanentDelete') } : { method: 'DELETE', path: microsoftGraphDriveItemPath(input) };
}

// MARK: Write executors
export interface MicrosoftGraphUploadDriveFileInput extends MicrosoftGraphUploadDriveItemInput {
  /**
   * Bytes per upload session chunk, rounded down to a multiple of 320 KiB. Defaults to 10 MiB.
   */
  readonly chunkSize?: Maybe<number>;
  readonly onProgress?: Maybe<(sent: number, total: number) => void>;
}

/**
 * Uploads a file: one PUT up to {@link MICROSOFT_GRAPH_DRIVE_SIMPLE_UPLOAD_MAX_BYTES}, else an upload session
 * whose chunks go out without an `Authorization` header. Requires `Files.ReadWrite` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that uploads and resolves the created item.
 * @throws {Error} When Graph answers the last PUT without the item.
 */
export function uploadDriveFile(context: MicrosoftGraphContext): (input: MicrosoftGraphUploadDriveFileInput) => Promise<MicrosoftGraphDriveItem> {
  const request = microsoftGraphRequest(context);
  const requestRaw = microsoftGraphRequestRaw(context);
  const putSession = microsoftGraphUploadSessionPut(context);

  return async (input) => {
    let response: Maybe<MicrosoftGraphRawResponse>;

    if (input.bytes.length <= MICROSOFT_GRAPH_DRIVE_SIMPLE_UPLOAD_MAX_BYTES) {
      response = await requestRaw(microsoftGraphSimpleUploadRequest(input));
    } else {
      const session = await request<{ readonly uploadUrl: string }>(microsoftGraphCreateDriveUploadSessionRequest(input));
      response = await putSession({ uploadUrl: session.uploadUrl, bytes: input.bytes, chunkSize: microsoftGraphDriveUploadChunkSize(input.chunkSize), onProgress: input.onProgress });
    }

    const item = response?.json<MicrosoftGraphDriveItem>();

    if (!item) {
      throw new Error(`Graph answered the upload of "${input.name}" without the created item.`);
    }

    return item;
  };
}

/**
 * Thrown by {@link moveDriveItem} when the destination is in another drive: Graph cannot move across drives.
 */
export class MicrosoftGraphCrossDriveMoveError extends Error {
  constructor() {
    super('Graph cannot move an item to another drive. Copy it to the other drive, then delete the original.');
    this.name = 'MicrosoftGraphCrossDriveMoveError';
  }
}

export interface MicrosoftGraphMoveDriveItemInput extends MicrosoftGraphDriveItemRefInput {
  /**
   * The destination folder id.
   */
  readonly parentId: string;
  /**
   * The destination folder's drive, when the caller knows it. A drive other than the item's is refused.
   */
  readonly parentDriveId?: Maybe<string>;
  readonly name?: Maybe<string>;
}

/**
 * Moves an item to another folder of the same drive. Requires `Files.ReadWrite` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that moves the item and resolves it.
 * @throws {MicrosoftGraphCrossDriveMoveError} When `parentDriveId` names another drive.
 */
export function moveDriveItem(context: MicrosoftGraphContext): (input: MicrosoftGraphMoveDriveItemInput) => Promise<MicrosoftGraphDriveItem> {
  const request = microsoftGraphRequest(context);

  return async (input) => {
    if (input.parentDriveId) {
      const sourceDriveId = input.driveId ?? (await request<MicrosoftGraphDrive>({ method: 'GET', path: '/me/drive', query: { $select: 'id' } })).id;

      if (sourceDriveId !== input.parentDriveId) {
        throw new MicrosoftGraphCrossDriveMoveError();
      }
    }

    return request(microsoftGraphUpdateDriveItemRequest(input));
  };
}

/**
 * A copy's progress as its monitor reports it.
 *
 * @see https://learn.microsoft.com/en-us/graph/long-running-actions-overview
 */
export interface MicrosoftGraphCopyStatus {
  /**
   * `notStarted`, `inProgress`, `completed`, `failed`, … or `accepted` before the first poll.
   */
  readonly status: string;
  readonly monitorUrl: Maybe<string>;
  readonly percentageComplete?: Maybe<number>;
  /**
   * The new item's id once the copy completed.
   */
  readonly resourceId?: Maybe<string>;
}

export interface MicrosoftGraphCopyDriveItemRunInput extends MicrosoftGraphCopyDriveItemInput {
  /**
   * Polls the monitor until the copy completes or fails.
   */
  readonly wait?: Maybe<boolean>;
  /**
   * Time between polls. Defaults to 1 second.
   */
  readonly pollInterval?: Maybe<Milliseconds>;
  /**
   * Stops polling after this long and returns the last status. Defaults to 2 minutes.
   */
  readonly maxWait?: Maybe<Milliseconds>;
  /**
   * Waits between polls; injectable for specs.
   */
  readonly sleep?: Maybe<(ms: Milliseconds) => Promise<void>>;
}

const MICROSOFT_GRAPH_COPY_DONE_STATUSES = new Set(['completed', 'failed', 'cancelled']);

/**
 * Starts a copy and, with `wait`, polls its monitor URL (pre-authenticated, so polled without a token)
 * until it completes. Requires `Files.ReadWrite` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that copies and resolves the copy's status.
 */
export function copyDriveItem(context: MicrosoftGraphContext): (input: MicrosoftGraphCopyDriveItemRunInput) => Promise<MicrosoftGraphCopyStatus> {
  const requestRaw = microsoftGraphRequestRaw(context);

  return async (input) => {
    const copy = microsoftGraphCopyDriveItemRequest(input);
    const started = await requestRaw({ method: copy.method, path: copy.path, body: JSON.stringify(copy.body), contentType: 'application/json' });
    const monitorUrl = started.headers['location'];
    let result: MicrosoftGraphCopyStatus = { status: 'accepted', monitorUrl };

    if (input.wait && monitorUrl) {
      const sleep = input.sleep ?? ((ms: Milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
      const pollInterval = input.pollInterval ?? 1000;
      const deadline = Date.now() + (input.maxWait ?? 120_000);

      do {
        const polled = await requestRaw({ method: 'GET', path: monitorUrl, authorize: false });
        const body = polled.json<{ readonly status?: string; readonly percentageComplete?: number; readonly resourceId?: string; readonly id?: string }>() ?? {};
        // a finished monitor may redirect to the new item itself, which carries an id and no status
        result = body.status ? { status: body.status, monitorUrl, percentageComplete: body.percentageComplete, resourceId: body.resourceId } : { status: 'completed', monitorUrl, percentageComplete: 100, resourceId: body.id };

        if (!MICROSOFT_GRAPH_COPY_DONE_STATUSES.has(result.status) && Date.now() < deadline) {
          await sleep(pollInterval);
        }
      } while (!MICROSOFT_GRAPH_COPY_DONE_STATUSES.has(result.status) && Date.now() < deadline);
    }

    return result;
  };
}
