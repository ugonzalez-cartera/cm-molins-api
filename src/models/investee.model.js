import mongoose from 'mongoose'

import { customAlphabet } from 'nanoid'

import config from '../config.js'

import {  createChangeLog } from '../services/utils.service.js'

const { model, Schema, connection } = mongoose

const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

connection.db.command({ collMod: 'investees', changeStreamPreAndPostImages: { enabled: true } })

const InvesteeSchema = new Schema({
  _id: { type: String, default: () => newId() },
  name: { type: String, required: true },
  type: { type: String, enum: ['startup', 'industry', 'realState', 'finance', 'ventureCapital'], required: true },
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
  updatedBy: { type: String },
},
{
  timestamps: true,
})

const InvesteeModel = model('Investee', InvesteeSchema)

const changeStream = InvesteeModel.watch({ fullDocumentBeforeChange: 'required' })

createChangeLog(changeStream, 'inv')

export default  InvesteeModel
