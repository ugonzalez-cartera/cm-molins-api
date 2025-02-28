'use strict'

import fs from 'fs'

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


// First, import schemas from the schema folder.
const schemaFileList = fs.readdirSync('./src/schemas/').filter(fn => fn.endsWith('.schema.js'))

// Then, import models from the model folder.
const modelFileList = fs.readdirSync('./src/models/').filter(fn => fn.endsWith('.model.js'))

export default async function () {
  // Initialize schemas first.
  for (const schema of schemaFileList) {
    if (process.env.NODE_ENV === 'development') console.info('Initializing schema:', schema)
    await import(resolve(__dirname, '../schemas', schema))
  }

  // Then initialize models.
  for (const model of modelFileList) {
    if (process.env.NODE_ENV === 'development') console.info('Initializing model:', model)
      import(resolve(__dirname, model))
  }
}
