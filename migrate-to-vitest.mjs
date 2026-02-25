#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Show usage information
 */
function showHelp() {
  console.log(`
Usage: node migrate-to-vitest.mjs [options] [projects...]

Migrate Jest configurations to Vitest in an Nx workspace.

Arguments:
  projects...          Specific project names to migrate (optional)
                       If not provided, all projects will be migrated

Options:
  --skip-install       Skip the 'nx add @nx/vitest' installation step
  --help              Show this help message

Examples:
  node migrate-to-vitest.mjs
    Migrate all projects in the workspace

  node migrate-to-vitest.mjs firebase-server util
    Migrate only firebase-server and util projects

  node migrate-to-vitest.mjs --skip-install firebase-server
    Migrate firebase-server without installing vitest
`);
}

/**
 * Execute a command and return the stdout as a string
 */
async function execCommand(command) {
  console.log(`Executing: ${command}`);
  const { stdout, stderr } = await execAsync(command);
  if (stderr) {
    console.warn('stderr:', stderr);
  }
  return stdout.trim();
}

/**
 * Read and parse a JSON file
 */
async function readJsonFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write JSON to a file with formatting
 */
async function writeJsonFile(filePath, data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Extract appTestType from jest.config.ts
 */
async function extractAppTestType(jestConfigPath) {
  try {
    const content = await readFile(jestConfigPath, 'utf-8');
    const match = content.match(/\(global as any\)\.appTestType = ['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  } catch (error) {
    console.warn(`Could not read jest.config.ts at ${jestConfigPath}:`, error.message);
    return null;
  }
}

/**
 * Generate the vitest config content
 */
function generateVitestConfig(projectName, projectRoot, appTestType, includeSetupFiles = false) {
  const config = {
    type: appTestType || 'node',
    pathFromRoot: '__dirname',
    projectName
  };

  if (includeSetupFiles) {
    config.projectSpecificSetupFiles = ['src/test-setup.ts'];
  }

  const configStr = JSON.stringify(config, null, 2).replace('"__dirname"', '__dirname');

  // Calculate the correct import path based on project depth
  const relativePathToRoot = calculateRelativePathToRoot(projectRoot);
  const importPath = `${relativePathToRoot}vitest.preset.config.mjs`;

  return `import { createVitestConfig } from '${importPath}';

export default createVitestConfig(${configStr});
`;
}

/**
 * Delete a file if it exists
 */
async function deleteFileIfExists(filePath) {
  try {
    await unlink(filePath);
    console.log(`Deleted: ${filePath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Could not delete ${filePath}:`, error.message);
    }
  }
}

/**
 * Calculate relative path from project root to workspace root
 */
function calculateRelativePathToRoot(projectRoot) {
  // Count the depth (number of directories)
  const depth = projectRoot.split('/').filter(Boolean).length;
  // Generate the appropriate number of "../"
  return '../'.repeat(depth);
}

/**
 * Update tsconfig.spec.json to include vitest.setup.typings.ts
 */
async function updateTsConfigSpec(projectRoot) {
  const tsconfigPath = join(projectRoot, 'tsconfig.spec.json');

  try {
    console.log(`Updating ${tsconfigPath}...`);
    const tsconfig = await readJsonFile(tsconfigPath);

    // Calculate relative path to workspace root
    const relativePathToRoot = calculateRelativePathToRoot(projectRoot);
    const vitestSetupPath = `${relativePathToRoot}vitest.setup.typings.ts`;

    // Ensure include array exists
    if (!tsconfig.include) {
      tsconfig.include = [];
    }

    // Add vitest.setup.typings.ts if not already present
    if (!tsconfig.include.includes(vitestSetupPath)) {
      tsconfig.include.push(vitestSetupPath);
      await writeJsonFile(tsconfigPath, tsconfig);
      console.log(`Added ${vitestSetupPath} to tsconfig.spec.json`);
    } else {
      console.log(`${vitestSetupPath} already in tsconfig.spec.json`);
    }
  } catch (error) {
    console.warn(`Could not update ${tsconfigPath}:`, error.message);
  }
}

/**
 * Update test-setup.ts for Angular projects to include reflect-metadata
 */
async function updateAngularTestSetup(projectRoot) {
  const testSetupPath = join(projectRoot, 'src', 'test-setup.ts');
  const relativePathToRoot = calculateRelativePathToRoot(projectRoot + 'src/');
  const importSetupAngularPath = `${relativePathToRoot}vitest.setup.angular`;

  try {
    const expectedContent = `import '${importSetupAngularPath}';`;
    console.log(`Updating ${testSetupPath} for Angular...`);
    let content = await readFile(testSetupPath, 'utf-8');

    // Check if reflect-metadata import already exists
    if (!content.includes(expectedContent)) {
      await writeFile(testSetupPath, expectedContent, 'utf-8');
      console.log(`Updated test-setup.ts`);
    } else {
      console.log(`test-setup.ts was already configured`);
    }
  } catch (error) {
    console.warn(`Could not update ${testSetupPath}:`, error.message);
  }
}

/**
 * Migrate a single project from Jest to Vitest
 */
async function migrateProject(projectName, projectDetails) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migrating project: ${projectName}`);
  console.log('='.repeat(60));

  const projectRoot = projectDetails.root;
  const projectJsonPath = join(projectRoot, 'project.json');

  // Read project.json
  console.log(`Reading ${projectJsonPath}...`);
  const projectJson = await readJsonFile(projectJsonPath);

  // Find the Jest target
  const targets = projectJson.targets || {};
  const jestTargetEntry = Object.entries(targets).find(([, target]) => target.executor === '@nx/jest:jest');

  if (!jestTargetEntry) {
    console.log(`No Jest target found in ${projectName}, skipping...`);
    return 'skipped';
  }

  const [jestTargetName, jestTarget] = jestTargetEntry;
  console.log(`Found Jest target: ${jestTargetName}`);

  // Get testEnvironment from jest config options if available
  const jestConfigPath = jestTarget.options?.jestConfig;
  let testEnvironment = 'node';
  let appTestType = null;

  if (jestConfigPath) {
    const fullJestConfigPath = join(projectRoot, jestConfigPath.replace(projectRoot + '/', ''));
    appTestType = await extractAppTestType(fullJestConfigPath);
    console.log(`Extracted appTestType: ${appTestType || 'none'}`);
  }

  // Remove the Jest target from project.json
  console.log(`Removing Jest target "${jestTargetName}" from project.json...`);
  delete projectJson.targets[jestTargetName];
  await writeJsonFile(projectJsonPath, projectJson);

  // Run nx generate command
  const generateCommand = `npx nx g @nx/vitest:configuration --project=${projectName} --testEnvironment=${testEnvironment} --testTarget=${jestTargetName}`;
  console.log(`Generating Vitest configuration...`);
  try {
    await execCommand(generateCommand);
  } catch (error) {
    console.error(`Error generating Vitest config for ${projectName}:`, error.message);
    return;
  }

  // Delete vite.config.mts if it was generated (we only need vitest.config.mts)
  const viteConfigPath = join(projectRoot, 'vite.config.mts');
  await deleteFileIfExists(viteConfigPath);

  // Replace vitest.config.mts with custom configuration
  const vitestConfigPath = join(projectRoot, 'vitest.config.mts');
  console.log(`Updating ${vitestConfigPath}...`);

  const isAngular = appTestType === 'angular';
  const vitestConfig = generateVitestConfig(projectName, projectRoot, appTestType, isAngular);
  await writeFile(vitestConfigPath, vitestConfig, 'utf-8');

  // Delete test-setup.ts if not angular, otherwise update it
  if (!isAngular) {
    const testSetupPath = join(projectRoot, 'src', 'test-setup.ts');
    await deleteFileIfExists(testSetupPath);
  } else {
    // Update Angular test-setup.ts to include reflect-metadata
    await updateAngularTestSetup(projectRoot);
  }

  // Update tsconfig.spec.json to include vitest.setup.typings.ts
  await updateTsConfigSpec(projectRoot);

  // Delete jest.config.ts if it exists
  if (jestConfigPath) {
    const fullJestConfigPath = join(projectRoot, jestConfigPath.replace(projectRoot + '/', ''));
    await deleteFileIfExists(fullJestConfigPath);
  }

  console.log(`✓ Successfully migrated ${projectName}`);
}

/**
 * Main migration function
 */
async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const targetProjects = args.filter((arg) => !arg.startsWith('--'));
  const skipInstall = args.includes('--skip-install');

  console.log('Starting migration from Jest to Vitest...\n');

  // Step 1: Install Vitest
  if (!skipInstall) {
    console.log('Step 1: Installing Vitest...');
    try {
      await execCommand('pnpm nx add @nx/vitest');
      console.log('✓ Vitest installed successfully\n');
    } catch (error) {
      console.error('Error installing Vitest:', error.message);
      console.log('Continuing with migration...\n');
    }
  } else {
    console.log('Step 1: Skipping Vitest installation (--skip-install)\n');
  }

  // Step 2: Get list of projects
  console.log('Step 2: Getting list of projects...');
  const projectsJson = await execCommand('npx nx show projects --json');
  let projects = JSON.parse(projectsJson);

  // Filter to target projects if specified
  if (targetProjects.length > 0) {
    console.log(`Filtering to target projects: ${targetProjects.join(', ')}`);
    const availableProjects = new Set(projects);
    const invalidProjects = targetProjects.filter((p) => !availableProjects.has(p));

    if (invalidProjects.length > 0) {
      console.warn(`Warning: These projects were not found: ${invalidProjects.join(', ')}`);
    }

    projects = targetProjects.filter((p) => availableProjects.has(p));

    if (projects.length === 0) {
      console.error('Error: No valid projects to migrate');
      process.exit(1);
    }
  }

  console.log(`Will migrate ${projects.length} project(s)\n`);

  // Step 3: Migrate each project
  console.log('Step 3: Migrating projects...');
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const projectName of projects) {
    try {
      // Get project details
      const projectDetailsJson = await execCommand(`npx nx show project ${projectName} --json`);
      const projectDetails = JSON.parse(projectDetailsJson);

      const result = await migrateProject(projectName, projectDetails);
      if (result === 'skipped') {
        skipCount++;
      } else {
        successCount++;
      }
    } catch (error) {
      console.error(`Error migrating ${projectName}:`, error.message);
      console.log('Continuing with next project...');
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration complete!');
  console.log(`✓ Successfully migrated: ${successCount}`);
  console.log(`⊘ Skipped (no Jest config): ${skipCount}`);
  if (errorCount > 0) {
    console.log(`✗ Errors: ${errorCount}`);
  }
  console.log('='.repeat(60));
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
