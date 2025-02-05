import mongoose from 'mongoose'

import { customAlphabet } from 'nanoid'

import config from '../config.js'

const { model, Schema, connection } = mongoose

const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

connection.db.command({ collMod: 'councils', changeStreamPreAndPostImages: { enabled: true } })

const FileSchema = new Schema({
  _id: false,
  secureUrl: { type: String },
  publicId: { type: String },
},
  {
  id: false, // No additional id as virtual getter.
})

const CallSchema = new Schema({
  _id: false,
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
},
  {
  id: false, // No additional id as virtual getter.
})

const CouncilSchema = new Schema({
  _id: { type: String, default: () => newId() },
  minutes: { type: String },
  agenda: { type: String },
  call: { type: CallSchema },
  year: {  type: Number, required: true },
  month: { type: Number, required: true },
  report: { type: FileSchema },
  docs: { type: [FileSchema], default: [] },
},
{
  collection: 'councils',
  timestamps: true,
  versionKey: false,
  id: false, // No additional id as virtual getter.
  toJSON: { versionKey: false, virtuals: true },
  toObject: { versionKey: false },
},
)

export default model('Council', CouncilSchema)
