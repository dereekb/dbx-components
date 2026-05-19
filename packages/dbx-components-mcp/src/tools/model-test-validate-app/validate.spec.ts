/**
 * Spec for the pure `validateModelTestApp` rules.
 *
 * Drives the validator with synthetic spec catalogs + component
 * extractions — no filesystem setup needed. Covers every emitted code,
 * the strict toggle, and a clean-baseline case.
 */

import { describe, expect, it } from 'vitest';
import { classifySpecFile } from '../model-test-shared/conventions.js';
import type { DiscoveredSpecCatalog, DiscoveredSpecFile, DiscoveredSpecGroup } from '../model-test-shared/index.js';
import type { ExtractionOutcome } from '../model-list-component/extract.js';
import type { ComponentModelEntry } from '../model-list-component/types.js';
import { validateModelTestApp } from './validate.js';
import type { ViolationCode } from './types.js';

const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';
const FUNCTION_DIR = `${API_DIR}/src/app/function`;

function makeFile(filename: string, parentFolderName: string): DiscoveredSpecFile {
  const classification = classifySpecFile({ filename, parentFolderName });
  return {
    filename,
    fileRel: `${FUNCTION_DIR}/${parentFolderName}/${filename}`,
    classification
  };
}

function makeGroup(group: string, files: readonly string[]): DiscoveredSpecGroup {
  return {
    group,
    folderRel: `${FUNCTION_DIR}/${group}`,
    files: files.map((name) => makeFile(name, group))
  };
}

function makeCatalog(groups: readonly DiscoveredSpecGroup[]): DiscoveredSpecCatalog {
  let totalSpecFiles = 0;
  let totalDriftFiles = 0;
  for (const g of groups) {
    totalSpecFiles += g.files.length;
    for (const f of g.files) {
      if (!f.classification.isCanonical && f.classification.kind !== 'non-spec' && f.classification.kind !== 'non-group') {
        totalDriftFiles += 1;
      }
    }
  }
  return {
    apiRel: API_DIR,
    functionDirRel: FUNCTION_DIR,
    groups,
    totalSpecFiles,
    totalDriftFiles
  };
}

function makeModel(folder: string): ComponentModelEntry {
  return {
    folder,
    modelName: folder.charAt(0).toUpperCase() + folder.slice(1),
    identityConst: `${folder}Identity`,
    collectionName: folder,
    collectionPrefix: folder.charAt(0),
    parentIdentityConst: undefined,
    sourceFile: `${COMPONENT_DIR}/src/lib/model/${folder}/${folder}.ts`,
    fixtureCovered: undefined
  };
}

function makeExtraction(folders: readonly string[]): ExtractionOutcome {
  return {
    modelRoot: `${COMPONENT_DIR}/src/lib/model`,
    models: folders.map(makeModel),
    skipped: [],
    unidentifiedFolders: []
  };
}

function codes(violations: readonly { readonly code: ViolationCode }[]): readonly ViolationCode[] {
  return violations.map((v) => v.code);
}

describe('validateModelTestApp', () => {
  it('returns zero violations for a clean baseline', () => {
    const catalog = makeCatalog([makeGroup('job', ['job.crud.spec.ts', 'job.scenario.spec.ts']), makeGroup('profile', ['profile.crud.spec.ts'])]);
    const extraction = makeExtraction(['job', 'profile']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.specFilesChecked).toBe(3);
    expect(result.modelGroupsChecked).toBe(2);
  });

  it('accepts canonical subgroup names like `job.crud.instruction.spec.ts`', () => {
    const catalog = makeCatalog([makeGroup('job', ['job.crud.spec.ts', 'job.crud.instruction.spec.ts', 'job.scenario.requirement.worker.spec.ts'])]);
    const extraction = makeExtraction(['job']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    expect(result.warningCount).toBe(0);
  });

  it('flags `crud-misplaced` drift with a rename suggestion', () => {
    const catalog = makeCatalog([makeGroup('worker', ['worker.crud.spec.ts', 'worker.pay.crud.spec.ts'])]);
    const extraction = makeExtraction(['worker']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    expect(codes(result.violations)).toContain('TEST_FILE_DRIFT_RENAME');
    const drift = result.violations.find((v) => v.code === 'TEST_FILE_DRIFT_RENAME');
    expect(drift?.message).toContain('worker.crud.pay.spec.ts');
    expect(drift?.severity).toBe('warning');
  });

  it('flags `scenario-misplaced` drift', () => {
    const catalog = makeCatalog([makeGroup('worker', ['worker.crud.spec.ts', 'worker.payroll.scenario.spec.ts'])]);
    const extraction = makeExtraction(['worker']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    const drift = result.violations.find((v) => v.code === 'TEST_FILE_DRIFT_RENAME');
    expect(drift?.message).toContain('worker.scenario.payroll.spec.ts');
  });

  it('flags `TEST_FILE_MISSING_BUCKET` when neither crud nor scenario is present', () => {
    const catalog = makeCatalog([makeGroup('worker', ['worker.crud.spec.ts', 'worker.system.spec.ts'])]);
    const extraction = makeExtraction(['worker']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    const missing = result.violations.find((v) => v.code === 'TEST_FILE_MISSING_BUCKET');
    expect(missing).toBeDefined();
    expect(missing?.message).toContain('worker.system.spec.ts');
    expect(missing?.message).toContain('worker.scenario.system.spec.ts');
  });

  it('flags `TEST_FILE_NON_GROUP_PLACEMENT` when the filename prefix mismatches the folder', () => {
    const catalog = makeCatalog([makeGroup('job', ['job.crud.spec.ts', 'storagefile.scenario.jobrequirement.spec.ts'])]);
    const extraction = makeExtraction(['job']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    const mismatch = result.violations.find((v) => v.code === 'TEST_FILE_NON_GROUP_PLACEMENT');
    expect(mismatch).toBeDefined();
    expect(mismatch?.message).toContain('storagefile.scenario.jobrequirement.spec.ts');
  });

  it('flags `MODEL_GROUP_MISSING_CRUD_SPEC` when a component model has no crud spec on the API side', () => {
    const catalog = makeCatalog([makeGroup('job', ['job.crud.spec.ts'])]);
    const extraction = makeExtraction(['job', 'profile']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    const missing = result.violations.find((v) => v.code === 'MODEL_GROUP_MISSING_CRUD_SPEC');
    expect(missing).toBeDefined();
    expect(missing?.group).toBe('profile');
    expect(missing?.message).toContain('profile.crud.spec.ts');
  });

  it('counts a crud-subgroup spec (`job.crud.instruction.spec.ts`) as satisfying CRUD coverage', () => {
    const catalog = makeCatalog([makeGroup('job', ['job.crud.instruction.spec.ts'])]);
    const extraction = makeExtraction(['job']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction });
    expect(codes(result.violations)).not.toContain('MODEL_GROUP_MISSING_CRUD_SPEC');
  });

  it('upgrades every violation to error when strict is true', () => {
    const catalog = makeCatalog([makeGroup('worker', ['worker.system.spec.ts'])]);
    const extraction = makeExtraction(['worker']);
    const result = validateModelTestApp({ componentDir: COMPONENT_DIR, apiDir: API_DIR, specCatalog: catalog, componentExtraction: extraction }, { strict: true });
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.warningCount).toBe(0);
    for (const v of result.violations) {
      expect(v.severity).toBe('error');
    }
  });
});
