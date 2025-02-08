'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')

export async function getChangelogs (req, reply) {
  const { logId } = req.params

  const changeLogs = await ChangeLogs.findOne({ _id: logId }).populate('changes.updatedBy')

  if (!changeLogs) return reply.notFound('Changelog not found.')

  return {
    docs: changeLogs.changes || [],
    changesCount:  changeLogs.changes.length || 0,
  }
}
