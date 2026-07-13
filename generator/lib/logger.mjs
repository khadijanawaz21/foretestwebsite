/**
 * generator/lib/logger.mjs
 *
 * Minimal, dependency-free, leveled logger for the FORE static page
 * generator. Single responsibility: format and write log lines — it does
 * not read process.env itself. The log level comes from config.mjs's
 * `config.logLevel`, so config.mjs remains the only module that touches
 * environment variables directly.
 *
 * Level order: debug < info < warn < error. If config.logLevel is unset
 * or unrecognized, this module falls back to 'info' locally — that is a
 * default *behavior* for an absent setting, decided here because
 * interpreting "what to log at" is this module's job, not config.mjs's.
 *
 * warn/error are written to stderr; debug/info to stdout — this matches
 * how CI/build systems (including Vercel's build logs) typically separate
 * and highlight the two streams.
 */
import { config } from '../config.mjs';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const DEFAULT_LEVEL = 'info';

function currentLevelValue() {
  const configured = (config.logLevel || DEFAULT_LEVEL).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, configured)
    ? LEVELS[configured]
    : LEVELS[DEFAULT_LEVEL];
}

function timestamp() {
  return new Date().toISOString();
}

function write(level, scope, message, meta) {
  if (LEVELS[level] < currentLevelValue()) return;

  const line = `[${timestamp()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  const target = level === 'warn' || level === 'error' ? console.error : console.log;

  if (meta !== undefined) {
    target(line, meta);
  } else {
    target(line);
  }
}

/**
 * Creates a scoped logger. Pass the module or subsystem name so log lines
 * are traceable back to their source, e.g. createLogger('supabase').
 *
 * @param {string} scope
 * @returns {{debug: Function, info: Function, warn: Function, error: Function}}
 */
export function createLogger(scope) {
  return {
    debug: (message, meta) => write('debug', scope, message, meta),
    info: (message, meta) => write('info', scope, message, meta),
    warn: (message, meta) => write('warn', scope, message, meta),
    error: (message, meta) => write('error', scope, message, meta),
  };
}
