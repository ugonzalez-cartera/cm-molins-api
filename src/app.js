import mongoose from 'mongoose'

import autoload from '@fastify/autoload'
import { verifyToken, authorize } from './api/token.handlers.js'
import { logTokens } from './services/authorization.service.js'
import initModels from './models/init.js'
import { createStream } from '@binxhealth/pino-stackdriver'

import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifySensible from '@fastify/sensible'
import fastifyMultipart from '@fastify/multipart'

import config from './config.js'

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Initialize Mongoose models.
initModels()

// Fastify options
let fastifyOptions
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  fastifyOptions = {
    disableRequestLogging: true,
    logger: {
      level: 'info',
      stream: createStream(),
    },
    ignoreTrailingSlash: true,
  }
} else {
  console.info('Setting logging options with ALL levels.')
  fastifyOptions = {
    logger: true,
    ignoreTrailingSlash: true,
  }
}

// Require the framework and instantiate it.
export const fastify = Fastify(fastifyOptions)

fastify
  .register(fastifyCors, {})
  .register(fastifyHelmet)
  .register(fastifySensible)
  .register(fastifyMultipart, {
    // Multipart is required to upload files.
    limits: {
      fieldNameSize: 100, // Max field name size in bytes.
      fieldSize: 100000, // Max field value size in bytes.
      fields: 10, // Max number of non-file fields.
      fileSize: 20000000, // For multipart forms, the max file size. Max 20MB.
      files: 5, // Max number of file fields.
      headerPairs: 1000, // Max number of header key=>value pairs.
    },
  })

fastify.ready(err => {
  if (!err) {
    if (process.env.NODE_ENV === 'development') {
      logTokens()
      console.info('Tokens are logged.')
    }
  } else {
    console.error('Fastify init error', err)
  }
})

// Add global Hooks
fastify.addHook('onRequest', verifyToken)
fastify.addHook('onRequest', authorize)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Register all services in 'api' folder (recursively).
fastify.register(autoload, {
  dir: join(__dirname, 'api'),
  options: { prefix: config.apiPrefix[process.env.NODE_ENV] },
  matchFilter: (p) => p.endsWith('.routes.js'),
})

async function gracefulExit() {
  console.info('  >> Graceful exit. Mongoose connection status:', mongoose.connection.readyState)
  if (mongoose.connection.readyState === 1) {
    // This means that the connection is established and we can safely close it.
    console.info('     Closing Mongoose connection...')
    await mongoose.connection.close()
    console.info('     Mongoose DB connection is now disconnected through app termination.')
  }
  console.info('  >> Exiting process...')
  process.exit(0)
}
process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit).on('exit', gracefulExit)
