import { Schema } from 'mongoose'

export const LogSchema = new Schema({
  key: { type: String, required: true },
  old: { type: Schema.Types.Mixed },
  new: { type: Schema.Types.Mixed },
  updatedBy: { type: String, ref: 'Sysuser', default: 'SYSTEM' },
},
{
  _id: false,
  timestamps: { createdAt: false, updatedAt: true },
})
