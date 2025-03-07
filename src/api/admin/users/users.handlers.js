import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

import config from '../../../config.js'

import { sendCreateUserEmail } from '../../../services/notification.service.js'
import { generateStrongPassword } from '../../../services/utils.service.js'
import { CustomError } from '../../../utils.js'

const Users = mongoose.model('User')
const UsersMetadata = mongoose.model('UserMetadata')
const ChangeLogs = mongoose.model('ChangeLog')

// --------------------
async function createUser (req, reply) {
  const { origin } = req.headers

  const { email, givenName, familyName, roles } = req.body
  if (!email) {
    const error = CustomError.toJSON({
      title: '!! Email is required',
      detail: 'Email is required to create a new user.',
      status: 400,
    })
    return reply.status(error.status).send(error)
  }

  try {
    const isExistingUser = await Users.exists({ email })
    if (isExistingUser) {
      const error = CustomError.toJSON({
        title: '!! User already exists',
        detail: 'An user with this email already exists.',
        status: 409,
        instance: req.url,
      })
      return reply.status(error.status).send(error)
    }

    // Sort roles according to roleList order.
    const sortedRoles = roles ? config.roleList.filter(role => roles.includes(role)) : []
    const user = new Users({
      email,
      givenName,
      familyName,
      country: 'es',
      roles: sortedRoles,
    })

    await user.validate()

    const password = generateStrongPassword()

    const hash = await argon2.hash(password, { type: argon2.argon2id })

    const payload = {
      sub: user._id,
    }

    const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.newUserTokenExpiration })

    const newUserMeta = new UsersMetadata({ _id: user._id, password: hash, verificationToken: token })

    await Promise.all([
      user.save(),
      newUserMeta.save(),
    ])

    const emailData = {
      _id: user._id,
      name: user.givenName.toUpperCase(),
      familyName: user.familyName.toUpperCase(),
      email: user.email,
      locale: user.country,
      subject: `Bienvenido - ${user.givenName} ${user.familyName}`,
      body: 'Para crear tu contraseña personalizada, haz clic en el botón',
      ctaText: 'Crear nueva contraseña',
    }

    await sendCreateUserEmail({ userData: user, emailData, token, baseUrl: origin })

    return user
  } catch (err) {
    const error = CustomError.toJSON({
      title: '!! Could not create user',
      detail: err.message,
      status: 500,
      instance: req.url,
    })
    console.error(err)
    return reply.status(error.status).send(error)
  }
}

// --------------------
export async function getUsers (req, reply) {
  const { id: userId } = req.user
  const { limit, page, sort, roles } = req.query

  const filter = {
    _id: { $not: { $eq: userId } },
    roles: { $in: roles.split(',') },

  }
  const skip = (limit * page) - limit

  try {
    const [docs, docCount] = await Promise.all([
      Users.find(filter).skip(skip).limit(limit).sort(sort).lean(),
      Users.countDocuments(filter),
    ])

    return {
      docs,
      docCount,
     }
  } catch (err) {
    const error = CustomError.toJSON({
      title: '!! Could not get users.',
      detail: err.message,
      status: 500,
      instance: req.url,
    })
    console.error(err)
    reply.status(error.status).send(error)
  }
}

// --------------------
async function getUserById (req, reply) {
  const { userId } = req.params

  try {
    const user = await Users.findOne(({ _id: userId })).lean()
    if (!user) {
      const error = CustomError.toJSON({
        title: '!! User not found',
        detail: 'The user you are looking for does not exist.',
        status: 404,
        instance: req.url,
      })
      return reply.status(error.status).send(error)
    }


    return user
  } catch (err) {
    const error = CustomError.toJSON({
      title: '!! Could not get user.',
      detail: err.message,
      status: 500,
      instance: req.url,
    })
    console.error(err)
    return reply.status(error.status).send(error)
  }
}

// --------------------
async function updateUser (req, reply) {
  const { userId } = req.params
  const { givenName, familyName, email, isNotActive, roles } = req.body

  // Sort roles according to roleList order.
  const sortedRoles = roles ? config.roleList.filter(role => roles.includes(role)) : []
  const newData = {
    givenName,
    familyName,
    email,
    isNotActive,
    roles: sortedRoles,
  }

  if (roles.length === 0) {
    const error = CustomError.toJSON({
      title: '!! Roles are required',
      detail: 'Roles are required to update a user.',
      status: 400,
    })

    return reply.status(error.status).send(error)
  }

  try {
    const isExistingUser = await Users.findOne({ email }).lean()
    if (isExistingUser?.email === email) {
      const error = CustomError.toJSON({
        title: '!! User already exists',
        detail: 'An user with this email already exists.',
        status: 409,
      })

      return reply.status(error.status).send(error)
    }

    const sysuser = await Users.findOneAndUpdate(
      { _id: userId },
      { $set: newData },
      { new: true, updatedBy: req.user.id, },
    )
    if (!sysuser) {
      const error = CustomError.toJSON({
        title: '!! Sysuser not found',
        detail: 'The sysuser you are looking for does not exist.',
        status: 404,
      })
      return reply.status(error.status).send(error)
    }

    return sysuser
  } catch (err) {
    console.error(' !! Could not update sysuser', err)
    return reply.internalServerError(err)
  }
}

// --------------------
async function deleteUser (req, reply) {
  const { userId } = req.params
  if (!userId) {
    const error = CustomError.toJSON({
      title: '!! User ID is required',
      detail: 'User ID is required to delete a user.',
      status: 400,
    })
    return reply.status(error.status).send(error)
  }

  try {
    await Promise.all([
      Users.deleteOne({ _id: userId }),
      UsersMetadata.deleteOne({ _id: userId }),
      ChangeLogs.deleteOne({ _id: userId }),
    ])

    return { message: 'OK' }
  } catch (err) {
    const error = CustomError.toJSON({
      title: '!! Could not delete user',
      detail: err.message,
      status: 500,
      instance: req.url,
    })

    console.error(err)
    return reply.status(error.status).send(error)
  }
}

export default {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
}
