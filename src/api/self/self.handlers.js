import mongoose from 'mongoose'

import config from '../../config.js'

import argon2 from 'argon2'

const UsersMetadata = mongoose.model('UserMetadata')
const Users = mongoose.model('User')

// --------------------
export async function getOwnUser (req, reply) {
  const { id } = req.user

  try {
    const user = await Users.findOne({ _id: id }).lean()

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
  const { givenName, familyName, email, isNotActive } = req.body

  try {
    const user = await Users.findOne({ _id: userId })

    if (!user) return reply.notFound('User not found.')

    user.givenName = givenName
    user.familyName = familyName
    user.email = email
    user.updatedBy = userId

    if (isNotActive) {
      const isUserNotActive = isNotActive === 'true' ? true : false
      user.isNotActive = isUserNotActive
    }

    await user.save({ updatedBy: userId })

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
