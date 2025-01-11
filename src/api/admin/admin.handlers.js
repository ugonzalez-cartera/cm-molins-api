'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')

export async function getChangelogs (req, reply) {
  const { logId } = req.params
  const changelog = await ChangeLogs.findOne({ _id: logId })

  if (!changelog) return reply.notFound('Changelog not found')

  return changelog
}
