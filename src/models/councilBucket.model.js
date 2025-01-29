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
  _id: { type: String, required: true }, // _id will be the month and year of the council. Ex: 01-2025
  minutes: { type: String },
  agenda: { type: String },
  call: { type: String, ref: 'Call' },
  year: {  type: String },
  month: { type: String },
  report: { type: FileSchema },
  docs: { type: [FileSchema], default: undefined },
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
