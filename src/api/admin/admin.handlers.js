'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')

export async function getChangelogs (req, reply) {
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 10

  const skip = (limit * page) - limit
  const { logId } = req.params

  const [changeLog, changesResult] = await Promise.all([
    ChangeLogs.findOne({ _id: logId }, { changes: { $slice: [skip, limit] } }).populate('changes.updatedBy').lean(),
    ChangeLogs.findOne({ _id: logId }).select('changes').lean()
  ])

  const changes = changesResult ? changesResult.changes : []

  // console.info(changeLog, 'changes')

  if (!changeLog) return reply.notFound('Changelog not found.')

  return {
    docs: changeLog,
    changesCount: changes.length,
  }
}
