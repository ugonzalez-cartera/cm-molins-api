'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')

export async function getChangelogs (req, reply) {
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 10

  const skip = (limit * page) - limit
  const { logId } = req.params

  console.info('Fetching changelogs:', { logId, page, limit, skip })

  const [changeLog, { changes }] = await Promise.all([
    ChangeLogs.findOne({ _id: logId }, { changes: { $slice: [skip, limit] } }).populate('changes.updatedBy').lean(),
    ChangeLogs.findOne({ _id: logId }).select('changes').lean()
  ])

  if (!changeLog) return reply.notFound('Changelog not found.')

  return {
    docs: changeLog,
    changesCount: changes.length,
  }
}
