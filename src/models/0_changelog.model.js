'use strict'

import { Schema, model } from 'mongoose'

const LogSchema = new Schema({
  key: { type: String, required: true },
  old: { type: Schema.Types.Mixed },
  new: { type: Schema.Types.Mixed },
  updatedBy: { type: String, ref: 'Sysuser', default: 'SYSTEM' },
},
{
  _id: false,
  timestamps: { createdAt: false, updatedAt: true },
})

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
