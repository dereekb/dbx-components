import { mimeTypeForFileExtension, MimeTypeWithoutParameters, slashPathDetails, slashPathDirectoryTree, SlashPathDirectoryTreeNode, SlashPathDirectoryTreeNodeValue, SlashPathDirectoryTreeRoot } from '@dereekb/util';
import { BlobWriter, Entry, FileEntry } from '@zip.js/zip.js';
import { Maybe } from '@dereekb/util';
import { Getter } from '@dereekb/util';

export type DbxZipBlobPreviewEntryNodeValue<T extends Entry = Entry> = SlashPathDirectoryTreeNodeValue<T> & {
  readonly mimeType: Maybe<MimeTypeWithoutParameters>;
  readonly getBlob?: Getter<Promise<Blob>>;
};

export type DbxZipBlobPreviewEntryTreeNode<T extends Entry = Entry> = SlashPathDirectoryTreeNode<T, DbxZipBlobPreviewEntryNodeValue<T>>;
export type DbxZipBlobPreviewEntryTreeRoot = SlashPathDirectoryTreeRoot<Entry, DbxZipBlobPreviewEntryNodeValue<Entry>>;

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
