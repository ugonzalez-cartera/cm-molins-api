import { Schema } from 'mongoose'

export const FileSchema = new Schema({
  _id: false,
  secureUrl: { type: String },
  publicId: { type: String },
},
{
  id: false, // No additional id as virtual getter.
})
