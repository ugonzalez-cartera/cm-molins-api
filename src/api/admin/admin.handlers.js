'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')
const Sysusers = mongoose.model('Sysuser')
const Counselors = mongoose.model('Counselor')

export async function getChangelogs (req, reply) {
  const { logId } = req.params

  const changeLogs = await ChangeLogs.findOne({ _id: logId }).lean()

  if (!changeLogs) return reply.notFound('Changelog not found.')

  const populatedLogs = []
  for (const log of changeLogs.changes) {
    // As log.updatedBy can be either a Sysuser or a Counselor, we need to check both collections.
    let user = await Sysusers.findOne({ _id: log.updatedBy }).lean()

    if (!user) {
      user = await Counselors.findOne({ _id: log.updatedBy }).lean()
    }

    const userDetails = {
      _id: log.updatedBy,
      givenName: user?.givenName,
      familyName: user?.familyName,
      email: user?.email,
      role: user?.role,
    }

    log.updatedBy = userDetails

    populatedLogs.push(log)
  }

  return {
    docs: populatedLogs.reverse(),
    changesCount: changeLogs.changes.length || 0,
  }
}
