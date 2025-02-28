import { model, Schema } from 'mongoose'

import config from '../config.js'

import { changeLogPlugin } from '../changeLogPlugin.js'

import { customAlphabet } from 'nanoid'
const newId = customAlphabet(config.nanoid.alphabet, config.nanoid.length)


const UserSchema = new Schema({
  _id: { type: String, default: () => `usr_${newId()}` },
  givenName: { type: String, required: true },
  familyName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  country: { type: String, required: true, default: 'es' },
  roles: { type: Array, required: true },
  isNotActive: { type: Boolean },
  lastSessionAt: { type: Date },
},
{
  collection: 'users',
  timestamps: true,
  // User info is important -- specify write concern of 'majority'.
  writeConcern: { w: 'majority', j: true, wtimeout: 5000 },
  versionKey: false,
  id: false, // No additional id as virtual getter.
  toJSON: { versionKey: false, virtuals: true },
  toObject: { versionKey: false },
  })

  UserSchema.plugin(changeLogPlugin)

export default model('User', UserSchema)
