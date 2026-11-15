import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type FakeTrelloContext, type FakeTrelloRequest, type TrelloAttachment, fakeTrelloContext } from '@dereekb/trello';
import { syncTrelloCardAttachments, trelloCardAttachmentFileName } from './trello.node.attachment';
import { sanitizeTrelloFileName } from './trello.node.file';

const CARD_ID = '5f0000000000000000000c01';
const FILE_ID = 'a0000000000000000000a001';
const OTHER_FILE_ID = 'a0000000000000000000a002';
const LINK_ID = 'a0000000000000000000a003';
const ORPHAN_ID = 'a0000000000000000000a0ff';

function attachment(x: Partial<TrelloAttachment> & Pick<TrelloAttachment, 'id'>): TrelloAttachment {
  return { idMember: 'm', name: '', fileName: '', url: '', bytes: null, mimeType: null, date: '2026-11-01T00:00:00.000Z', edgeColor: null, pos: 0, isUpload: true, previews: [], ...x };
}

function upload(id: string, fileName: string, bytes = 5): TrelloAttachment {
  return attachment({ id, name: fileName, fileName, bytes, mimeType: 'text/plain', url: `https://trello.com/download/${fileName}` });
}

const LINK = attachment({ id: LINK_ID, name: 'Spec doc', url: 'https://example.com/spec', isUpload: false });

describe('trelloCardAttachmentFileName()', () => {
  it('prefers fileName and falls back to name', () => {
    expect(trelloCardAttachmentFileName({ id: FILE_ID, name: 'Shown', fileName: 'shot.png' })).toBe(`${FILE_ID}__shot.png`);
    expect(trelloCardAttachmentFileName({ id: FILE_ID, name: 'Shown', fileName: '' })).toBe(`${FILE_ID}__Shown`);
  });

  it('names an attachment with an empty fileName and name <id>__attachment', () => {
    expect(trelloCardAttachmentFileName({ id: FILE_ID, name: '', fileName: '' })).toBe(`${FILE_ID}__attachment`);
  });

  it('falls back to the id when name is missing at runtime', () => {
    expect(trelloCardAttachmentFileName({ id: FILE_ID, fileName: '' } as Pick<TrelloAttachment, 'id' | 'name' | 'fileName'>)).toBe(`${FILE_ID}__${FILE_ID}`);
  });

  it('strips path separators, control characters and leading dots', () => {
    expect(trelloCardAttachmentFileName({ id: FILE_ID, name: '', fileName: '../evil' })).toBe(`${FILE_ID}__-evil`);
    expect(trelloCardAttachmentFileName({ id: FILE_ID, name: '', fileName: 'a\\b/c\u0007.txt' })).toBe(`${FILE_ID}__a-b-c.txt`);
    expect(trelloCardAttachmentFileName({ id: FILE_ID, name: '', fileName: '.hidden' })).toBe(`${FILE_ID}__hidden`);
  });
});

describe('sanitizeTrelloFileName()', () => {
  it('returns attachment when nothing is left', () => {
    expect(sanitizeTrelloFileName('')).toBe('attachment');
    expect(sanitizeTrelloFileName('...')).toBe('attachment');
    expect(sanitizeTrelloFileName(null)).toBe('attachment');
    expect(sanitizeTrelloFileName(undefined)).toBe('attachment');
  });
});

describe('syncTrelloCardAttachments()', () => {
  let dir: string;
  let attachments: TrelloAttachment[];
  let downloads: string[];
  let failingId: string | undefined;
  let fake: FakeTrelloContext;

  function sync(keepFile?: (fileName: string) => boolean) {
    return syncTrelloCardAttachments({ trelloContext: fake.trelloContext, cardId: CARD_ID, dir, keepFile });
  }

  function files(): string[] {
    return readdirSync(dir).sort();
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'trello-node-'));
    attachments = [];
    downloads = [];
    failingId = undefined;
    fake = fakeTrelloContext({
      routes: {
        [`GET /cards/${CARD_ID}/attachments`]: () => attachments,
        [`GET /cards/${CARD_ID}/attachments/*/download/*`]: (request: FakeTrelloRequest) => {
          downloads.push(request.path);
          return failingId != null && request.path.includes(failingId) ? new Response('nope', { status: 500 }) : new Response('hello');
        }
      }
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('downloads uploads, reports links, and carries each attachment', async () => {
    attachments = [upload(FILE_ID, 'notes.txt'), LINK];
    const result = await sync();
    const file = trelloCardAttachmentFileName(attachments[0]);

    expect(result.entries.map((x) => x.status)).toEqual(['downloaded', 'link']);
    expect(result.entries[0]).toEqual(expect.objectContaining({ attachmentId: FILE_ID, name: 'notes.txt', file, bytes: 5 }));
    expect(result.entries[0].attachment.mimeType).toBe('text/plain');
    expect(result.entries[0].attachment.bytes).toBe(5);
    expect(result.entries[1]).toEqual(expect.objectContaining({ attachmentId: LINK_ID, url: 'https://example.com/spec', attachment: LINK }));
    expect(readFileSync(join(dir, file), 'utf8')).toBe('hello');
    expect(files()).toEqual([file]);
    expect(result.removed).toEqual([]);
  });

  it('reports a file already on disk at the right size as cached', async () => {
    attachments = [upload(FILE_ID, 'notes.txt')];
    await sync();
    const second = await sync();

    expect(second.entries.map((x) => x.status)).toEqual(['cached']);
    expect(downloads).toHaveLength(1);
  });

  describe('a note beside an attachment still on the card', () => {
    it('survives a cached re-sync', async () => {
      attachments = [upload(FILE_ID, 'notes.txt')];
      const file = trelloCardAttachmentFileName(attachments[0]);
      await sync();
      writeFileSync(join(dir, `${file}.note.md`), 'my note');

      const second = await sync();

      expect(second.entries.map((x) => x.status)).toEqual(['cached']);
      expect(second.removed).toEqual([]);
      expect(readFileSync(join(dir, `${file}.note.md`), 'utf8')).toBe('my note');
    });

    it('survives a re-sync that downloads again', async () => {
      attachments = [upload(FILE_ID, 'notes.txt', 6)];
      const file = trelloCardAttachmentFileName(attachments[0]);
      await sync();
      writeFileSync(join(dir, `${file}.note.md`), 'my note');

      const second = await sync();

      expect(second.entries.map((x) => x.status)).toEqual(['downloaded']);
      expect(downloads).toHaveLength(2);
      expect(second.removed).toEqual([]);
      expect(readFileSync(join(dir, `${file}.note.md`), 'utf8')).toBe('my note');
    });

    it('survives beside a link attachment', async () => {
      attachments = [LINK];
      const note = `${trelloCardAttachmentFileName(LINK)}.note.md`;
      writeFileSync(join(dir, note), 'link note');

      const result = await sync();

      expect(result.removed).toEqual([]);
      expect(files()).toEqual([note]);
    });
  });

  it('removes the file and note of an attachment no longer on the card, and leaves files it does not own', async () => {
    const kept = upload(FILE_ID, 'notes.txt');
    const gone = upload(OTHER_FILE_ID, 'old.txt');
    attachments = [kept, gone];
    await sync();
    const goneFile = trelloCardAttachmentFileName(gone);
    writeFileSync(join(dir, `${goneFile}.note.md`), 'stale note');
    writeFileSync(join(dir, 'keep.md'), 'mine');
    writeFileSync(join(dir, 'x.partial'), 'mine');

    attachments = [kept];
    const result = await sync();

    expect([...result.removed].sort()).toEqual([goneFile, `${goneFile}.note.md`].sort());
    expect(files()).toEqual([trelloCardAttachmentFileName(kept), 'keep.md', 'x.partial'].sort());
  });

  it('replaces a renamed attachment, removing its old file and old note', async () => {
    attachments = [attachment({ id: FILE_ID, name: 'Before', bytes: 5 })];
    await sync();
    const oldFile = `${FILE_ID}__Before`;
    writeFileSync(join(dir, `${oldFile}.note.md`), 'old note');

    attachments = [attachment({ id: FILE_ID, name: 'After', bytes: 5 })];
    const result = await sync();

    expect(result.entries.map((x) => x.status)).toEqual(['downloaded']);
    expect([...result.removed].sort()).toEqual([oldFile, `${oldFile}.note.md`].sort());
    expect(files()).toEqual([`${FILE_ID}__After`]);
  });

  it('does not treat a longer name with the same start as a sibling', async () => {
    attachments = [attachment({ id: FILE_ID, name: 'Spec', bytes: 5 })];
    writeFileSync(join(dir, `${FILE_ID}__Spec-old`), 'stale');

    const result = await sync();

    expect(result.removed).toEqual([`${FILE_ID}__Spec-old`]);
  });

  it('removes a leftover partial download of a current attachment', async () => {
    attachments = [upload(FILE_ID, 'notes.txt')];
    const file = trelloCardAttachmentFileName(attachments[0]);
    await sync();
    writeFileSync(join(dir, `${file}.partial`), 'hel');

    const result = await sync();

    expect(result.entries.map((x) => x.status)).toEqual(['cached']);
    expect(result.removed).toEqual([`${file}.partial`]);
    expect(files()).toEqual([file]);
  });

  it('reports a failing download as an error and still downloads the others', async () => {
    attachments = [upload(FILE_ID, 'broken.txt'), upload(OTHER_FILE_ID, 'fine.txt')];
    failingId = FILE_ID;

    const result = await sync();

    expect(result.entries.map((x) => x.status)).toEqual(['error', 'downloaded']);
    expect(result.entries[0].error).toBeTruthy();
    expect(files()).toEqual([trelloCardAttachmentFileName(attachments[1])]);
    expect(existsSync(join(dir, `${trelloCardAttachmentFileName(attachments[0])}.partial`))).toBe(false);
  });

  it('keeps an orphan keepFile returns true for', async () => {
    const orphan = `${ORPHAN_ID}__kept.txt`;
    const dropped = `${ORPHAN_ID}__dropped.txt`;
    writeFileSync(join(dir, orphan), 'keep me');
    writeFileSync(join(dir, dropped), 'drop me');

    const result = await sync((fileName) => fileName === orphan);

    expect(result.removed).toEqual([dropped]);
    expect(files()).toEqual([orphan]);
  });
});
