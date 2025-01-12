import mongoose from 'mongoose'

import { createChangeLog } from '../../services/utils.service.js'

const Sysusers = mongoose.model('Sysuser')
const Counselors = mongoose.model('Counselor')

// --------------------
export async function getSelfUser (req, reply) {
  const { id } = req.user

  try {
    let user = await Sysusers.findOne({ _id: id }).lean()
    if (!user) {
      user = await Counselors.findOne({ _id: id }).lean()
    }

    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not get sysuser.', err)
    return reply.internalServerError(err)
  }
}

// --------------------
export async function updateSelfUser (req, reply) {
  const { id: userId } = req.user
  const { givenName, familyName, email } = req.body

  let prefix = 'sys_'

  try {
    let user = await Sysusers.findOne({ _id: id })
    if (!user) {
      user = await Counselors.findOne({ _id: id })
      prefix = 'coun_'
    }

    if (!user) return reply.notFound('User not found.')

    await createChangeLog({
      collection: user.constructor,
      _id: `${prefix}${userId}`,
      updatedBy: userId,
    })

    user.givenName = givenName
    user.familyName = familyName
    user.email = email

    await user.save()

    return user
  } catch (err) {
    console.error(' !! Could not update sysuser.', err)
    return reply.internalServerError(err)
  }
}
