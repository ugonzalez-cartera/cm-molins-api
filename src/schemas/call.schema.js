import { Schema } from 'mongoose'

export const CallSchema = new Schema({
  _id: false,
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
},
  {
  id: false, // No additional id as virtual getter.
})
