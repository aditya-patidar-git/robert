/**
 * Unit tests for Security (Category A: Test 12).
 * Checks that secrets are not exposed in code patterns.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*['"][^'"]+['"]/,
  /TWILIO_AUTH_TOKEN\s*=\s*['"][^'"]+['"]/,
  /api[Kk]ey\s*:\s*['"][a-zA-Z0-9_-]{20,}['"]/,
  /sk-[a-zA-Z0-9]{20,}/,
];

const EXCLUDE_DIRS = ['node_modules', '.git', 'coverage', 'dist', 'build', 'tests/archive'];

function walkDir(dir, ext, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.some(d => full.includes(d))) walkDir(full, ext, files);
    } else if (e.isFile() && (ext === null || e.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

describe('Security', () => {
  it('does not find hardcoded API keys in .js source files', () => {
    const jsFiles = walkDir(path.join(repoRoot, 'robert-agent-service/src'), '.js');
    const violations = [];
    for (const file of jsFiles.slice(0, 50)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          violations.push({ file, pattern: pattern.toString() });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('does not find sk- prefixed keys in test helpers', () => {
    const helperPath = path.join(repoRoot, 'tests/unit/helpers');
    if (!fs.existsSync(helperPath)) return;
    const files = walkDir(helperPath, '.js');
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]{30,}/);
    }
  });
});
