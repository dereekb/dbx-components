// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoAuthorizedUserAdminContext, demoGuestbookContext, demoGuestbookEntryContext, demoOAuthAuthorizedSuperTestContext } from 'demo-api/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase-server/test ships test-only fixtures; same pattern as `withDemoTestCli`.
import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
import { withDemoTestCli } from '../../test/fixture';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

interface ParsedCliEnvelope<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly code?: string;
  readonly suggestion?: string;
}

function parseCliJson<T>(stdoutText: string): ParsedCliEnvelope<T> {
  const trimmed = stdoutText.trim();
  // outputResult / outputError emit a JSON envelope on its own console.log line — pick the last
  // JSON line so we tolerate any incidental logs preceding it.
  const lastLine =
    trimmed
      .split('\n')
      .filter((s) => s.trim().startsWith('{'))
      .pop() ?? '{}';
  return JSON.parse(lastLine) as ParsedCliEnvelope<T>;
}

/**
 * OAuth fixture deliberately missing the `model.query` scope, used to prove that even an
 * admin user gets rejected when their token can't satisfy the scope pre-assert.
 */
const demoOAuthSuperTestContextWithoutQueryScope = oAuthAuthorizedSuperTestContextFactory({
  scopes: 'openid profile email demo offline_access model.read model.create model.update model.delete'
});

/**
 * Integration coverage for the demo-cli `action guestbook ...` surface introduced in
 * `refactor(dbx-cli): add ActionCommandSpec + callModel iterator`.
 *
 * Seeds Guestbooks/GuestbookEntries via the canonical `demoGuestbookContext` /
 * `demoGuestbookEntryContext` fixtures, then drives demo-cli in-process via
 * `runCli(['action', 'guestbook', ...])` so the assertions cover the full chain:
 * yargs argv parsing → ActionCommandSpec handler → iterateDbxCliCallModel →
 * `/api/model/call` → demo-api `guestbookEntry.query` / `guestbook.query` →
 * CliSuccessOutput envelope.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  // MARK: Happy path — admin caller with all callModel scopes
  demoAuthorizedUserAdminContext({ f }, (adminUser) => {
    // Extra user fixtures so we can seed multiple GuestbookEntries per parent (entries are
    // keyed by uid, so one entry per user per guestbook).
    demoAuthorizedUserContext({ f }, (secondaryUser) => {
      demoAuthorizedUserContext({ f }, (tertiaryUser) => {
        demoOAuthAuthorizedSuperTestContext({ f, u: adminUser }, (oauth) => {
          withDemoTestCli({ f, oauth }, ({ runCli }) => {
            describe('demo-cli action guestbook entries <guestbook>', () => {
              describe('with two published entries from two users', () => {
                demoGuestbookContext({ f, name: 'CLI Entries — All', published: true }, (g) => {
                  demoGuestbookEntryContext({ f, u: adminUser, g, message: 'first', published: true }, () => {
                    demoGuestbookEntryContext({ f, u: secondaryUser, g, message: 'second', published: true }, () => {
                      it('returns all entries for the guestbook and aggregates the count', async () => {
                        const result = await runCli(['action', 'guestbook', 'entries', g.documentKey]);

                        expect(result.error).toBeUndefined();
                        expect(result.exitCode).toBeUndefined();

                        const envelope = parseCliJson<{ readonly guestbook: string; readonly count: number; readonly entries: ReadonlyArray<{ readonly message: string; readonly published: boolean }> }>(result.stdoutText);
                        expect(envelope.ok).toBe(true);
                        expect(envelope.data?.guestbook).toBe(g.documentKey);
                        expect(envelope.data?.count).toBe(2);
                        const messages = (envelope.data?.entries ?? []).map((e) => e.message).sort();
                        expect(messages).toEqual(['first', 'second']);
                      });
                    });
                  });
                });
              });

              describe('with one published and one unpublished entry', () => {
                demoGuestbookContext({ f, name: 'CLI Entries — Filter', published: true }, (g) => {
                  demoGuestbookEntryContext({ f, u: adminUser, g, message: 'published-message', published: true }, () => {
                    demoGuestbookEntryContext({ f, u: secondaryUser, g, message: 'unpublished-message', published: false }, () => {
                      it('filters to published entries only when --published is passed', async () => {
                        const result = await runCli(['action', 'guestbook', 'entries', g.documentKey, '--published']);

                        expect(result.error).toBeUndefined();
                        const envelope = parseCliJson<{ readonly count: number; readonly entries: ReadonlyArray<{ readonly message: string; readonly published: boolean }> }>(result.stdoutText);
                        expect(envelope.ok).toBe(true);
                        expect(envelope.data?.count).toBe(1);
                        expect(envelope.data?.entries[0].message).toBe('published-message');
                        expect(envelope.data?.entries[0].published).toBe(true);
                      });
                    });
                  });
                });
              });

              describe('with three published entries', () => {
                demoGuestbookContext({ f, name: 'CLI Entries — Limit', published: true }, (g) => {
                  demoGuestbookEntryContext({ f, u: adminUser, g, message: 'limit-1', published: true }, () => {
                    demoGuestbookEntryContext({ f, u: secondaryUser, g, message: 'limit-2', published: true }, () => {
                      demoGuestbookEntryContext({ f, u: tertiaryUser, g, message: 'limit-3', published: true }, () => {
                        it('respects --limit and caps the returned entries', async () => {
                          const result = await runCli(['action', 'guestbook', 'entries', g.documentKey, '--limit', '2']);

                          expect(result.error).toBeUndefined();
                          const envelope = parseCliJson<{ readonly count: number; readonly entries: ReadonlyArray<unknown> }>(result.stdoutText);
                          expect(envelope.ok).toBe(true);
                          expect(envelope.data?.count).toBe(2);
                          expect(envelope.data?.entries).toHaveLength(2);
                        });
                      });
                    });
                  });
                });
              });
            });

            describe('demo-cli action guestbook all-published-entries', () => {
              describe('with two published guestbooks, each with at least one published entry', () => {
                demoGuestbookContext({ f, name: 'All-Pub A', published: true }, (gA) => {
                  demoGuestbookContext({ f, name: 'All-Pub B', published: true }, (gB) => {
                    demoGuestbookEntryContext({ f, u: adminUser, g: gA, message: 'a-pub', published: true }, () => {
                      demoGuestbookEntryContext({ f, u: secondaryUser, g: gA, message: 'a-unpub', published: false }, () => {
                        demoGuestbookEntryContext({ f, u: adminUser, g: gB, message: 'b-pub', published: true }, () => {
                          it("paginates every published guestbook and gathers each one's published entries", async () => {
                            const result = await runCli(['action', 'guestbook', 'all-published-entries']);

                            expect(result.error).toBeUndefined();
                            const envelope = parseCliJson<{
                              readonly guestbookCount: number;
                              readonly entryCount: number;
                              readonly perGuestbook: ReadonlyArray<{ readonly guestbook: string; readonly count: number; readonly entries: ReadonlyArray<{ readonly message: string }> }>;
                            }>(result.stdoutText);

                            expect(envelope.ok).toBe(true);
                            expect(envelope.data?.guestbookCount).toBeGreaterThanOrEqual(2);

                            const summaryForA = envelope.data?.perGuestbook.find((s) => s.guestbook === gA.documentKey);
                            const summaryForB = envelope.data?.perGuestbook.find((s) => s.guestbook === gB.documentKey);

                            // gA has one published entry (a-pub) and one unpublished entry (a-unpub).
                            // The child query filters to published=true, so only a-pub is gathered.
                            expect(summaryForA?.count).toBe(1);
                            expect(summaryForA?.entries[0].message).toBe('a-pub');
                            expect(summaryForB?.count).toBe(1);
                            expect(summaryForB?.entries[0].message).toBe('b-pub');
                          });
                        });
                      });
                    });
                  });
                });
              });

              it('returns an empty perGuestbook list when --limit 0 is passed', async () => {
                const result = await runCli(['action', 'guestbook', 'all-published-entries', '--limit', '0']);

                expect(result.error).toBeUndefined();
                const envelope = parseCliJson<{ readonly guestbookCount: number; readonly entryCount: number; readonly perGuestbook: ReadonlyArray<unknown> }>(result.stdoutText);
                expect(envelope.ok).toBe(true);
                expect(envelope.data?.guestbookCount).toBe(0);
                expect(envelope.data?.entryCount).toBe(0);
                expect(envelope.data?.perGuestbook).toEqual([]);
              });
            });
          });
        });
      });
    });
  });

  // MARK: Auth — non-admin caller can't filter by `--no-published` (admin-only flag value)
  describe('non-admin caller', () => {
    demoAuthorizedUserContext({ f }, (nonAdminUser) => {
      demoOAuthAuthorizedSuperTestContext({ f, u: nonAdminUser }, (oauth) => {
        withDemoTestCli({ f, oauth }, ({ runCli }) => {
          demoGuestbookContext({ f, name: 'NonAdmin Test', published: true }, (g) => {
            demoGuestbookEntryContext({ f, u: nonAdminUser, g, message: 'public-entry', published: true }, () => {
              it('rejects --no-published with AUTH_FORBIDDEN because non-admins cannot query unpublished entries', async () => {
                const result = await runCli(['action', 'guestbook', 'entries', g.documentKey, '--no-published']);

                expect(result.exitCode).toBe(1);
                const envelope = parseCliJson<unknown>(result.stdoutText);
                expect(envelope.ok).toBe(false);
                expect(envelope.code).toBe('AUTH_FORBIDDEN');
                expect(envelope.error ?? '').toMatch(/Users can only search published guestbook entries\./);
              });
            });
          });
        });
      });
    });
  });

  // MARK: Auth — admin caller, but their OIDC token is missing the `model.query` scope
  describe('admin caller with token missing model.query scope', () => {
    demoAuthorizedUserAdminContext({ f }, (adminUser) => {
      demoOAuthSuperTestContextWithoutQueryScope({ f, u: adminUser }, (oauth) => {
        withDemoTestCli({ f, oauth }, ({ runCli }) => {
          demoGuestbookContext({ f, name: 'MissingScope Test', published: true }, (g) => {
            demoGuestbookEntryContext({ f, u: adminUser, g, message: 'irrelevant', published: true }, () => {
              it('rejects `action guestbook entries <key>` with AUTH_FORBIDDEN + missing-scope error message', async () => {
                const result = await runCli(['action', 'guestbook', 'entries', g.documentKey]);

                expect(result.exitCode).toBe(1);
                const envelope = parseCliJson<unknown>(result.stdoutText);
                expect(envelope.ok).toBe(false);
                expect(envelope.code).toBe('AUTH_FORBIDDEN');
                expect(envelope.error ?? '').toMatch(/Missing required OIDC scope for callModel: model\.query/);
              });

              it('rejects `action guestbook all-published-entries` with the same missing-scope error', async () => {
                const result = await runCli(['action', 'guestbook', 'all-published-entries']);

                expect(result.exitCode).toBe(1);
                const envelope = parseCliJson<unknown>(result.stdoutText);
                expect(envelope.ok).toBe(false);
                expect(envelope.code).toBe('AUTH_FORBIDDEN');
                expect(envelope.error ?? '').toMatch(/Missing required OIDC scope for callModel: model\.query/);
              });
            });
          });
        });
      });
    });
  });
});
