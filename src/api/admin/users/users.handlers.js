import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

import config from '../../../config.js'

import { sendCreateUserEmail } from '../../../services/notification.service.js'
import { generateStrongPassword } from '../../../services/utils.service.js'

const Users = mongoose.model('User')
const UsersMetadata = mongoose.model('UserMetadata')
const ChangeLogs = mongoose.model('ChangeLog')

// --------------------
async function createUser (req, reply) {
  const { origin } = req.headers

  const { email, givenName, familyName, roles } = req.body
  if (!email) return reply.badRequest('Email and password are required.')

  try {
    const isExistingUser = await Users.exists({ email })
    if (isExistingUser) return reply.conflict('User already exists.')

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
    console.error(err)
    return reply.internalServerError()
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
    console.error(' !! Could not get users.', err)
    reply.internalServerError(err)
  }
}

// --------------------
async function getUserById (req, reply) {
  const { userId } = req.params

  try {
    const user = await Users.findOne(({ _id: userId })).lean()
    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not get sysuser.', err)
    return reply.internalServerError(err)
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

  if (roles.length === 0) return reply.badRequest('Roles are required.')

  try {
    const isExistingUser = await Users.exists({ email })
    if (isExistingUser.email === email) return reply.conflict('User already exists.')

    const sysuser = await Users.findOneAndUpdate(
      { _id: userId },
      { $set: newData },
      { new: true, updatedBy: req.user.id, },
    )
    if (!sysuser) return reply.notFound('Sysuser not found.')


    return sysuser
  } catch (err) {
    console.error(' !! Could not update sysuser', err)
    return reply.internalServerError(err)
  }
}

// --------------------
async function deleteUser (req, reply) {
  const { userId } = req.params

  try {
    await Promise.all([
      Users.deleteOne({ _id: userId }),
      UsersMetadata.deleteOne({ _id: userId }),
      ChangeLogs.deleteOne({ _id: userId }),
    ])

    return { message: 'OK' }
  } catch (err) {
    console.error(' !! Could not delete user.', err)
    return reply.internalServerError(err)
  }
}

export default {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
}
