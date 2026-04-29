/**
 * Parity spec — runs the new ts-morph extractor against the upstream
 * `@dereekb/firebase` model corpus and confirms it produces output equal
 * to (or a strict superset of) the canonical `.mjs` extractor.
 *
 * The committed `firebase-models.generated.{ts,json}` is the `.mjs`
 * extractor's output; we compare per-entry to those constants. Failures
 * surface real divergences before the runtime extractor reaches a
 * downstream package.
 */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIREBASE_MODELS, FIREBASE_MODEL_GROUPS, type FirebaseField, type FirebaseModel, type FirebaseModelGroup } from '../../registry/firebase-models.js';
import { extractModels } from './index.js';

const WORKSPACE_ROOT = resolve(__dirname, '../../../../..');
const UPSTREAM_MODEL_ROOT = resolve(WORKSPACE_ROOT, 'packages/firebase/src/lib/model');

describe('extractModels parity with extract-firebase-models.mjs', () => {
  it('matches every upstream model on identity, fields, enums, and collectionKind', async () => {
    const result = await extractModels({
      rootDir: UPSTREAM_MODEL_ROOT,
      sourcePackage: '@dereekb/firebase',
      workspaceRoot: WORKSPACE_ROOT
    });
    expect(result.errors, `extractor errors: ${JSON.stringify(result.errors, null, 2)}`).toEqual([]);
    const morphByName = new Map(result.models.map((m) => [m.name, m]));
    expect(morphByName.size).toBe(result.models.length);
    for (const expected of FIREBASE_MODELS) {
      const actual = morphByName.get(expected.name);
      expect(actual, `${expected.name} missing from ts-morph extractor`).toBeDefined();
      assertModelParity(actual as FirebaseModel, expected);
    }
  });

  it('matches every upstream model group on container and modelNames', async () => {
    const result = await extractModels({
      rootDir: UPSTREAM_MODEL_ROOT,
      sourcePackage: '@dereekb/firebase',
      workspaceRoot: WORKSPACE_ROOT
    });
    const morphByName = new Map(result.modelGroups.map((g) => [g.name, g]));
    for (const expected of FIREBASE_MODEL_GROUPS) {
      const actual = morphByName.get(expected.name);
      expect(actual, `${expected.name} model group missing from ts-morph extractor`).toBeDefined();
      assertGroupParity(actual as FirebaseModelGroup, expected);
    }
  });
});

function assertModelParity(actual: FirebaseModel, expected: FirebaseModel): void {
  expect(actual.identityConst, `${expected.name}.identityConst`).toBe(expected.identityConst);
  expect(actual.modelType, `${expected.name}.modelType`).toBe(expected.modelType);
  expect(actual.collectionPrefix, `${expected.name}.collectionPrefix`).toBe(expected.collectionPrefix);
  expect(actual.parentIdentityConst, `${expected.name}.parentIdentityConst`).toBe(expected.parentIdentityConst);
  expect(actual.collectionKind, `${expected.name}.collectionKind`).toBe(expected.collectionKind);
  expect(actual.modelGroup, `${expected.name}.modelGroup`).toBe(expected.modelGroup);
  expect(actual.sourcePackage, `${expected.name}.sourcePackage`).toBe(expected.sourcePackage);
  expect(actual.sourceFile, `${expected.name}.sourceFile`).toBe(expected.sourceFile);

  const actualFieldsByName = new Map(actual.fields.map((f) => [f.name, f]));
  for (const expectedField of expected.fields) {
    const actualField = actualFieldsByName.get(expectedField.name);
    expect(actualField, `${expected.name}.${expectedField.name} missing`).toBeDefined();
    assertFieldParity(expected.name, actualField as FirebaseField, expectedField);
  }
  expect(
    actual.fields.map((f) => f.name),
    `${expected.name} field order`
  ).toEqual(expected.fields.map((f) => f.name));

  const actualEnumsByName = new Map(actual.enums.map((e) => [e.name, e]));
  for (const expectedEnum of expected.enums) {
    const actualEnum = actualEnumsByName.get(expectedEnum.name);
    expect(actualEnum, `${expected.name} missing enum ${expectedEnum.name}`).toBeDefined();
    expect(
      actualEnum?.values.map((v) => v.name),
      `${expected.name}.${expectedEnum.name} value names`
    ).toEqual(expectedEnum.values.map((v) => v.name));
    expect(
      actualEnum?.values.map((v) => v.value),
      `${expected.name}.${expectedEnum.name} value values`
    ).toEqual(expectedEnum.values.map((v) => v.value));
  }

  expect(actual.detectionHints, `${expected.name}.detectionHints`).toEqual(expected.detectionHints);
}

function assertFieldParity(modelName: string, actual: FirebaseField, expected: FirebaseField): void {
  expect(actual.longName, `${modelName}.${expected.name}.longName`).toBe(expected.longName);
  expect(actual.converter, `${modelName}.${expected.name}.converter`).toBe(expected.converter);
  expect(actual.tsType, `${modelName}.${expected.name}.tsType`).toBe(expected.tsType);
  expect(actual.optional, `${modelName}.${expected.name}.optional`).toBe(expected.optional);
  expect(actual.enumRef, `${modelName}.${expected.name}.enumRef`).toBe(expected.enumRef);
  if (expected.description !== undefined) {
    expect(actual.description, `${modelName}.${expected.name}.description`).toBe(expected.description);
  }
}

function assertGroupParity(actual: FirebaseModelGroup, expected: FirebaseModelGroup): void {
  expect(actual.containerName, `${expected.name}.containerName`).toBe(expected.containerName);
  expect(actual.sourcePackage, `${expected.name}.sourcePackage`).toBe(expected.sourcePackage);
  expect(actual.sourceFile, `${expected.name}.sourceFile`).toBe(expected.sourceFile);
  expect(actual.modelNames, `${expected.name}.modelNames`).toEqual(expected.modelNames);
}
