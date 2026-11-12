const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const action = path.join(__dirname, '..', 'dist', 'index.js');

function run(inputs, payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haslabel-'));
  const eventPath = path.join(dir, 'event.json');
  const outputPath = path.join(dir, 'output');
  fs.writeFileSync(eventPath, JSON.stringify(payload));
  fs.writeFileSync(outputPath, '');
  const env = {
    PATH: process.env.PATH,
    HOME: dir,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_OUTPUT: outputPath,
    INPUT_CONTAINS: inputs.contains || '',
    INPUT_EXACT: inputs.exact || '',
  };
  const res = spawnSync(process.execPath, [action], { env, encoding: 'utf8' });
  return { status: res.status, outputs: parseOutputs(fs.readFileSync(outputPath, 'utf8')) };
}

function parseOutputs(text) {
  const outputs = {};
  const re = /^([^<\n]+)<<(\S+)\n([\s\S]*?)\n\2$/gm;
  let m;
  while ((m = re.exec(text)) !== null) outputs[m[1]] = m[3];
  return outputs;
}

const pr = (...names) => ({ labels: names.map((name) => ({ name })) });

test('labeled: contains matches the added label', () => {
  const r = run({ contains: 'env' }, { action: 'labeled', label: { name: 'env-bonko' }, pull_request: pr('env-bonko') });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(r.outputs, { 'labeled-env': 'true', 'label-name': 'env-bonko' });
});

test('synchronize: contains finds the label on the pull request', () => {
  const r = run({ contains: 'env' }, { action: 'synchronize', pull_request: pr('bug', 'env-stage') });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(r.outputs, { 'labeled-env': 'true', 'label-name': 'env-stage' });
});

test('opened: no matching label sets no output', () => {
  const r = run({ contains: 'env' }, { action: 'opened', pull_request: pr('bug') });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(r.outputs, {});
});

test('unlabeled: contains matches the removed label', () => {
  const r = run({ contains: 'env' }, { action: 'unlabeled', label: { name: 'env-bonko' }, pull_request: pr() });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(r.outputs, { 'unlabeled-env': 'true', 'label-name': 'env-bonko' });
});

test('exact: matches only the identical label', () => {
  const hit = run({ exact: 'deploy' }, { action: 'labeled', label: { name: 'deploy' }, pull_request: pr('deploy') });
  assert.strictEqual(hit.status, 0);
  assert.deepStrictEqual(hit.outputs, { 'labeled-deploy': 'true' });
  const miss = run({ exact: 'deploy' }, { action: 'labeled', label: { name: 'deploy-now' }, pull_request: pr('deploy-now') });
  assert.strictEqual(miss.status, 0);
  assert.deepStrictEqual(miss.outputs, {});
});

test('other events are skipped successfully', () => {
  const r = run({ contains: 'env' }, { action: 'closed', pull_request: pr('env-bonko') });
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(r.outputs, {});
});

test('no label input fails', () => {
  const r = run({}, { action: 'labeled', label: { name: 'env-bonko' }, pull_request: pr('env-bonko') });
  assert.strictEqual(r.status, 1);
});
