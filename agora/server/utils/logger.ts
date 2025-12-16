/**
 * Simple development logger utility
 * Set LOG_LEVEL env variable: DEBUG, INFO, WARN, ERROR (default: INFO)
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const levels: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

function getLogLevel(): LogLevel {
  const config = useRuntimeConfig()
  const envLevel = (config.logLevel || 'INFO').toUpperCase() as LogLevel
  return levels[envLevel] !== undefined ? envLevel : 'INFO'
}

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[getLogLevel()]
}

function formatMessage(level: LogLevel, context: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` | ${JSON.stringify(data)}` : ''
  return `[${timestamp}] [${level}] [${context}] ${message}${dataStr}`
}

export const logger = {
  debug(context: string, message: string, data?: unknown) {
    if (shouldLog('DEBUG')) {
      console.log(formatMessage('DEBUG', context, message, data))
    }
  },

  info(context: string, message: string, data?: unknown) {
    if (shouldLog('INFO')) {
      console.log(formatMessage('INFO', context, message, data))
    }
  },

  warn(context: string, message: string, data?: unknown) {
    if (shouldLog('WARN')) {
      console.warn(formatMessage('WARN', context, message, data))
    }
  },

  error(context: string, message: string, data?: unknown) {
    if (shouldLog('ERROR')) {
      console.error(formatMessage('ERROR', context, message, data))
    }
  }
}

export default logger
