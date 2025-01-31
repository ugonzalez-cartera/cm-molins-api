import mongoose from 'mongoose'

import config from '../../config.js'

import argon2 from 'argon2'

const Sysusers = mongoose.model('Sysuser')
const Counselors = mongoose.model('Counselor')
const UsersMetadata = mongoose.model('UserMetadata')

// --------------------
export async function getOwnUser (req, reply) {
  const { id } = req.user

  try {
    let user = await Sysusers.findOne({ _id: id }).lean()
    if (!user) {
      user = await Counselors.findOne({ _id: id }).lean()
    }

    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not get user.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function updateOwnUser (req, reply) {
  const { id: userId } = req.user
  const { givenName, familyName, email } = req.body

  try {
    let prefix = 'sys_'

    let user = await Sysusers.findOne({ _id: userId })
    if (!user) {
      user = await Counselors.findOne({ _id: userId })
      prefix = 'coun_'
    }

    if (!user) return reply.notFound('User not found.')

    user.givenName = givenName
    user.familyName = familyName
    user.email = email

    await user.save()

    return user
  } catch (err) {
    console.error(' !! Could not update user.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function updateOwnPassword (req, reply) {
  const { id: userId } = req.user
  const { currentPassword, newPassword } = req.body

  if (!config.strongPassword.test(newPassword)) {
    return reply.badRequest('Password is not strong enough.')
  }

  try {
    const userMeta = await UsersMetadata.findOne({ _id: userId }).select('+password')
    if (!userMeta) {
      return reply.notFound('User metadata not found.')
    }

    if (userMeta.isNotActive) {
      return reply.forbidden('User is suspended.')
    }

    const passwordsMatch = await argon2.verify(userMeta.toJSON().password, currentPassword)
    if (!passwordsMatch) {
      return reply.unauthorized()
    }

    userMeta.password = await argon2.hash(newPassword, { type: argon2.argon2id })
    await userMeta.save()

    reply.send({ msg: 'Password updated.' })
  } catch (err) {
    console.error(' !! Could not update password.', err)
    reply.internalServerError('DB error.')
  }
}
