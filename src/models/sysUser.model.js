import mongoose from 'mongoose'

import { customAlphabet } from 'nanoid'

import config from '../config.js'

import { createChangeLog } from '../services/utils.service.js'

const { model, Schema, connection } = mongoose
const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

connection.db.command({ collMod: 'sysusers', changeStreamPreAndPostImages: { enabled: true } })

const SysuserSchema = new Schema({
  _id: { type: String, default: () => newId() },
  givenName: { type: String, required: true },
  familyName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  country: { type: String, required: true, default: 'es' },
  role: { type: Array, required: true },
  isNotActive: { type: Boolean },
  lastSessionAt: { type: Date },
  updatedBy: { type: String },
},
{
  collection: 'sysusers',
  timestamps: true,
  // User info is important -- specify write concern of 'majority'.
  writeConcern: { w: 'majority', j: true, wtimeout: 5000 },
  versionKey: false,
  id: false, // No additional id as virtual getter.
  toJSON: { versionKey: false, virtuals: true },
  toObject: { versionKey: false },
})

const SysuserModel = model('Sysuser', SysuserSchema)

const changeStream = SysuserModel.watch({ fullDocumentBeforeChange: 'required' })

createChangeLog(changeStream, config.changeLogs.prefixes.sysuser, SysuserModel)

export default SysuserModel
