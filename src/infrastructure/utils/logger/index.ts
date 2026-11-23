import { inspect } from 'util';
import winston from 'winston';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
});

const isProduction = process.env.NODE_ENV === 'production';

// Debug only when development is declared; an unset NODE_ENV must not leak
// debug output in a deployed container.
const level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

// An Error in the metadata serializes to `{}` in JSON. Expand it so the stack
// reaches the log.
const expandErrors = winston.format((info) => {
  for (const [key, value] of Object.entries(info)) {
    if (value instanceof Error) {
      info[key] = { ...value, name: value.name, message: value.message, stack: value.stack };
    }
  }
  return info;
});

const base = [winston.format.errors({ stack: true }), expandErrors(), winston.format.timestamp()];

// Production: one JSON line per entry on stdout, for the platform's log
// collector. The container disk is not persistent, so no file transports.
const productionFormat = winston.format.combine(...base, winston.format.json());

const developmentFormat = winston.format.combine(
  ...base,
  winston.format.colorize({ level: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length > 0 ? ` ${inspect(meta, { depth: 5 })}` : '';
    return `${timestamp} ${level}: ${message}${rest}`;
  }),
);

const logger = winston.createLogger({
  level,
  levels,
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});

export default logger;
