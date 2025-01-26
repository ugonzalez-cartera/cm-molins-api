import mongoose from 'mongoose'

const { model, Schema, connection } = mongoose

connection.db.command({ collMod: 'councils', changeStreamPreAndPostImages: { enabled: true } })

const FileSchema = new Schema({
  _id: false,
  secureUrl: { type: String },
  publicId: { type: String },
}, {
  id: false, // No additional id as virtual getter.
})

const CouncilSchema = new Schema({
  _id: { type: String, required: true }, // _id will be the month of the council. Ex: 01-2025
  minutes: { type: String },
  report: { type: FileSchema },
  agenda: { type: String },
  call: { type: String, ref: 'Call' },
  docs: { type: [FileSchema], default: undefined },
  year: {  type: String },
  month: { type: String },
})

const CouncilBucketSchema = new Schema({
  _id: { type: String, required: true }, //_id will be the year of the council: Ex 2025
  councils: { type: [CouncilSchema], default: undefined },
},
{
  collection: 'councils',
  timestamps: true,
  versionKey: false,
  id: false, // No additional id as virtual getter.
  toJSON: { versionKey: false, virtuals: true },
  toObject: { versionKey: false },
})

export default model('CouncilBucket', CouncilBucketSchema)
