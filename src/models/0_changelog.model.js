'use strict'

import { Schema, model } from 'mongoose'

import { LogSchema } from '../schemas/log.schema.js'

const ChangeLogSchema = new Schema({
  _id: { type: String, required: true },
  changes: { type: [LogSchema], default: [] },
},
{
  timestamps: true,
  versionKey: false,
  id: false, // No additional id as virtual getter.
  toJSON: { versionKey: false, virtuals: true },
  toObject: { versionKey: false },
})

export default model('ChangeLog', ChangeLogSchema)
