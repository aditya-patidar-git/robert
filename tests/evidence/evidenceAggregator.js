/**
 * Evidence aggregator: ingests Jest JSON results, maps to requirements matrix, generates Evidence Pack (ZIP + reports).
 */
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { requirementsMatrix } from './requirementsMatrix.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeTestFile(absPath) {
  const cwd = process.cwd();
  const rel = path.relative(cwd, absPath);
  return rel.split(path.sep).join('/');
}

export class EvidenceAggregator {
  constructor(evidenceDir = path.join(__dirname, 'artifacts')) {
    this.evidenceDir = evidenceDir;
    this.testResults = new Map();
    this.artifacts = new Map();
  }

  async ingestJestResults(jestJsonPath) {
    try {
      const raw = await fs.readFile(jestJsonPath, 'utf-8');
      const data = JSON.parse(raw);
      const results = [];
      for (const testResult of data.testResults || []) {
        const testFile = normalizeTestFile(testResult.name);
        for (const ar of testResult.assertionResults || []) {
          results.push({
            testFile,
            testName: ar.fullName,
            status: ar.status,
            duration: ar.duration,
            error: (ar.failureMessages || []).join('\n')
          });
        }
      }
      await this.ingestTestResults('jest', results);
    } catch (err) {
      console.warn(`[EvidenceAggregator] Could not ingest ${jestJsonPath}:`, err.message);
    }
  }

  ingestTestResults(source, results) {
    for (const r of results) {
      const key = `${source}:${r.testFile}:${r.testName}`;
      this.testResults.set(key, { source, ...r, timestamp: new Date().toISOString() });
    }
  }

  async recordArtifact(requirementId, type, data, filename) {
    const reqDir = path.join(this.evidenceDir, requirementId);
    await fs.mkdir(reqDir, { recursive: true });
    const filepath = path.join(reqDir, filename);
    if (typeof data === 'string') {
      await fs.writeFile(filepath, data, 'utf-8');
    } else if (Buffer.isBuffer(data)) {
      await fs.writeFile(filepath, data);
    } else {
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    }
    if (!this.artifacts.has(requirementId)) this.artifacts.set(requirementId, []);
    const stat = await fs.stat(filepath);
    this.artifacts.get(requirementId).push({ type, filename, filepath, size: stat.size, timestamp: new Date().toISOString() });
  }

  _findMatchingResult(step) {
    const normMatrixFile = step.testFile.split(path.sep).join('/');
    for (const value of this.testResults.values()) {
      const fileNorm = value.testFile.split(path.sep).join('/');
      const fileMatches = fileNorm === normMatrixFile || fileNorm.endsWith(normMatrixFile) || normMatrixFile.endsWith(fileNorm);
      const nameMatches = value.testName && value.testName.includes(step.assertionName);
      if (fileMatches && nameMatches) return value;
    }
    return null;
  }

  mapResultsToRequirements() {
    const requirementStatus = {};
    for (const [reqId, requirement] of Object.entries(requirementsMatrix)) {
      const verification = requirement.verification;
      const results = [];
      for (const step of verification) {
        const result = this._findMatchingResult(step);
        results.push({ ...step, result: result || undefined });
      }
      const allPassed = results.length > 0 && results.every((r) => r.result && r.result.status === 'passed');
      const anyFailed = results.some((r) => r.result && r.result.status === 'failed');
      const anyMissing = results.some((r) => !r.result || r.result.status === 'pending' || r.result.status === 'skipped');
      let status = 'INCOMPLETE';
      if (anyFailed) status = 'FAILED';
      else if (allPassed) status = 'PASSED';

      requirementStatus[reqId] = {
        requirement: requirement.description,
        status,
        verification: results,
        artifacts: this.artifacts.get(reqId) || [],
        acceptanceCriteria: requirement.acceptanceCriteria
      };
    }
    return requirementStatus;
  }

  async generateEvidencePack(runNumber = 1) {
    const requirementStatus = this.mapResultsToRequirements();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const packsDir = path.join(__dirname, 'packs');
    const packDir = path.join(packsDir, `run-${runNumber}-${timestamp}`);
    await fs.mkdir(packDir, { recursive: true });

    await fs.writeFile(path.join(packDir, 'requirements-status.json'), JSON.stringify(requirementStatus, null, 2));

    const totalRequirements = Object.keys(requirementStatus).length;
    const passed = Object.values(requirementStatus).filter((r) => r.status === 'PASSED').length;
    const failed = Object.values(requirementStatus).filter((r) => r.status === 'FAILED').length;
    const incomplete = Object.values(requirementStatus).filter((r) => r.status === 'INCOMPLETE').length;
    const summary = { runNumber, timestamp, totalRequirements, passed, failed, incomplete };
    await fs.writeFile(path.join(packDir, 'summary.json'), JSON.stringify(summary, null, 2));

    const artifactsDir = path.join(packDir, 'artifacts');
    await fs.mkdir(artifactsDir, { recursive: true });
    for (const [reqId, artifacts] of this.artifacts.entries()) {
      const reqArtifactsDir = path.join(artifactsDir, reqId);
      await fs.mkdir(reqArtifactsDir, { recursive: true });
      for (const artifact of artifacts) {
        try {
          await fs.copyFile(artifact.filepath, path.join(reqArtifactsDir, artifact.filename));
        } catch {
          // ignore missing artifact
        }
      }
    }

    await this._generateHTMLReport(requirementStatus, summary, packDir);

    const zipPath = `${packDir}.zip`;
    await new Promise((resolve, reject) => {
      const out = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      out.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(out);
      archive.directory(packDir, false);
      archive.finalize();
    });

    console.log(`[EvidenceAggregator] Evidence pack: ${zipPath} (${summary.passed}/${summary.totalRequirements} passed)`);
    return { packPath: zipPath, summary, requirementStatus };
  }

  async _generateHTMLReport(requirementStatus, summary, outputDir) {
    const rows = Object.entries(requirementStatus)
      .map(
        ([reqId, req]) => `
    <tr>
      <td>${reqId}</td>
      <td>${req.requirement}</td>
      <td class="${req.status.toLowerCase()}">${req.status}</td>
      <td><ul>${req.verification.map((v) => `<li>${v.type}: ${v.assertionName} – ${v.result ? v.result.status : 'NOT RUN'}</li>`).join('')}</ul></td>
      <td>${req.artifacts.length} artifact(s)</td>
    </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Evidence Pack – Run ${summary.runNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 5px; }
    .passed { color: green; font-weight: bold; }
    .failed { color: red; font-weight: bold; }
    .incomplete { color: orange; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>Evidence Pack – Run ${summary.runNumber}</h1>
  <div class="summary">
    <p><strong>Timestamp:</strong> ${summary.timestamp}</p>
    <p><strong>Total requirements:</strong> ${summary.totalRequirements}</p>
    <p class="passed">Passed: ${summary.passed}</p>
    <p class="failed">Failed: ${summary.failed}</p>
    <p class="incomplete">Incomplete: ${summary.incomplete}</p>
  </div>
  <h2>Requirements status</h2>
  <table>
    <tr><th>Requirement ID</th><th>Description</th><th>Status</th><th>Verification steps</th><th>Artifacts</th></tr>
    ${rows}
  </table>
</body>
</html>`;
    await fs.writeFile(path.join(outputDir, 'report.html'), html);
  }
}

export default EvidenceAggregator;
