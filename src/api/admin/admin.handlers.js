'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')

export async function getChangelogs (req, reply) {
  const { logId } = req.params

  const changeLogs = await ChangeLogs.findOne({ _id: logId }).populate('changes.updatedBy')

  if (!changeLogs) return reply.notFound('Changelog not found.')

  // Sort changes by updatedAt field in descending order.
  const sortedChanges = changeLogs.changes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

  return {
    docs: sortedChanges || [],
    changesCount: changeLogs.changes.length || 0,
  }
}
