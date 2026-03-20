import { mimeTypeForFileExtension, type MimeTypeWithoutParameters, slashPathDetails, slashPathDirectoryTree, type SlashPathDirectoryTreeNode, type SlashPathDirectoryTreeNodeValue, type SlashPathDirectoryTreeRoot, type Maybe, type Getter } from '@dereekb/util';
import { BlobWriter, type Entry, type FileEntry } from '@zip.js/zip.js';

/**
 * Extends {@link SlashPathDirectoryTreeNodeValue} with MIME type detection and optional blob retrieval for a zip archive entry.
 */
export type DbxZipBlobPreviewEntryNodeValue<T extends Entry = Entry> = SlashPathDirectoryTreeNodeValue<T> & {
  readonly mimeType: Maybe<MimeTypeWithoutParameters>;
  readonly getBlob?: Getter<Promise<Blob>>;
};

/**
 * Tree node representing a single entry (file or directory) within a zip archive preview.
 */
export type DbxZipBlobPreviewEntryTreeNode<T extends Entry = Entry> = SlashPathDirectoryTreeNode<T, DbxZipBlobPreviewEntryNodeValue<T>>;

/**
 * Root node of the directory tree built from zip archive entries.
 */
export type DbxZipBlobPreviewEntryTreeRoot = SlashPathDirectoryTreeRoot<Entry, DbxZipBlobPreviewEntryNodeValue<Entry>>;

/**
 * Builds a directory tree from an array of zip archive entries, enriching each node with MIME type detection and blob retrieval capability.
 *
 * @param entries - Array of zip archive entries to build the tree from, or null/undefined for an empty tree
 * @returns The root node of the constructed directory tree with MIME types and blob getters attached
 *
 * @example
 * ```typescript
 * const root = dbxZipBlobPreviewEntryTreeFromEntries(zipEntries);
 * // root.children contains the top-level files and directories
 * ```
 */
export function dbxZipBlobPreviewEntryTreeFromEntries(entries: Maybe<Entry[]>): DbxZipBlobPreviewEntryTreeRoot {
  const nodeValues: DbxZipBlobPreviewEntryNodeValue[] = (entries ?? []).map((value) => {
    const nodeSlashPathDetails = slashPathDetails(value.filename);
    const mimeType = mimeTypeForFileExtension(nodeSlashPathDetails.typedFileExtension);

    return {
      value,
      mimeType,
      slashPathDetails: nodeSlashPathDetails,
      getBlob: (value as FileEntry).getData ? () => (value as FileEntry).getData(new BlobWriter(mimeType ?? undefined)) : undefined
    };
  });

  return slashPathDirectoryTree(nodeValues);
}
