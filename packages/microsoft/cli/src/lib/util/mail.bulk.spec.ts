import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { microsoftGraphFactory } from '@dereekb/microsoft';
import { MS_IN_MINUTE } from '@dereekb/util';
import { MSGRAPH_CLI_BULK_MAX_PER_MINUTE, msGraphCliBulkRowKey, msGraphCliSendPacer, parseMsGraphCliBulkRecipients, parseMsGraphCliCsv, planMsGraphCliBulkSend, readMsGraphCliBulkProgress, renderMsGraphCliTemplate, sendMsGraphCliBulkMail } from './mail.bulk';

function fakeClock() {
  let time = 0;
  const waits: number[] = [];

  return {
    now: () => time,
    wait: async (ms: number) => {
      waits.push(ms);
      time += Math.max(ms, 0);
    },
    advance: (ms: number) => {
      time += ms;
    },
    waits
  };
}

const TEMPLATE = { subject: 'Hi {{name}}', body: 'Hello {{name}}, your code is {{code}}.', html: false };

describe('parseMsGraphCliBulkRecipients()', () => {
  it('reads a CSV with quoted cells and ;-separated addresses', () => {
    expect(parseMsGraphCliCsv('a,"b, ""c"""\r\n1,2\n\n')).toEqual([
      ['a', 'b, "c"'],
      ['1', '2']
    ]);

    const rows = parseMsGraphCliBulkRecipients('to,cc,name\n"ada@example.com;bob@example.com",,Ada\ngrace@example.com,lead@example.com,Grace\n', 'csv');
    expect(rows).toEqual([
      { index: 0, to: ['ada@example.com', 'bob@example.com'], cc: [], fields: { to: 'ada@example.com, bob@example.com', cc: '', name: 'Ada' } },
      { index: 1, to: ['grace@example.com'], cc: ['lead@example.com'], fields: { to: 'grace@example.com', cc: 'lead@example.com', name: 'Grace' } }
    ]);
  });

  it('reads JSON rows with a to array', () => {
    const rows = parseMsGraphCliBulkRecipients(JSON.stringify([{ to: ['ada@example.com'], name: 'Ada', code: 7 }]), 'json');
    expect(rows[0]).toEqual({ index: 0, to: ['ada@example.com'], cc: [], fields: { to: 'ada@example.com', name: 'Ada', code: '7' } });
  });

  it('refuses a bcc column and a row without to', () => {
    expect(() => parseMsGraphCliBulkRecipients('to,bcc\nada@example.com,x@example.com\n', 'csv')).toThrow(/Bcc-blasts/);
    expect(() => parseMsGraphCliBulkRecipients('to,name\n,Ada\n', 'csv')).toThrow(/no "to"/);
  });
});

describe('renderMsGraphCliTemplate()', () => {
  it('fills placeholders, escaping values in HTML', () => {
    expect(renderMsGraphCliTemplate('Hi {{ name }}', { name: '<Ada>' }, true)).toBe('Hi &lt;Ada&gt;');
    expect(renderMsGraphCliTemplate('Hi {{name}}', { name: '<Ada>' }, false)).toBe('Hi <Ada>');
  });

  it('refuses a placeholder no column provides', () => {
    const error = (() => {
      try {
        return renderMsGraphCliTemplate('Hi {{name}} {{missing}}', { name: 'Ada' }, false);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toContain('missing');
  });
});

describe('msGraphCliSendPacer()', () => {
  it('holds sends to 30 within any minute', async () => {
    // models: exchange-online-limits — 30 messages per minute per mailbox
    const clock = fakeClock();
    const pacer = msGraphCliSendPacer({ maxPerWindow: MSGRAPH_CLI_BULK_MAX_PER_MINUTE, windowMs: MS_IN_MINUTE, now: clock.now, wait: clock.wait });

    await pacer.acquire(10);
    clock.advance(1000);
    await pacer.acquire(10);
    clock.advance(1000);
    await pacer.acquire(10);
    expect(clock.waits).toEqual([]);

    // the first 10 leave the window at t=60s
    await pacer.acquire(10);
    expect(clock.waits).toEqual([MS_IN_MINUTE - 2000]);
    expect(clock.now()).toBe(MS_IN_MINUTE);

    await expect(pacer.acquire(31)).rejects.toThrow();
  });
});

describe('bulk send', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-bulk-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function rows(count: number) {
    return parseMsGraphCliBulkRecipients(JSON.stringify(Array.from({ length: count }, (_, i) => ({ to: `user${i}@example.com`, name: `User ${i}`, code: String(i) }))), 'json');
  }

  it('refuses more than 500 left without --limit, and plans --limit rows', () => {
    const progress = { version: 1, sent: {} };
    expect(() => planMsGraphCliBulkSend({ rows: rows(501), progress, template: TEMPLATE })).toThrow(/--limit/);

    const plan = planMsGraphCliBulkSend({ rows: rows(501), progress, template: TEMPLATE, limit: 5 });
    expect(plan.toSend).toHaveLength(5);
    expect(plan.deferred).toBe(496);
    expect(plan.toSend[0].request.body).toEqual({
      message: { subject: 'Hi User 0', body: { contentType: 'text', content: 'Hello User 0, your code is 0.' }, toRecipients: [{ emailAddress: { address: 'user0@example.com' } }] },
      saveToSentItems: true
    });
  });

  it('sends one message per row in paced $batch calls, writes progress and resumes', async () => {
    const batches: { url: string }[][] = [];
    const { graphContext } = microsoftGraphFactory({
      fetchHandler: async (request) => {
        const body = (await request.json()) as { requests: { id: string; url: string }[] };
        batches.push(body.requests);
        // models: json-batching — per-item status; sendMail answers 202 with no body
        const responses = body.requests.map((x) => (batches.length === 1 && x.id === '1' ? { id: x.id, status: 400, body: { error: { code: 'ErrorInvalidRecipients', message: 'bad' } } } : { id: x.id, status: 202 }));
        return new Response(JSON.stringify({ responses }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    })({ accessTokenGetter: () => 'token' });

    const clock = fakeClock();
    const pacer = msGraphCliSendPacer({ maxPerWindow: MSGRAPH_CLI_BULK_MAX_PER_MINUTE, windowMs: MS_IN_MINUTE, now: clock.now, wait: clock.wait });
    const progressFile = join(dir, 'progress.json');
    const all = rows(35);
    const plan = planMsGraphCliBulkSend({ rows: all, progress: await readMsGraphCliBulkProgress(progressFile), template: TEMPLATE });

    const result = await sendMsGraphCliBulkMail({ graphContext, plan, progress: { version: 1, sent: {} }, progressFile, pacer, now: clock.now });

    expect(batches.map((x) => x.length)).toEqual([10, 10, 10, 5]);
    expect(batches.flat().every((x) => x.url === '/me/sendMail')).toBe(true);
    // the 4th batch waited for the first to leave the minute window
    expect(clock.waits).toEqual([MS_IN_MINUTE]);
    expect(result).toEqual({ rows: 35, alreadySent: 0, sent: 34, failed: 1, remaining: 1, progressFile, failures: [{ row: 2, status: 400, code: 'ErrorInvalidRecipients', message: 'bad' }] });
    expect(JSON.stringify(result)).not.toContain('@example.com');

    const saved = JSON.parse(readFileSync(progressFile, 'utf8')) as { sent: Record<string, string> };
    expect(Object.keys(saved.sent)).toHaveLength(34);
    expect(saved.sent[msGraphCliBulkRowKey(all[1])]).toBeUndefined();

    // a re-run sends only the failed row
    const resumed = planMsGraphCliBulkSend({ rows: all, progress: await readMsGraphCliBulkProgress(progressFile), template: TEMPLATE });
    expect(resumed.alreadySent).toBe(34);
    expect(resumed.toSend.map((x) => x.row.index)).toEqual([1]);
  });
});
