'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')

export async function getChangelogs (req, reply) {
  const { logId } = req.params

  const changeLog = await ChangeLogs.aggregate([
      { $match: { _id: logId } },
      { $unwind: '$changes' },
      { $sort: { 'changes.updatedAt': -1 } },
      { $lookup: { from: 'sysusers', localField: 'changes.updatedBy', foreignField: '_id', as: 'changes.updatedBy' } },
      { $unwind: '$changes.updatedBy' },
      { $group: { _id: '$_id', changes: { $push: '$changes' } } },
    ])

  if (!changeLog) return reply.notFound('Changelog not found.')

  return {
    docs: changeLog[0].changes,
    changesCount: changeLog[0].length,
  }
}
