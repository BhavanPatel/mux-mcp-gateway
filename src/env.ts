import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { logger } from './logger.js';

/**
 * Load environment variables from:
 * 1. ~/.mux/.env (project-specific overrides)
 * 2. ~/.env (user-level)
 * 3. Shell profile export extraction (zsh/bash)
 */
export function loadEnvFiles(): void {
  const home = homedir();
  const envPaths = [resolve(home, '.mux', '.env'), resolve(home, '.env')];

  // Load .env files
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      parseEnvFile(envPath);
    }
  }

  // Extract exported vars from the user's default shell
  loadShellEnv();
}

function parseEnvFile(path: string): void {
  try {
    const content = readFileSync(path, 'utf-8');
    let loaded = 0;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        const [, key, rawVal] = match;
        // Don't override existing env vars (process env takes precedence)
        if (!process.env[key]) {
          process.env[key] = rawVal.replace(/^["']|["']$/g, '');
          loaded++;
        }
      }
    }
    if (loaded > 0) logger.debug(`Loaded ${loaded} vars from ${path}`);
  } catch {
    // ignore read errors
  }
}

function loadShellEnv(): void {
  try {
    // Run the user's login shell to get exported env vars
    const shell = process.env.SHELL || '/bin/zsh';
    const output = execSync(`${shell} -ilc env 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000,
    });

    let loaded = 0;
    for (const line of output.split('\n')) {
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.substring(0, idx);
      const val = line.substring(idx + 1);
      // Only load vars that look like tokens/secrets and aren't already set
      if (!process.env[key] && /^[A-Z][A-Z0-9_]*$/.test(key)) {
        process.env[key] = val;
        loaded++;
      }
    }
    if (loaded > 0) logger.debug(`Loaded ${loaded} vars from shell profile`);
  } catch {
    // Shell env extraction failed — not critical
    logger.debug('Could not extract shell environment (non-fatal)');
  }
}
