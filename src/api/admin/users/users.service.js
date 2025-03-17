'use strict'

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
async function createUser ({ email, givenName, familyName, roles, origin }) {
  if (!email) {
    const error = new CustomError({
      title: '!! Email is required',
      detail: 'Email is required to create a new user',
      status: 400,
    })
    throw error
  }

  try {
    const isExistingUser = await Users.exists({ email })
    if (isExistingUser) {
      const error = new CustomError({
        title: '!! User already exists',
        detail: 'A user with this email already exists',
        status: 409,
      })
      throw error
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
    const error = new CustomError({
      title: err.title || `createUser exception: ${err.message}`,
      detail: err.detail || `createUser exception: ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function getUsers ({ userId, limit, page, sort, roles }) {
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
    const error = new CustomError({
      title: `getUsers exception: ${err.message}`,
      detail: `getUsers exception: ${err}`,
      status: 500,
    })
    throw error
  }
}

// --------------------
async function getUserById (userId) {
  try {
    const user = await Users.findOne(({ _id: userId })).lean()
    if (!user) {
      const error = new CustomError({
        title: '!! User not found',
        detail: 'The user you are looking for does not exist',
        status: 404,
      })
      throw error
    }

    return user
  } catch (err) {
    const error = new CustomError({
      title: err.title || `getUserById exception: ${err.message}`,
      detail: err.detail || `getUserById exception: ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function updateUser ({ userId, givenName, familyName, email, roles, isNotActive }) {
  try {
    if (roles.length === 0) {
      const error = new CustomError({
        title: '!! Roles are required',
        detail: 'Roles are required to update a user',
        status: 400,
      })
      throw error
    }

    // Sort roles according to roleList order.
    const sortedRoles = roles ? config.roleList.filter(role => roles.includes(role)) : []

    const user = await Users.findOne({ _id: userId })
    if (!user) {
      const error = new CustomError({
        title: '!! User not found',
        detail: 'The user you are looking for does not exist',
        status: 404,
      })
      throw error
    }

    if (user.email !== email) {
      const isExistingUser = await Users.exists({ email })
      if (isExistingUser) {
        const error = new CustomError({
          title: '!! User with this email already exists',
          detail: 'A user with this email already exists',
          status: 409,
        })
        throw error
      }
    }

    user.givenName = givenName
    user.familyName = familyName
    user.email = email
    user.roles = sortedRoles
    user.isNotActive = isNotActive

    await user.save({ updatedBy: userId })

    return user
  } catch (err) {
    const error = new CustomError({
      title: err.title || `updateUser exception: ${err.message}`,
      detail: err.detail || `updateUser exception: ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function deleteUser (userId) {
  try {
    if (!userId) {
      const error = new CustomError({
        title: '!! User Id is required',
        detail: 'User Id is required to delete a user',
        status: 400,
      })
      throw error
    }

    await Promise.all([
      Users.deleteOne({ _id: userId }),
      UsersMetadata.deleteOne({ _id: userId }),
      ChangeLogs.deleteOne({ _id: userId }),
    ])
  } catch (err) {
    const error = new CustomError({
      title: err.title || `deleteUser exception: ${err.message}`,
      detail: err.detail || `deleteUser exception: ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

export default {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
}
