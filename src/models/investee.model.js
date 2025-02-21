import mongoose from 'mongoose'

import { customAlphabet } from 'nanoid'

import config from '../config.js'

import { changeLogPlugin } from '../changeLogPlugin.js'

const { model, Schema } = mongoose

const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

const InvesteeSchema = new Schema({
  _id: { type: String, default: () => newId() },
  name: { type: String, required: true },
  type: { type: String, enum: ['industry', 'realState', 'finance', 'ventureCapital'], required: true },
  investedAt: { type: Date },
  disinvestedAt: { type: Date },
  websiteUrl: { type: String },
  logoUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  headquarters: { type: String },
  description: {
    es: { type: String, required: true },
    en: { type: String, required: true },
    ca: { type: String, required: true },
  },
},
{
  timestamps: true,
})

InvesteeSchema.plugin(changeLogPlugin)

export default  model('Investee', InvesteeSchema)
