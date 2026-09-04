import { describe, expect, it } from 'vitest';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { BAD_REQUEST_ERROR_CODE, FORBIDDEN_ERROR_CODE, MODEL_NOT_AVAILABLE_ERROR_CODE, type OnCallQueryModelResult, firestoreModelKey, onCallCreateModelParams, onCallQueryModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { type OpenRouterModelConfig } from '@dereekb/openrouter';
import { type CreateOpenRouterPromptVersionResult, type OpenRouterPrompt, OpenRouterPromptState, type UpdateOpenRouterPromptVersionResult, openRouterPromptIdentity, openRouterPromptVersionId, openRouterPromptVersionIdentity } from '@dereekb/openrouter/firebase';
import { demoOpenRouterPromptDefinitions } from '../../common/model/openrouter/openrouter.definitions';
import { DEMO_API_TEST_OPENROUTER_MODEL_CONFIG, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoOpenRouterPromptContext, demoOpenRouterPromptVersionContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

/**
 * The prompt registry demo-api actually ships, which is what every seed case runs against.
 *
 * Nothing fabricated: a copy of these at a later declared version is exactly what a deploy that edits
 * a prompt produces, which is the only thing the version cases need.
 */
const demoPromptDefinitions = demoOpenRouterPromptDefinitions();
const [demoPromptDefinition] = demoPromptDefinitions;

/**
 * The same registry as a later deploy would carry it.
 */
const bumpedPromptVersion = demoPromptDefinition.version + 2;
const bumpedPromptDefinitions = demoPromptDefinitions.map((x) => ({ ...x, version: bumpedPromptVersion }));

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('openrouter.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (au) => {
      // No specifier on any of the calls below: crud.functions.ts registers the openrouter operations
      // bare, so the params carry a model type and nothing more.
      describe('openRouterPromptVersion.create', () => {
        demoOpenRouterPromptContext({ f }, (p) => {
          it('should publish the first version and promote it when asked', async () => {
            const result = (await au.callWrappedFunction(
              demoCallModelWrappedFn,
              onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: p.documentKey, instructions: 'You are a test.', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown>, activate: true })
            )) as CreateOpenRouterPromptVersionResult;

            expect(result.version).toBe(1);
            expect(result.activated).toBe(true);
            expect(result.warnings).toEqual([]);
            // The version document's own path, not the prompt's — a create reports what it created.
            expect(result.modelKeys[0]).toContain(openRouterPromptVersionId(1));

            const prompt = await p.loadPrompt();
            expect(prompt.lv).toBe(1);
            expect(prompt.av).toBe(1);
            expect(prompt.s).toBe(OpenRouterPromptState.ACTIVE);
          });

          it('should not promote the version when activate is omitted', async () => {
            await au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: p.documentKey, instructions: 'You are a test.', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown> }));

            const prompt = await p.loadPrompt();
            expect(prompt.lv).toBe(1);
            expect(prompt.av).toBeUndefined();
            expect(prompt.s).toBe(OpenRouterPromptState.DRAFT);
          });

          it('should lock the version it succeeds', async () => {
            await au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: p.documentKey, instructions: 'v1', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown> }));
            const second = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: p.documentKey, instructions: 'v2', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown> }))) as CreateOpenRouterPromptVersionResult;

            expect(second.version).toBe(2);
            expect((await p.loadVersion(1))?.lk).toBe(true);
            expect((await p.loadVersion(2))?.lk).toBeFalsy();
          });

          itShouldFail('when the config names no model', async () => {
            // A plain Error rather than an HttpsError: the action refuses on its own terms, so there is
            // no server error code to assert against.
            await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: p.documentKey, instructions: 'You are a test.', config: {} })));
          });

          demoAuthorizedUserContext({ f }, (u) => {
            itShouldFail('with FORBIDDEN for a non-admin', async () => {
              // A prompt has no owner to relate a role to, so the role map grants a non-admin nothing.
              await expectFail(
                () => u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: p.documentKey, instructions: 'You are a test.', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown> })),
                expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE)
              );
            });
          });
        });

        itShouldFail('with MODEL_NOT_AVAILABLE for a prompt that does not exist', async () => {
          await expectFail(
            () => au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: firestoreModelKey(openRouterPromptIdentity, 'no-such-prompt'), instructions: 'You are a test.', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown> })),
            expectFailAssertHttpErrorServerErrorCode(MODEL_NOT_AVAILABLE_ERROR_CODE)
          );
        });
      });

      describe('openRouterPromptVersion.update', () => {
        demoOpenRouterPromptContext({ f }, (p) => {
          describe('the head version', () => {
            demoOpenRouterPromptVersionContext({ f, p }, (v) => {
              it('should edit the head version in place, keyed by what the create returned', async () => {
                const result = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptVersionIdentity, { key: v.documentKey, instructions: 'You are an edited test.', notes: 'Reworded.' }))) as UpdateOpenRouterPromptVersionResult;

                expect(result.warnings).toEqual([]);

                const version = await v.loadVersion();
                expect(version.i).toBe('You are an edited test.');
                expect(version.nt).toBe('Reworded.');
                // Untouched fields are left as they were rather than cleared.
                expect(version.c).toEqual(DEMO_API_TEST_OPENROUTER_MODEL_CONFIG);
              });

              demoAuthorizedUserContext({ f }, (u) => {
                itShouldFail('with FORBIDDEN for a non-admin', async () => {
                  await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptVersionIdentity, { key: v.documentKey, instructions: 'not yours' })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                });
              });
            });
          });

          // The second version is what locks the first, so it gets its own suite: a context stages its
          // version for every test in the one it is declared in.
          describe('a version a newer one has locked', () => {
            demoOpenRouterPromptVersionContext({ f, p, instructions: 'v1' }, (first) => {
              demoOpenRouterPromptVersionContext({ f, p, instructions: 'v2' }, () => {
                itShouldFail('when the version has been locked by a newer one', async () => {
                  await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptVersionIdentity, { key: first.documentKey, instructions: 'edited after the lock' })));
                });
              });
            });
          });
        });

        itShouldFail('with BAD_REQUEST when no key is supplied', async () => {
          await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptVersionIdentity, { instructions: 'nowhere to land' })), expectFailAssertHttpErrorServerErrorCode(BAD_REQUEST_ERROR_CODE));
        });
      });

      describe('openRouterPrompt.update', () => {
        demoOpenRouterPromptContext({ f }, (p) => {
          it('should update the metadata and lifecycle state', async () => {
            await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, { key: p.documentKey, name: 'Renamed', description: 'What it is for.', tags: ['demo', 'resume'], state: OpenRouterPromptState.ARCHIVED }));

            const prompt = await p.loadPrompt();
            expect(prompt.n).toBe('Renamed');
            expect(prompt.d).toBe('What it is for.');
            expect(prompt.t).toEqual(['demo', 'resume']);
            expect(prompt.s).toBe(OpenRouterPromptState.ARCHIVED);
          });

          it('should promote a version that exists', async () => {
            await p.createVersion({ instructions: 'v1', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown> });
            await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, { key: p.documentKey, activeVersion: 1, state: OpenRouterPromptState.ACTIVE }));

            const prompt = await p.loadPrompt();
            expect(prompt.av).toBe(1);
            expect(prompt.s).toBe(OpenRouterPromptState.ACTIVE);
          });

          itShouldFail('when promoting to a version that was never published', async () => {
            // Promoting to a missing version would leave every unpinned caller failing to resolve.
            await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, { key: p.documentKey, activeVersion: 7 })));
          });

          demoAuthorizedUserContext({ f }, (u) => {
            itShouldFail('with FORBIDDEN for a non-admin', async () => {
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, { key: p.documentKey, name: 'not yours' })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
            });
          });
        });

        itShouldFail('with BAD_REQUEST when no key is supplied', async () => {
          await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, { name: 'nowhere to land' })), expectFailAssertHttpErrorServerErrorCode(BAD_REQUEST_ERROR_CODE));
        });
      });

      // Each arrangement gets its own describe: a context registers its beforeEach on the enclosing
      // suite rather than opening one of its own, so a context nested beside a sibling `it` would stage
      // its prompt for that test too — and these tests count what the query returns.
      describe('openRouterPrompt.query', () => {
        describe('with two prompts', () => {
          demoOpenRouterPromptContext({ f, key: 'crud-query-a', name: 'A' }, (pa) => {
            demoOpenRouterPromptContext({ f, key: 'crud-query-b', name: 'B' }, () => {
              it('should return the prompts and their keys', async () => {
                const result = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, {}))) as OnCallQueryModelResult<OpenRouterPrompt>;

                expect(result.count).toBe(2);
                expect(result.hasMore).toBe(false);
                expect(result.results.map((x) => x.n).sort()).toEqual(['A', 'B']);
                expect(result.keys).toHaveLength(2);
              });

              it('should filter on state', async () => {
                await pa.update({ state: OpenRouterPromptState.ACTIVE });

                const result = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, { state: OpenRouterPromptState.ACTIVE }))) as OnCallQueryModelResult<OpenRouterPrompt>;

                expect(result.count).toBe(1);
                expect(result.results[0].n).toBe('A');

                // The prompts that were left DRAFT are still reachable through the other side of the filter.
                const drafts = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, { state: OpenRouterPromptState.DRAFT }))) as OnCallQueryModelResult<OpenRouterPrompt>;
                expect(drafts.count).toBe(1);
                expect(drafts.results[0].n).toBe('B');
              });

              demoAuthorizedUserContext({ f }, (u) => {
                itShouldFail('with FORBIDDEN for a non-admin', async () => {
                  await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, {})), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                });
              });
            });
          });
        });

        describe('with three prompts', () => {
          demoOpenRouterPromptContext({ f, key: 'crud-query-a', name: 'A' }, () => {
            demoOpenRouterPromptContext({ f, key: 'crud-query-b', name: 'B' }, () => {
              demoOpenRouterPromptContext({ f, key: 'crud-query-c', name: 'C' }, () => {
                it('should page with limit and cursorDocumentKey', async () => {
                  const firstPage = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, { limit: 2 }))) as OnCallQueryModelResult<OpenRouterPrompt>;

                  expect(firstPage.count).toBe(2);
                  expect(firstPage.hasMore).toBe(true);
                  expect(firstPage.cursorDocumentKey).toBeDefined();

                  const secondPage = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, { limit: 2, cursorDocumentKey: firstPage.cursorDocumentKey }))) as OnCallQueryModelResult<OpenRouterPrompt>;

                  expect(secondPage.count).toBe(1);
                  expect(secondPage.hasMore).toBe(false);
                  expect(secondPage.results.map((x) => x.n)).not.toContain(firstPage.results[0].n);
                });
              });
            });
          });
        });
      });
    });
  });

  // `create: false`, because the prompt the seed writes is the one it is deciding whether to create —
  // so the context addresses the shipped key without staging a document at it.
  describe('seedOpenRouterPrompts()', () => {
    demoOpenRouterPromptContext({ f, key: demoPromptDefinition.promptKey, create: false }, (p) => {
      describe('a store that has never been seeded', () => {
        it('should publish each definition at its declared number without minting the versions below it', async () => {
          // No definitions, so this runs the app's own action over the registry it ships — the run a
          // fresh deploy actually performs.
          const result = await p.seed();

          expect(result.considered).toBe(demoPromptDefinitions.length);
          expect(result.promptsCreated).toBe(demoPromptDefinitions.length);
          expect(result.versionsPublished).toBe(demoPromptDefinitions.length);
          expect(result.upToDate).toBe(0);
          expect(result.skipped).toBe(0);

          const prompt = await p.loadPrompt();
          expect(prompt.lv).toBe(demoPromptDefinition.version);
          expect(prompt.av).toBe(demoPromptDefinition.version);
          expect(prompt.s).toBe(OpenRouterPromptState.ACTIVE);
          expect(prompt.n).toBe(demoPromptDefinition.name);

          const published = await p.loadVersion(demoPromptDefinition.version);
          expect(published?.v).toBe(demoPromptDefinition.version);
          expect(published?.i).toBe(demoPromptDefinition.instructions);
          expect(published?.c).toEqual(demoPromptDefinition.config);
          // Version 1 is what the allocating create would have minted instead. Its absence is the entire
          // point: the store sits AT the number the code declares rather than permanently below it.
          expect(await p.loadVersion(1)).toBeUndefined();
        });

        it('should leave the published head unlocked, so it stays editable', async () => {
          await p.seed();

          expect((await p.loadVersion(demoPromptDefinition.version))?.lk).toBeFalsy();
        });
      });

      describe('a second run', () => {
        it('should report upToDate and write nothing', async () => {
          await p.seed();

          const published = await p.loadVersion(demoPromptDefinition.version);
          const second = await p.seed();

          expect(second.considered).toBe(demoPromptDefinitions.length);
          expect(second.promptsCreated).toBe(0);
          expect(second.versionsPublished).toBe(0);
          expect(second.upToDate).toBe(demoPromptDefinitions.length);
          expect(second.skipped).toBe(0);

          // Same document, untouched — a re-seed is a fixed point rather than a step toward convergence.
          const after = await p.loadVersion(demoPromptDefinition.version);
          expect(after?.cat).toEqual(published?.cat);
          expect(await p.loadVersion(demoPromptDefinition.version + 1)).toBeUndefined();
        });

        it('should not revert an operator rename, even on a run that publishes', async () => {
          await p.seed();
          await p.update({ name: 'Renamed By An Operator', description: 'Edited at runtime.' });

          // The version moves, which is the run that actually touches the prompt document — the metadata
          // still has to survive it.
          const result = await p.seed({ definitions: bumpedPromptDefinitions });
          expect(result.versionsPublished).toBe(demoPromptDefinitions.length);

          const prompt = await p.loadPrompt();
          expect(prompt.n).toBe('Renamed By An Operator');
          expect(prompt.d).toBe('Edited at runtime.');
        });
      });

      describe('a definition that moves ahead of the store', () => {
        it('should lock the outgoing head and leave the new one editable', async () => {
          await p.seed();

          const result = await p.seed({ definitions: bumpedPromptDefinitions });

          expect(result.promptsCreated).toBe(0);
          expect(result.versionsPublished).toBe(demoPromptDefinitions.length);
          expect(result.upToDate).toBe(0);

          expect((await p.loadVersion(demoPromptDefinition.version))?.lk).toBe(true);
          expect((await p.loadVersion(bumpedPromptVersion))?.lk).toBeFalsy();

          const prompt = await p.loadPrompt();
          expect(prompt.lv).toBe(bumpedPromptVersion);
          expect(prompt.av).toBe(bumpedPromptVersion);
        });
      });

      describe('drift', () => {
        it('should refuse to write a definition the store has advanced past', async () => {
          await p.seed({ definitions: bumpedPromptDefinitions });

          // A deploy rolled back behind what the store already carries.
          const behind = await p.seed();

          expect(behind.considered).toBe(demoPromptDefinitions.length);
          expect(behind.versionsPublished).toBe(0);
          expect(behind.upToDate).toBe(0);
          expect(behind.skipped).toBe(demoPromptDefinitions.length);

          // The store keeps serving what it had, and the version it advanced to is still the editable head.
          const prompt = await p.loadPrompt();
          expect(prompt.lv).toBe(bumpedPromptVersion);
          expect(prompt.av).toBe(bumpedPromptVersion);
          expect((await p.loadVersion(bumpedPromptVersion))?.lk).toBeFalsy();
          expect(await p.loadVersion(demoPromptDefinition.version)).toBeUndefined();
        });

        it('should skip an ARCHIVED prompt rather than resurrect it', async () => {
          await p.seed();
          await p.update({ state: OpenRouterPromptState.ARCHIVED });

          const result = await p.seed({ definitions: bumpedPromptDefinitions });

          expect(result.versionsPublished).toBe(0);
          expect(result.skipped).toBe(demoPromptDefinitions.length);

          const prompt = await p.loadPrompt();
          expect(prompt.s).toBe(OpenRouterPromptState.ARCHIVED);
          expect(prompt.lv).toBe(demoPromptDefinition.version);
          expect(await p.loadVersion(bumpedPromptVersion)).toBeUndefined();
        });
      });

      describe('promptKeys', () => {
        it('should restrict the run to the named keys', async () => {
          const result = await p.seed({ promptKeys: [demoPromptDefinition.promptKey] });

          expect(result.considered).toBe(1);
          expect(result.promptsCreated).toBe(1);
          expect(result.versionsPublished).toBe(1);
          expect((await p.loadPrompt()).av).toBe(demoPromptDefinition.version);
        });

        it('should consider nothing when the named key is not in the registry', async () => {
          const result = await p.seed({ promptKeys: ['not-a-registered-prompt'] });

          expect(result.considered).toBe(0);
          expect(result.promptsCreated).toBe(0);
          expect(result.versionsPublished).toBe(0);
          expect(await p.document.snapshotData()).toBeUndefined();
        });

        it('should seed every definition when omitted', async () => {
          const result = await p.seed();

          expect(result.considered).toBe(demoPromptDefinitions.length);
          expect(result.promptsCreated).toBe(demoPromptDefinitions.length);
          expect(result.versionsPublished).toBe(demoPromptDefinitions.length);
          expect((await p.loadPrompt()).av).toBe(demoPromptDefinition.version);
        });
      });

      describe('validation', () => {
        itShouldFail('when a definition names no model, without writing anything', async () => {
          await expectFail(() => p.seed({ definitions: demoPromptDefinitions.map((x) => ({ ...x, config: {} as OpenRouterModelConfig })) }));

          // Validation runs over the whole registry before the read pass, so a broken entry stops the run
          // rather than half-seeding a state no rerun explains.
          expect(await p.document.snapshotData()).toBeUndefined();
        });

        itShouldFail('on a definition whose declared version is not a positive integer', async () => {
          await expectFail(() => p.seed({ definitions: demoPromptDefinitions.map((x) => ({ ...x, version: 0 })) }));
          expect(await p.document.snapshotData()).toBeUndefined();
        });
      });
    });
  });
});
