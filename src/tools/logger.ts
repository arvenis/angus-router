import chalk from 'chalk';
import { basename } from 'path';
import { createLogger, format, Logger, transports } from 'winston';

const { combine, colorize, label, printf, splat, timestamp } = format;

const logFormat = (loggerLabel: string) =>
  combine(
    timestamp(),
    splat(),
    colorize(),
    label({ label: loggerLabel }),
    printf(info => `${info.timestamp} ${chalk.cyan(info.label)} ${info.level}: ${info.message}`)
  );

export function getLogger(filename: string): Logger {
  return createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    transports: [new transports.Console({})],
    format: logFormat(`[ANG:${basename(filename)}]`),
  });
}
