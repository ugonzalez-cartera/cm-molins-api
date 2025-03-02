'use strict'

import fs from 'fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default async function () {
  // First, import and initialize all schemas.
  const schemaFileList = fs.readdirSync(resolve(__dirname, '../schemas')).filter(fn => fn.endsWith('.schema.js'))

  // Wait for all schemas to be registered.
  await Promise.all(schemaFileList.map(async (schema) => {
    if (process.env.NODE_ENV === 'development') console.info('Initializing schema:', schema)
    await import(resolve(__dirname, '../schemas', schema))
  }))

  // Only after all schemas are registered, import models.
  const modelFileList = fs.readdirSync(resolve(__dirname, '.')).filter(fn => fn.endsWith('.model.js'))

  // Wait for all models to be initialized.
  await Promise.all(modelFileList.map(async (model) => {
    if (process.env.NODE_ENV === 'development') console.info('Initializing model:', model)
    await import(resolve(__dirname, model))
  }))
}
