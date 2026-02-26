#!/usr/bin/env node

/**
 * Script to convert callback-based tests to use callbackTest wrapper for Vitest compatibility.
 *
 * Usage:
 *   node convert-callback-tests.js           # Run and modify files
 *   node convert-callback-tests.js --dry-run # Preview changes without modifying files
 *
 * This script will:
 * 1. Find all .spec.ts files in the current directory and subdirectories
 * 2. Replace patterns like `it('test', (done) => {...})` with `it('test', callbackTest((done) => {...}))`
 * 3. Add the import statement for callbackTest if needed
 * 4. Excludes packages/util/test (util-test package)
 */

const fs = require('fs');
const path = require('path');

// Check for dry-run flag
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n');

const CALLBACK_TEST_IMPORT = "import { callbackTest } from '@dereekb/util/test';";

/**
 * Recursively find all .spec.ts files
 */
function findSpecFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, and util/test directories
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        // Skip packages/util/test (util-test package)
        if (!filePath.includes('packages/util/test') && !filePath.includes('packages\\util\\test')) {
          findSpecFiles(filePath, fileList);
        }
      }
    } else if (file.endsWith('.spec.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Check if file contains callback tests with (done) parameter
 */
function hasCallbackTests(content) {
  // Look for patterns like:
  // - it('...', (done) => {
  // - it("...", (done) => {
  // - it(`...`, (done) => {
  const patterns = [
    /\bit\s*\([^,]+,\s*\(done\)\s*=>/,
    /\btest\s*\([^,]+,\s*\(done\)\s*=>/
  ];

  return patterns.some(pattern => pattern.test(content));
}

/**
 * Check if file already has callbackTest import
 */
function hasCallbackTestImport(content) {
  return content.includes("import { callbackTest }") ||
         content.includes("import {callbackTest}") ||
         (content.includes("from '@dereekb/util/test'") && content.includes("callbackTest"));
}

/**
 * Add import statement to the file content
 */
function addImport(content) {
  // Find the position to insert the import
  // Try to add it after other @dereekb/util/test imports
  const utilTestImportMatch = content.match(/import\s+{[^}]+}\s+from\s+['"]@dereekb\/util\/test['"];?\n/);

  if (utilTestImportMatch) {
    // Add callbackTest to existing import
    const existingImport = utilTestImportMatch[0];
    const importContent = existingImport.match(/import\s+{([^}]+)}/)[1];

    if (!importContent.includes('callbackTest')) {
      const newImportContent = importContent.trim() + ', callbackTest';
      const newImport = existingImport.replace(/import\s+{[^}]+}/, `import { ${newImportContent} }`);
      return content.replace(existingImport, newImport);
    }
    return content;
  }

  // Otherwise, add new import at the top after other imports
  const importMatch = content.match(/^((?:import\s+.*\n)*)/);

  if (importMatch) {
    const imports = importMatch[1];
    return content.replace(imports, imports + CALLBACK_TEST_IMPORT + '\n');
  }

  // If no imports found, add at the very top
  return CALLBACK_TEST_IMPORT + '\n' + content;
}

/**
 * Convert callback tests to use callbackTest wrapper
 */
function convertCallbackTests(content) {
  const lines = content.split('\n');
  const newLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line contains it(..., (done) => or test(..., (done) =>
    const itMatch = line.match(/^(\s*)(it|test)\s*\(\s*([`'"][^`'"]*[`'"])\s*,\s*\(done\)\s*=>/);

    if (itMatch) {
      const [fullMatch, indent, testFn, testName] = itMatch;
      const restOfLine = line.substring(fullMatch.length);

      // Replace with callbackTest wrapper
      const newLine = `${indent}${testFn}(${testName}, callbackTest((done) =>${restOfLine}`;
      newLines.push(newLine);

      // Now find the matching closing for this test
      // We need to track brace depth to find where the test function ends
      // Count braces on the first line to establish initial depth
      let braceDepth = 0;
      for (let j = 0; j < newLine.length; j++) {
        if (newLine[j] === '{') braceDepth++;
        else if (newLine[j] === '}') braceDepth--;
      }
      let foundOpeningBrace = braceDepth > 0;
      i++;

      // Scan forward to find the closing
      while (i < lines.length) {
        const currentLine = lines[i];
        let modifiedLine = currentLine;
        let foundClosing = false;

        // Count braces
        for (let j = 0; j < currentLine.length; j++) {
          const char = currentLine[j];
          if (char === '{') {
            braceDepth++;
            foundOpeningBrace = true;
          } else if (char === '}') {
            braceDepth--;
          }
        }

        // After counting all braces on this line, check if we're back to depth 0
        // AND this line matches the pattern for closing an it() call
        if (braceDepth === 0 && foundOpeningBrace) {
          // Check if this line ends with }); or }) that would close the it() call
          // This pattern matches lines like:  });  or  })
          const closingMatch = currentLine.match(/^(\s*})\s*\)\s*;?\s*$/);
          if (closingMatch) {
            // Replace }); or }) with }));
            modifiedLine = currentLine.replace(/^(\s*})\s*\)\s*;?\s*$/, '$1));');
            foundClosing = true;
          }
        }

        newLines.push(modifiedLine);

        if (foundClosing) {
          break;
        }

        i++;
      }
    } else {
      newLines.push(line);
    }

    i++;
  }

  return newLines.join('\n');
}

/**
 * Process a single file
 */
function processFile(filePath) {
  console.log(`Processing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf8');

  // Skip if no callback tests found
  if (!hasCallbackTests(content)) {
    console.log(`  ⏭️  Skipping (no callback tests found)`);
    return false;
  }

  let modified = content;

  // Add import if needed
  if (!hasCallbackTestImport(modified)) {
    modified = addImport(modified);
  }

  // Convert callback tests
  modified = convertCallbackTests(modified);

  // Only write if content changed
  if (modified !== content) {
    if (DRY_RUN) {
      console.log(`  🔍 Would update (dry-run mode)`);
    } else {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`  ✅ Updated`);
    }
    return true;
  } else {
    console.log(`  ⏭️  No changes needed`);
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  const startDir = process.cwd();

  if (DRY_RUN) {
    console.log(`🔍 DRY RUN MODE - No files will be modified\n`);
  }

  console.log(`🔍 Searching for .spec.ts files in: ${startDir}`);
  console.log(`   (excluding packages/util/test)\n`);

  const specFiles = findSpecFiles(startDir);
  console.log(`📝 Found ${specFiles.length} spec files\n`);

  let processedCount = 0;
  let updatedCount = 0;

  specFiles.forEach(file => {
    processedCount++;
    if (processFile(file)) {
      updatedCount++;
    }
  });

  console.log(`\n✨ Done!`);
  console.log(`   Processed: ${processedCount} files`);
  console.log(`   ${DRY_RUN ? 'Would update' : 'Updated'}: ${updatedCount} files`);

  if (DRY_RUN) {
    console.log(`\n💡 Run without --dry-run to apply changes`);
  }
}

// Run the script
main();
