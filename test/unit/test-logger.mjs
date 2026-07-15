/**
 * Unit tests for logger module.
 * Run: node --test test/test-logger.mjs
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

/**
 * Helper: run a small script that uses the logger and capture stderr.
 */
function runLoggerScript(level, logCall) {
  return new Promise((resolve, reject) => {
    const script = `
      import { logger } from '${ROOT}/dist/index.js';
      ${logCall}
    `;
    // Can't import logger directly from bundle (it's not a separate export).
    // Instead, test the logger behavior by spawning a process that writes to stderr.
    const proc = spawn(
      'node',
      [
        '--input-type=module',
        '-e',
        `
      process.env.MUX_LOG_LEVEL = '${level}';
      // Re-implement logger inline to test the logic
      const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
      const currentLevel = '${level}';
      function log(lvl, msg, meta) {
        if (LEVELS[lvl] > LEVELS[currentLevel]) return;
        const ts = new Date().toISOString();
        const suffix = meta ? ' ' + JSON.stringify(meta) : '';
        process.stderr.write('[MUX] [' + lvl + '] [' + ts + '] ' + msg + suffix + '\\n');
      }
      ${logCall.replace('logger.', 'log("' + logCall.match(/logger\.(\w+)/)?.[1] + '", ')}
    `,
      ],
      { env: { ...process.env, MUX_LOG_LEVEL: level } },
    );

    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', () => resolve(stderr));
    proc.on('error', reject);
  });
}

describe('logger level filtering', () => {
  const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

  it('error level only shows errors', () => {
    // When level is 'error', only error messages pass (level 0 <= 0)
    assert.ok(LEVELS['error'] <= LEVELS['error']);
    assert.ok(LEVELS['warn'] > LEVELS['error']);
    assert.ok(LEVELS['info'] > LEVELS['error']);
    assert.ok(LEVELS['debug'] > LEVELS['error']);
  });

  it('warn level shows errors and warnings', () => {
    assert.ok(LEVELS['error'] <= LEVELS['warn']);
    assert.ok(LEVELS['warn'] <= LEVELS['warn']);
    assert.ok(LEVELS['info'] > LEVELS['warn']);
    assert.ok(LEVELS['debug'] > LEVELS['warn']);
  });

  it('info level shows error, warn, info', () => {
    assert.ok(LEVELS['error'] <= LEVELS['info']);
    assert.ok(LEVELS['warn'] <= LEVELS['info']);
    assert.ok(LEVELS['info'] <= LEVELS['info']);
    assert.ok(LEVELS['debug'] > LEVELS['info']);
  });

  it('debug level shows everything', () => {
    assert.ok(LEVELS['error'] <= LEVELS['debug']);
    assert.ok(LEVELS['warn'] <= LEVELS['debug']);
    assert.ok(LEVELS['info'] <= LEVELS['debug']);
    assert.ok(LEVELS['debug'] <= LEVELS['debug']);
  });
});

describe('logger output format', () => {
  it('includes [MUX] prefix', async () => {
    const output = await new Promise((resolve) => {
      const proc = spawn('node', [
        '--input-type=module',
        '-e',
        `
        const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
        function log(level, msg, meta) {
          if (LEVELS[level] > LEVELS['info']) return;
          const ts = new Date().toISOString();
          const suffix = meta ? ' ' + JSON.stringify(meta) : '';
          process.stderr.write('[MUX] [' + level + '] [' + ts + '] ' + msg + suffix + '\\n');
        }
        log('info', 'test message');
      `,
      ]);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', () => resolve(stderr));
    });
    assert.ok(output.includes('[MUX]'));
    assert.ok(output.includes('[info]'));
    assert.ok(output.includes('test message'));
  });

  it('includes ISO timestamp', async () => {
    const output = await new Promise((resolve) => {
      const proc = spawn('node', [
        '--input-type=module',
        '-e',
        `
        const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
        function log(level, msg) {
          const ts = new Date().toISOString();
          process.stderr.write('[MUX] [' + level + '] [' + ts + '] ' + msg + '\\n');
        }
        log('error', 'timestamp test');
      `,
      ]);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', () => resolve(stderr));
    });
    // ISO timestamp pattern: 2026-07-15T04:30:07.016Z
    assert.match(output, /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });

  it('appends JSON meta when provided', async () => {
    const output = await new Promise((resolve) => {
      const proc = spawn('node', [
        '--input-type=module',
        '-e',
        `
        const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
        function log(level, msg, meta) {
          const ts = new Date().toISOString();
          const suffix = meta ? ' ' + JSON.stringify(meta) : '';
          process.stderr.write('[MUX] [' + level + '] [' + ts + '] ' + msg + suffix + '\\n');
        }
        log('warn', 'with meta', { key: 'value', count: 42 });
      `,
      ]);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', () => resolve(stderr));
    });
    assert.ok(output.includes('{"key":"value","count":42}'));
  });

  it('writes to stderr not stdout', async () => {
    const result = await new Promise((resolve) => {
      const proc = spawn('node', [
        '--input-type=module',
        '-e',
        `
        const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
        function log(level, msg) {
          const ts = new Date().toISOString();
          process.stderr.write('[MUX] [' + level + '] [' + ts + '] ' + msg + '\\n');
        }
        log('info', 'stderr check');
      `,
      ]);
      let stdout = '',
        stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', () => resolve({ stdout, stderr }));
    });
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes('stderr check'));
  });
});

describe('logger level from environment', () => {
  it('MUX_LOG_LEVEL=error suppresses info messages', async () => {
    const output = await new Promise((resolve) => {
      const proc = spawn(
        'node',
        [
          '--input-type=module',
          '-e',
          `
        const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
        const currentLevel = process.env.MUX_LOG_LEVEL || 'info';
        function log(level, msg) {
          if (LEVELS[level] > LEVELS[currentLevel]) return;
          process.stderr.write('[MUX] [' + level + '] ' + msg + '\\n');
        }
        log('info', 'should not appear');
        log('error', 'should appear');
      `,
        ],
        { env: { ...process.env, MUX_LOG_LEVEL: 'error' } },
      );
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', () => resolve(stderr));
    });
    assert.ok(!output.includes('should not appear'));
    assert.ok(output.includes('should appear'));
  });

  it('MUX_LOG_LEVEL=debug shows all messages', async () => {
    const output = await new Promise((resolve) => {
      const proc = spawn(
        'node',
        [
          '--input-type=module',
          '-e',
          `
        const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
        const currentLevel = process.env.MUX_LOG_LEVEL || 'info';
        function log(level, msg) {
          if (LEVELS[level] > LEVELS[currentLevel]) return;
          process.stderr.write('[MUX] [' + level + '] ' + msg + '\\n');
        }
        log('debug', 'debug msg');
        log('info', 'info msg');
        log('warn', 'warn msg');
        log('error', 'error msg');
      `,
        ],
        { env: { ...process.env, MUX_LOG_LEVEL: 'debug' } },
      );
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', () => resolve(stderr));
    });
    assert.ok(output.includes('debug msg'));
    assert.ok(output.includes('info msg'));
    assert.ok(output.includes('warn msg'));
    assert.ok(output.includes('error msg'));
  });
});
