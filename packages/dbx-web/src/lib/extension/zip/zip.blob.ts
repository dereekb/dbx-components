import { slashPathDetails, slashPathDirectoryTree, SlashPathDirectoryTreeNodeValue, SlashPathDirectoryTreeRoot } from '@dereekb/util';
import { Entry } from '@zip.js/zip.js';

export type DbxZipBlobPreviewEntryNodeValue = SlashPathDirectoryTreeNodeValue<Entry>;
export type DbxZipBlobPreviewEntryTreeRoot = SlashPathDirectoryTreeRoot<Entry>;

export function dbxZipBlobPreviewEntryTreeNodeFromEntries(entries: Entry[]): DbxZipBlobPreviewEntryTreeRoot {
  const nodeValues: DbxZipBlobPreviewEntryNodeValue[] = entries.map((value) => {
    return {
      value,
      slashPathDetails: slashPathDetails(value.filename)
    };
  });

  return slashPathDirectoryTree(nodeValues);
}
