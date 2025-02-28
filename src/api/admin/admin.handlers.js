'use strict'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')
const Users = mongoose.model('User')

export async function getChangelogs (req, reply) {
  const { logId } = req.params

  const changeLogs = await ChangeLogs.findOne({ _id: logId }).lean()

  if (!changeLogs) return reply.notFound('Changelog not found.')

  const populatedLogs = []
  for (const log of changeLogs.changes) {
    // As log.updatedBy can be either a Sysuser or a Counselor, we need to check both collections.
    const user = await Users.findOne({ _id: log.updatedBy }).lean()
    console.info(user)

    const userDetails = {
      _id: log.updatedBy,
      givenName: user?.givenName,
      familyName: user?.familyName,
      roles: user?.roles,
    }

    log.updatedBy = userDetails

    populatedLogs.push(log)
  }

  return {
    docs: populatedLogs.reverse(),
    changesCount: changeLogs.changes.length || 0,
  }
}
