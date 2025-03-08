import mongoose from 'mongoose'

import { customAlphabet } from 'nanoid'

import config from '../config.js'

import { changeLogPlugin } from '../changeLogPlugin.js'

import { CallSchema } from '../schemas/call.schema.js'
import { FileSchema } from '../schemas/file.schema.js'

const { model, Schema } = mongoose

const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)

const CouncilSchema = new Schema({
  _id: { type: String, default: () => `ccl_${newId()}` },
  minutes: {
    description: { type: String },
    file: { type: FileSchema },
  },
  agenda: {
    description: { type: String },
    file: { type: FileSchema },
  },
  call: { type: CallSchema },
  year: {  type: Number, required: true },
  month: { type: Number, required: true },
  date: { type: Date, required: true },
  report: {
    file: {
      type: FileSchema,
    },
  },
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

if (!CouncilSchema.options.toJSON) {
  CouncilSchema.options.toJSON = {}
}

CouncilSchema.options.toJSON.transform = function (doc, ret) {
  delete ret.__v
}


CouncilSchema.plugin(changeLogPlugin)

export default model('Council', CouncilSchema)
