import mongoose from 'mongoose'

import config from '../config.js'

import { customAlphabet } from 'nanoid'

const { model, Schema, connection } = mongoose

const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

const CallSchema = new Schema({
  _id: { type: String, default: () => newId() },
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  council: { type: String, ref: 'Council' },
},
{
  collection: 'councils',
  timestamps: true,
  versionKey: false,
  id: false, // No additional id as virtual getter.
  toJSON: { versionKey: false, virtuals: true },
  toObject: { versionKey: false },
  })

export default model('Call', CallSchema)
