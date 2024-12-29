import { model, Schema } from 'mongoose'

import { customAlphabet } from 'nanoid'

import config from '../config.js'

const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

const InvesteeSchema = new Schema({
  _id: { type: String, default: () => newId() },
  name: { type: String, required: true },
  type: { type: String, enum: ['startup', 'industry', 'realState', 'finance'] },
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
