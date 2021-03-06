const test = require('bron');
const assert = require('assert');
const { EOL } = require('os');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const stream = require('stream');
const fs = require('fs');
const { factory, runTasks } = require('release-it/test/util');

const conventionalRecommendedBump = sinon.stub().callsFake((options, cb) => {
  if (options.preset === 'angular') return cb(null, { releaseType: 'minor' });
  cb(new Error('Something went wrong'));
});

const conventionalChangelog = sinon.stub().callsFake(options => {
  const s = new stream.Readable();
  s._read = () => {};
  process.nextTick(() => {
    s.emit('data', 'The changelog');
    if (options.releaseCount < 0) s.emit('error', new Error('Something went wrong'));
    s.emit('end');
  });
  return s;
});

const Plugin = proxyquire('.', {
  'conventional-recommended-bump': conventionalRecommendedBump,
  'conventional-changelog': conventionalChangelog
});

const namespace = 'conventional-changelog';
const preset = 'angular';
const infile = 'CHANGES.md';

test('should not throw', async t => {
  const options = { [namespace]: { preset } };
  const plugin = factory(Plugin, { namespace, options });
  await assert.doesNotReject(runTasks(plugin));
});

test('should set changelog', async t => {
  const options = { [namespace]: { preset } };
  const plugin = factory(Plugin, { namespace, options });
  await runTasks(plugin);
  const { changelog } = plugin.config.getContext();
  assert.strictEqual(changelog, 'The changelog');
});

test('should use recommended bump', async t => {
  const options = { [namespace]: { preset } };
  const plugin = factory(Plugin, { namespace, options });
  await runTasks(plugin);
  const { version } = plugin.config.getContext();
  assert.strictEqual(version, '1.1.0');
});

test('should use provided increment', async t => {
  const options = { increment: 'major', [namespace]: { preset } };
  const plugin = factory(Plugin, { namespace, options });
  await runTasks(plugin);
  const { version } = plugin.config.getContext();
  assert.strictEqual(version, '2.0.0');
});

test('should use provided version', async t => {
  const options = { increment: '1.2.3', [namespace]: { preset } };
  const plugin = factory(Plugin, { namespace, options });
  await runTasks(plugin);
  const { version } = plugin.config.getContext();
  assert.strictEqual(version, '1.2.3');
});

test(`should write and update infile (${infile})`, async t => {
  const options = { [namespace]: { preset, infile } };
  const plugin = factory(Plugin, { namespace, options });
  await runTasks(plugin);
  const changelog = fs.readFileSync(infile);
  assert.strictEqual(changelog.toString().trim(), 'The changelog');
  {
    await runTasks(plugin);
    const changelog = fs.readFileSync(infile);
    assert.strictEqual(changelog.toString().trim(), `The changelog${EOL}${EOL}The changelog`);
  }
  fs.unlinkSync(infile);
});

test('should reject if conventional bump passes error', async t => {
  const options = { [namespace]: { preset: 'what?' } };
  const plugin = factory(Plugin, { namespace, options });
  await assert.rejects(runTasks(plugin), /Something went wrong/);
});

test('should reject if conventional changelog has error', async t => {
  const options = { [namespace]: { preset, releaseCount: -1 } };
  const plugin = factory(Plugin, { namespace, options });
  await assert.rejects(runTasks(plugin), /Something went wrong/);
});

test('should not write infile in dry run', async t => {
  const infile = 'DRYRUN.md';
  const options = { [namespace]: { preset, infile } };
  const plugin = factory(Plugin, { namespace, options, global: { isDryRun: true } });
  const spy = sinon.spy(plugin, 'writeChangelog');
  await runTasks(plugin);
  assert.strictEqual(spy.callCount, 0);
  assert.throws(() => fs.readFileSync(infile), /no such file/);
});
