import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  env: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.string().default('info'),
  discordToken: z.string().min(1, 'DISCORD_TOKEN is required'),
  monitorToken: z.string().min(1, 'MONITOR_TOKEN is required'),
  discordPassword: z.string().min(1, 'DISCORD_PASSWORD is required'),
  targetGuildId: z.string().min(1, 'TARGET_GUILD_ID is required'),
  graceDbPath: z.string().default('./data/grace.db'),
  webhookUrl: z.string().optional().or(z.literal('')),
  webhookUsername: z.string().default('Vanity Monitor'),
  claimRetryLimit: z.number().int().min(0).default(3),
  claimRetryDelayMs: z.number().int().min(0).default(1500),
  gatewayReconnectDelayMs: z.number().int().min(0).default(5000),
  heartbeatTimeoutMs: z.number().int().min(0).default(30000),
  graceDays: z.number().int().min(1).default(30)
});

export function loadConfig({ filePath = './config.json' } = {}) {
  const resolvedPath = path.resolve(filePath);
  const fileConfig = fs.existsSync(resolvedPath)
    ? JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
    : {};

  const env = {
    env: process.env.NODE_ENV ?? fileConfig.env ?? 'development',
    logLevel: process.env.LOG_LEVEL ?? fileConfig.logLevel ?? 'info',
    discordToken: process.env.DISCORD_TOKEN ?? fileConfig.discord?.token ?? '',
    monitorToken: process.env.MONITOR_TOKEN ?? fileConfig.discord?.monitorToken ?? '',
    discordPassword: process.env.DISCORD_PASSWORD ?? fileConfig.discord?.password ?? '',
    targetGuildId: process.env.TARGET_GUILD_ID ?? fileConfig.guild?.targetGuildId ?? '',
    graceDbPath: process.env.GRACE_DB_PATH ?? fileConfig.behavior?.graceDbPath ?? './data/grace.db',
    webhookUrl: process.env.WEBHOOK_URL ?? fileConfig.notifications?.webhookUrl ?? '',
    webhookUsername: process.env.WEBHOOK_USERNAME ?? fileConfig.notifications?.webhookUsername ?? 'Vanity Monitor',
    claimRetryLimit: Number(process.env.CLAIM_RETRY_LIMIT ?? fileConfig.behavior?.claimRetryLimit ?? 3),
    claimRetryDelayMs: Number(process.env.CLAIM_RETRY_DELAY_MS ?? fileConfig.behavior?.claimRetryDelayMs ?? 1500),
    gatewayReconnectDelayMs: Number(process.env.GATEWAY_RECONNECT_DELAY_MS ?? fileConfig.behavior?.gatewayReconnectDelayMs ?? 5000),
    heartbeatTimeoutMs: Number(process.env.HEARTBEAT_TIMEOUT_MS ?? fileConfig.behavior?.heartbeatTimeoutMs ?? 30000),
    graceDays: Number(process.env.GRACE_DAYS ?? fileConfig.behavior?.graceDays ?? 30)
  };

  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return parsed.data;
}
