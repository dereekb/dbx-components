#!/usr/bin/env node
/* eslint-disable */
/**
 * Extracts Firebase model metadata from @dereekb/firebase source files and
 * emits packages/dbx-components-mcp/src/registry/firebase-models.generated.ts.
 *
 * Run from the workspace root (that's what `nx run dbx-components-mcp:generate-firebase-models`
 * guarantees). Scans every `.ts` file under packages/firebase/src/lib/model/
 * (skipping spec/test files) and pulls four patterns out of each file:
 *
 *   1. `export const <name>Identity = firestoreModelIdentity(...)` — model type + collection prefix
 *   2. `export interface <Name> { ... }` — TS types + JSDoc descriptions per field
 *   3. `export const <name>Converter = snapshotConverterFunctions<<Name>>({ fields: { ... } })` — canonical persisted field list
 *   4. `export enum <Name> { ... }` — numeric enum values + descriptions
 *
 * Identities → interfaces → converters are linked by naming convention
 * (`notificationBox` → `NotificationBox` → `notificationBoxConverter`).
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');
const MODEL_ROOT = join(WORKSPACE_ROOT, 'packages/firebase/src/lib/model');
const OUTPUT_FILE = join(WORKSPACE_ROOT, 'packages/dbx-components-mcp/src/registry/firebase-models.generated.ts');

/** Common short field names that appear on many models and are poor detection signals. */
const COMMON_FIELDS = new Set(['cat', 'o', 'u', 's', 'fi', 'uid', 'mat', 'd']);

async function main() {
  const files = findTsFiles(MODEL_ROOT).filter((p) => !p.endsWith('.spec.ts') && !p.endsWith('.test.ts') && !p.endsWith('.id.ts'));
  const models = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!content.includes('firestoreModelIdentity(')) continue;
    const extracted = extractFromFile(file, content);
    for (const m of extracted) models.push(m);
  }

  // Sort for stable output: root collections first, then subcollections; alphabetical within.
  models.sort((a, b) => {
    const aRoot = a.parentIdentityConst ? 1 : 0;
    const bRoot = b.parentIdentityConst ? 1 : 0;
    if (aRoot !== bRoot) return aRoot - bRoot;
    return a.name.localeCompare(b.name);
  });

  const raw = emit(models);
  const formatted = await formatWithPrettier(raw);
  writeFileSync(OUTPUT_FILE, formatted);
  console.log(`Wrote ${models.length} Firebase models to ${relative(WORKSPACE_ROOT, OUTPUT_FILE)}`);
}

/**
 * Runs the workspace's Prettier config against the generated source so the
 * output matches what `prettier --write` would produce on the committed file.
 * Without this step the script's serializer and Prettier disagree on quote
 * style and short-array formatting, which dirties the working tree on every run.
 */
async function formatWithPrettier(source) {
  const config = await prettier.resolveConfig(OUTPUT_FILE);
  const result = await prettier.format(source, { ...config, filepath: OUTPUT_FILE });
  return result;
}

function findTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      out.push(...findTsFiles(p));
    } else if (entry.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

function extractFromFile(file, content) {
  const identities = findIdentities(content);
  const interfaces = findInterfaces(content);
  const converters = findConverters(content);
  const enums = findEnums(content);

  const interfaceByName = new Map();
  for (const iface of interfaces) interfaceByName.set(iface.name, iface);
  const converterByInterface = new Map();
  for (const c of converters) converterByInterface.set(c.interfaceName, c);
  const enumNames = new Set(enums.map((e) => e.name));

  const relativePath = relative(WORKSPACE_ROOT, file).split('\\').join('/');

  const out = [];
  for (const id of identities) {
    const modelName = capitalize(id.modelType);
    const converter = converterByInterface.get(modelName);
    if (!converter) continue; // no converter → not a persisted model (rare)
    const iface = interfaceByName.get(modelName);
    const ifaceProps = new Map();
    if (iface) for (const p of iface.props) ifaceProps.set(p.name, p);

    const fields = converter.fields.map((f) => {
      const prop = ifaceProps.get(f.key);
      const enumFromType = prop && prop.tsType ? findEnumInType(prop.tsType, enumNames) : undefined;
      const enumFromConverter = findEnumInConverter(f.converter, enumNames);
      const enumRef = enumFromType ?? enumFromConverter;
      const optional = prop?.optional ?? /^optionalFirestore/.test(f.converter);
      const field = {
        name: f.key,
        converter: f.converter
      };
      if (prop?.tsType) field.tsType = prop.tsType;
      field.optional = optional;
      if (prop?.description) field.description = prop.description;
      if (enumRef) field.enumRef = enumRef;
      return field;
    });

    const referencedEnums = new Set();
    for (const f of fields) if (f.enumRef) referencedEnums.add(f.enumRef);
    const relevantEnums = enums.filter((e) => referencedEnums.has(e.name));

    const detectionHints = fields.map((f) => f.name).filter((n) => !COMMON_FIELDS.has(n));

    const entry = {
      name: modelName,
      identityConst: id.identityConst,
      modelType: id.modelType,
      collectionPrefix: id.collectionPrefix,
      sourceFile: relativePath,
      fields,
      enums: relevantEnums,
      detectionHints
    };
    if (id.parentIdentityConst) entry.parentIdentityConst = id.parentIdentityConst;
    out.push(entry);
  }
  return out;
}

function findIdentities(content) {
  const out = [];
  const re = /export const (\w+Identity)\s*=\s*firestoreModelIdentity\(/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const endParen = findMatching(content, openParen, '(', ')');
    if (endParen < 0) continue;
    const args = splitTopLevel(content.slice(openParen + 1, endParen));
    const quoted = /^['"]([^'"]+)['"]$/;
    let parentIdentityConst;
    let modelType;
    let collectionPrefix;
    if (args.length === 1) {
      const q = args[0].match(quoted);
      modelType = q ? q[1] : undefined;
    } else if (args.length === 2) {
      const q0 = args[0].match(quoted);
      if (q0) {
        modelType = q0[1];
        const q1 = args[1].match(quoted);
        collectionPrefix = q1 ? q1[1] : undefined;
      } else {
        parentIdentityConst = args[0];
        const q1 = args[1].match(quoted);
        modelType = q1 ? q1[1] : undefined;
      }
    } else if (args.length >= 3) {
      parentIdentityConst = args[0];
      const q1 = args[1].match(quoted);
      modelType = q1 ? q1[1] : undefined;
      const q2 = args[2].match(quoted);
      collectionPrefix = q2 ? q2[1] : undefined;
    }
    if (modelType) {
      out.push({ identityConst: m[1], modelType, collectionPrefix, parentIdentityConst });
    }
  }
  return out;
}

function findInterfaces(content) {
  const out = [];
  const re = /export interface (\w+)(?:<[^{]+>)?(?:\s+extends\s+([^{]+))?\s*\{/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const openIdx = content.indexOf('{', m.index + m[0].length - 1);
    if (openIdx < 0) continue;
    const endIdx = findMatching(content, openIdx, '{', '}');
    if (endIdx < 0) continue;
    const body = content.slice(openIdx + 1, endIdx);
    const props = parseInterfaceBody(body);
    const description = extractPrecedingJsdoc(content, m.index);
    out.push({ name: m[1], description, props });
  }
  return out;
}

function parseInterfaceBody(body) {
  const out = [];
  const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(readonly\s+)?([A-Za-z_$][\w$]*)(\?)?:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const tsType = m[5].replace(/\s+/g, ' ').trim();
    const isOptional = Boolean(m[4]) || /^Maybe</.test(tsType);
    out.push({
      name: m[3],
      tsType,
      optional: isOptional,
      description: cleanJsdoc(m[1])
    });
  }
  return out;
}

function findConverters(content) {
  const out = [];
  const re = /export const (\w+Converter)\s*=\s*snapshotConverterFunctions<([^>]+)>\(/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const endParen = findMatching(content, openParen, '(', ')');
    if (endParen < 0) continue;
    const inner = content.slice(openParen + 1, endParen);
    const fieldsIdx = inner.indexOf('fields:');
    if (fieldsIdx < 0) continue;
    const openBrace = inner.indexOf('{', fieldsIdx);
    if (openBrace < 0) continue;
    const endBrace = findMatching(inner, openBrace, '{', '}');
    if (endBrace < 0) continue;
    const fields = parseFieldsBody(inner.slice(openBrace + 1, endBrace));
    out.push({ converterConst: m[1], interfaceName: m[2].trim(), fields });
  }
  return out;
}

function parseFieldsBody(body) {
  const out = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (i >= body.length) break;
    const rest = body.slice(i);
    const km = rest.match(/^([A-Za-z_$][\w$]*)\s*:\s*/);
    if (!km) {
      i++;
      continue;
    }
    const key = km[1];
    i += km[0].length;
    const exprStart = i;
    let depth = 0;
    let inString = null;
    while (i < body.length) {
      const c = body[i];
      const prev = body[i - 1];
      if (inString) {
        if (c === inString && prev !== '\\') inString = null;
        i++;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        inString = c;
        i++;
        continue;
      }
      if (c === '{' || c === '(' || c === '[') depth++;
      else if (c === '}' || c === ')' || c === ']') depth--;
      else if (c === ',' && depth === 0) break;
      i++;
    }
    const expr = body.slice(exprStart, i).replace(/\s+/g, ' ').trim();
    out.push({ key, converter: expr });
  }
  return out;
}

function findEnums(content) {
  const out = [];
  const re = /export enum (\w+)\s*\{/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const openIdx = content.indexOf('{', m.index + m[0].length - 1);
    if (openIdx < 0) continue;
    const endIdx = findMatching(content, openIdx, '{', '}');
    if (endIdx < 0) continue;
    const body = content.slice(openIdx + 1, endIdx);
    const entry = {
      name: m[1],
      values: parseEnumBody(body)
    };
    const description = extractPrecedingJsdoc(content, m.index);
    if (description) entry.description = description;
    out.push(entry);
  }
  return out;
}

/**
 * Finds the JSDoc block immediately preceding `pos` — i.e. a `/** ... *\/`
 * separated from the declaration by only whitespace. Returns the first
 * paragraph of the description, or undefined when no immediately-preceding
 * JSDoc exists.
 */
function extractPrecedingJsdoc(content, pos) {
  let i = pos - 1;
  while (i >= 0 && /\s/.test(content[i])) i--;
  if (i < 2) return undefined;
  if (content[i] !== '/' || content[i - 1] !== '*') return undefined;
  const commentEnd = i - 1;
  const commentStart = content.lastIndexOf('/**', commentEnd - 1);
  if (commentStart < 0) return undefined;
  const body = content.slice(commentStart + 3, commentEnd);
  return cleanJsdoc(body);
}

function parseEnumBody(body) {
  const out = [];
  const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?([A-Z][A-Z0-9_]*)\s*(?:=\s*(-?\d+|'[^']*'|"[^"]*"))?\s*,?/g;
  let m;
  let autoValue = 0;
  while ((m = re.exec(body)) !== null) {
    if (!m[2]) continue;
    let value;
    if (m[3]) {
      if (m[3].startsWith("'") || m[3].startsWith('"')) {
        value = m[3].slice(1, -1);
      } else {
        value = Number(m[3]);
        autoValue = value + 1;
      }
    } else {
      value = autoValue;
      autoValue++;
    }
    const entry = { name: m[2], value };
    const desc = cleanJsdoc(m[1]);
    if (desc) entry.description = desc;
    out.push(entry);
  }
  return out;
}

function findEnumInType(tsType, enumNames) {
  for (const name of enumNames) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(tsType)) return name;
  }
  return undefined;
}

function findEnumInConverter(expr, enumNames) {
  const m = expr.match(/firestoreEnum<(\w+)>|optionalFirestoreEnum<(\w+)>/);
  if (!m) return undefined;
  const name = m[1] ?? m[2];
  return enumNames.has(name) ? name : undefined;
}

function findMatching(content, openIdx, open, close) {
  let depth = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < content.length; i++) {
    const c = content[i];
    const prev = content[i - 1];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === '*' && c === '/') inBlockComment = false;
      continue;
    }
    if (inString) {
      if (c === inString && prev !== '\\') inString = null;
      continue;
    }
    if (c === '/' && content[i + 1] === '/') {
      inLineComment = true;
      continue;
    }
    if (c === '/' && content[i + 1] === '*') {
      inBlockComment = true;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let start = 0;
  let inString = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1];
    if (inString) {
      if (c === inString && prev !== '\\') inString = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = s.slice(start).trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

function cleanJsdoc(jsdoc) {
  if (!jsdoc) return undefined;
  const lines = jsdoc
    .split('\n')
    .map((l) => l.trim().replace(/^\*\s?/, ''))
    .filter((l) => l.length > 0 && !l.startsWith('@'));
  if (lines.length === 0) return undefined;
  const firstParagraph = [];
  for (const line of lines) {
    if (line.length === 0) break;
    firstParagraph.push(line);
  }
  const joined = firstParagraph.join(' ').trim();
  return joined.length > 0 ? joined : undefined;
}

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function emit(models) {
  const body = serializeArray(models, 0);
  const header = `/* eslint-disable */\n// THIS FILE IS GENERATED by scripts/extract-firebase-models.mjs.\n// Do not edit by hand. Run \`npx nx generate-firebase-models dbx-components-mcp\`.\n\nimport type { FirebaseModel } from './firebase-models.js';\n\nexport const FIREBASE_MODELS: readonly FirebaseModel[] = ${body};\n`;
  return header;
}

/**
 * Custom serializer that emits JS-style object literals with identifier keys
 * and single-quoted strings — matches the workspace's hand-formatted style so
 * regenerating doesn't dirty the working tree on every run. JSON.stringify
 * would emit double-quoted keys and strings, which fights the codebase style.
 */
function serializeValue(value, indent) {
  if (value === null || value === undefined) return 'undefined';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return serializeString(value);
  if (Array.isArray(value)) return serializeArray(value, indent);
  if (typeof value === 'object') return serializeObject(value, indent);
  throw new Error(`Unsupported value type: ${typeof value}`);
}

function serializeString(s) {
  // Prefer single quotes. Escape backslashes and single quotes; preserve other characters.
  const escaped = s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;

function serializeKey(key) {
  return IDENTIFIER_RE.test(key) ? key : serializeString(key);
}

function serializeArray(arr, indent) {
  if (arr.length === 0) return '[]';
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  const items = arr.map((item) => `${pad}${serializeValue(item, indent + 1)}`);
  return `[\n${items.join(',\n')}\n${closePad}]`;
}

function serializeObject(obj, indent) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  const lines = keys.map((key) => `${pad}${serializeKey(key)}: ${serializeValue(obj[key], indent + 1)}`);
  return `{\n${lines.join(',\n')}\n${closePad}}`;
}

main();
