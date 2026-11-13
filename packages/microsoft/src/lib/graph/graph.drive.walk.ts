import { type Maybe } from '@dereekb/util';
import { type MicrosoftGraphContext } from './graph.config';
import { DEFAULT_MICROSOFT_GRAPH_DRIVE_CHILDREN_TOP, MICROSOFT_GRAPH_DRIVE_ITEM_SYNC_SELECT, type MicrosoftGraphDriveInput, type MicrosoftGraphDriveItemSelect, microsoftGraphDriveChildrenPageInput } from './graph.drive.api';
import { microsoftGraphCollectPages } from './graph.page';
import { type MicrosoftGraphDriveItem } from './graph.type';

/**
 * Wraps one page read of a walk, e.g. to retry it or to re-authenticate.
 */
export type MicrosoftGraphDriveFolderWalkReadWrapper = <T>(read: () => Promise<T>) => Promise<T>;

/**
 * The folder to walk and how to read it.
 */
export interface MicrosoftGraphDriveFolderWalkInput extends MicrosoftGraphDriveInput {
  /**
   * The id of the folder to walk. Resolve a path with `getDriveItem` first.
   */
  readonly id: string;
  /**
   * The fields to read for each item. Defaults to {@link MICROSOFT_GRAPH_DRIVE_ITEM_SYNC_SELECT}.
   */
  readonly select?: Maybe<MicrosoftGraphDriveItemSelect>;
  /**
   * Items per page. Defaults to {@link DEFAULT_MICROSOFT_GRAPH_DRIVE_CHILDREN_TOP}.
   */
  readonly top?: Maybe<number>;
  /**
   * How deep to go. 1 reads only the folder's direct children. Unlimited when absent.
   */
  readonly maxDepth?: Maybe<number>;
  /**
   * Wraps every page read, e.g. with a retry and a token re-mint.
   */
  readonly wrapRead?: Maybe<MicrosoftGraphDriveFolderWalkReadWrapper>;
}

/**
 * One item a walk found.
 */
export interface MicrosoftGraphDriveFolderWalkEntry {
  readonly item: MicrosoftGraphDriveItem;
  /**
   * The id of the folder the item is in.
   */
  readonly parentId: string;
  /**
   * The remote names of the folders from the walked folder down to the item's parent. Empty for the walked
   * folder's direct children.
   */
  readonly path: readonly string[];
  /**
   * 1 for the walked folder's direct children.
   */
  readonly depth: number;
}

interface MicrosoftGraphDriveFolderWalkQueueEntry {
  readonly id: string;
  readonly path: readonly string[];
  readonly depth: number;
}

/**
 * Walks a drive folder breadth-first, one folder at a time, and yields every folder, file and package below it.
 * Each folder is read page by page across `@odata.nextLink`, so there is no cap on the number of children. Only
 * folders are walked into: a package (such as a OneNote notebook) is yielded but not opened.
 *
 * Requires `Files.Read` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that starts a walk.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
 *
 * @example
 * ```ts
 * for await (const { item, path } of microsoftGraphDriveFolderWalk(context)({ driveId, id: folderId })) {
 *   console.log([...path, item.name].join('/'));
 * }
 * ```
 */
export function microsoftGraphDriveFolderWalk(context: MicrosoftGraphContext): (input: MicrosoftGraphDriveFolderWalkInput) => AsyncGenerator<MicrosoftGraphDriveFolderWalkEntry> {
  const collect = microsoftGraphCollectPages(context);

  return async function* (input: MicrosoftGraphDriveFolderWalkInput) {
    const { driveId, maxDepth } = input;
    const select = input.select ?? MICROSOFT_GRAPH_DRIVE_ITEM_SYNC_SELECT;
    const top = input.top ?? DEFAULT_MICROSOFT_GRAPH_DRIVE_CHILDREN_TOP;
    const wrapRead: MicrosoftGraphDriveFolderWalkReadWrapper = input.wrapRead ?? ((read) => read());
    const queue: MicrosoftGraphDriveFolderWalkQueueEntry[] = [{ id: input.id, path: [], depth: 1 }];

    while (queue.length > 0) {
      const folder = queue.shift() as MicrosoftGraphDriveFolderWalkQueueEntry;
      const pageInput = microsoftGraphDriveChildrenPageInput({ driveId, id: folder.id, top, select });
      let nextLink: Maybe<string>;

      do {
        const link = nextLink;
        const page = await wrapRead(() => collect<MicrosoftGraphDriveItem>({ ...pageInput, nextLink: link, maxPages: 1 }));
        nextLink = page.nextLink;

        for (const item of page.items) {
          yield { item, parentId: folder.id, path: folder.path, depth: folder.depth };

          if (item.folder != null && (maxDepth == null || folder.depth < maxDepth)) {
            queue.push({ id: item.id, path: [...folder.path, item.name ?? item.id], depth: folder.depth + 1 });
          }
        }
      } while (nextLink);
    }
  };
}
