/**
 * Zod schema + validation for the server registry (WS-A4).
 *
 * Fail closed: a malformed config throws a typed ConfigError with a precise
 * message. Callers must NOT swallow this into an empty registry — an empty
 * registry is only ever the result of a genuinely absent file.
 *
 * Forward-compatible: the schema carries an optional `version` and an optional
 * `profiles` map so profiles (out of scope for 2.0.0) can be added later
 * without a breaking change.
 */
import { z } from 'zod';
import { errorMessage } from './errors.js';

export const CURRENT_REGISTRY_VERSION = 2;

/** Thrown when a registry file exists but cannot be validated. Fail-closed signal. */
export class ConfigError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const ServerConfigSchema = z
  .object({
    transport: z.enum(['stdio', 'http']),
    // stdio
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    // http
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    // common
    auth: z
      .object({
        type: z.literal('oauth'),
        clientId: z.string().optional(),
        scopes: z.array(z.string()).optional(),
      })
      .optional(),
    keywords: z.array(z.string()).optional(),
    idleTimeoutMs: z.number().int().nonnegative().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.transport === 'stdio' && !cfg.command) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stdio server requires "command"' });
    }
    if (cfg.transport === 'http' && !cfg.url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'http server requires "url"' });
    }
  });

export type ServerConfigInput = z.infer<typeof ServerConfigSchema>;

/** Placeholder for future per-profile overrides. Accepted but unused in 2.0.0. */
export const ProfileSchema = z.object({
  servers: z.array(z.string()).optional(),
});

export const RegistrySchema = z.object({
  version: z.number().int().positive().optional(),
  servers: z.record(ServerConfigSchema),
  profiles: z.record(ProfileSchema).optional(),
});

export type RegistryInput = z.infer<typeof RegistrySchema>;

/**
 * Parse + validate raw file text into a versioned registry.
 * Throws ConfigError (fail-closed) on any malformed input. Never returns
 * a silently-empty registry to mask corruption.
 */
export function parseRegistry(raw: string): RegistryInput {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err: unknown) {
    throw new ConfigError('Registry file is not valid JSON', errorMessage(err));
  }

  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new ConfigError('Registry root must be a JSON object');
  }

  // Null-check servers explicitly for a precise message (was a bare TypeError).
  const servers = (json as Record<string, unknown>).servers;
  if (servers === undefined || servers === null) {
    throw new ConfigError('Registry is missing the required "servers" key');
  }
  if (typeof servers !== 'object' || Array.isArray(servers)) {
    throw new ConfigError('Registry "servers" must be an object');
  }

  const migrated = migrateRegistry(json as Record<string, unknown>);

  const result = RegistrySchema.safeParse(migrated);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join('.') || '<root>';
    throw new ConfigError(`Invalid registry config at "${path}": ${first?.message ?? 'unknown error'}`);
  }
  return result.data;
}

/**
 * Migrate a 1.x-shaped registry to 2.x. The 1.x shape is simply the 2.x shape
 * without a `version` field; migration stamps the current version. Kept as a
 * discrete step so future breaking shape changes have a home.
 */
export function migrateRegistry(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.version === 'number' ? raw.version : 1;
  if (version >= CURRENT_REGISTRY_VERSION) return raw;
  // 1.x -> 2.x: preserve all existing keys, stamp the version.
  return { ...raw, version: CURRENT_REGISTRY_VERSION };
}
