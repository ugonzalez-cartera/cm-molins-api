import mongoose from 'mongoose'

import { customAlphabet } from 'nanoid'

import config from '../config.js'

const { model, Schema, connection } = mongoose

const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

connection.db.command({ collMod: 'investees', changeStreamPreAndPostImages: { enabled: true } })

const InvesteeSchema = new Schema({
  _id: { type: String, default: () => newId() },
  name: { type: String, required: true },
  type: { type: String, enum: ['startup', 'industry', 'realState', 'finance'], required: true },
  investedAt: { type: String },
  disinvestedAt: { type: String },
  websiteUrl: { type: String },
  logoUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  headquarters: { type: String},
  description: {
    es: { type: String, required: true },
    en: { type: String, required: true },
    ca: { type: String, required: true },
  },
})

export default model('Investee', InvesteeSchema)
