import mongoose from 'mongoose'

const { model, Schema, connection } = mongoose

connection.db.command({ collMod: 'councils', changeStreamPreAndPostImages: { enabled: true } })

const CouncilSchema = new Schema({
  _id: { type: String, required: true }, //_id will be the year and month of the council: Ex FEB_2025
  minutes: { type: String },
  report: { type: String },
  agenda: { type: String },
  call: { type: String, ref: 'Call' },
  docs: { type: Array },
},
{
  collection: 'councils',
  timestamps: true,
  versionKey: false,
  id: false, // No additional id as virtual getter.
  toJSON: { versionKey: false, virtuals: true },
  toObject: { versionKey: false },
  })

export default model('Council', CouncilSchema)
