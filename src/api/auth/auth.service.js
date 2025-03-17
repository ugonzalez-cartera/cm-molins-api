'use strict'

import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

import config from '../../config.js'
import { sendRequestResetPasswordEmail } from '../../services/notification.service.js'

import { CustomError } from '../../utils.js'

const Users = mongoose.model('User')
const UsersMetadata = mongoose.model('UserMetadata')

// --------------------
async function getAuthToken ({ email, password }) {
  if (!email || !password) {
    const error = new CustomError({
      title: '!! Invalid credentials',
      detail: 'Email and password are required.',
      status: 400,
    })
    throw error
  }

  try {
    const user = await Users.findOne({ email })
    if (!user || !user.roles) {
      const error = new CustomError({
        title: '!! User not found',
        detail: 'No user was found with provided email',
        status: 404,
      })
      throw error
    }

    const userMeta = await UsersMetadata.findOne({ _id: user._id }).select('+password').lean()
    if (!userMeta) {
      const error = new CustomError({
        title: '!! User not found',
        detail: 'No user metadata was found with provided id',
        status: 404,
      })
      throw error
    }

    if (user.isNotActive) {
      // If user account is not active, return forbidden.
      const error = new CustomError({
        title: '!! User is not active',
        detail: 'Not active user was found',
        status: 404,
      })
      throw error
    }

    const passwordsMatch = await argon2.verify(userMeta.password, password)
    if (!passwordsMatch) {
      const error = new CustomError({
        title: '!! Invalid password',
        detail: 'No password match was found',
        status: 401,
      })
      throw error
    }

    const payload = {
      sub: user._id,
      roles: user.roles,
    }

    const refreshTokenPayload = {
      sub: user._id,
    }

    const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.accessTokenExpiration })
    const refreshToken = jwt.sign(refreshTokenPayload, process.env.API_SECRET, { expiresIn: config.tokens.refreshTokenExpiration })

    // Update lastSessionAt for user.
    user.lastSessionAt = new Date()
    await user.save()

    console.info(' --> Access token for', user._id, user.roles)

    return { token, refreshToken }
  } catch (err) {
    const error = new CustomError({
      title: err.title || `getAuthToken exception ${err.message}`,
      detail: err.detail || `getAuthToken exception ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function getRefreshToken (refreshToken) {
  if (!refreshToken) {
    const error = new CustomError({
      title: '!! Refresh token is required',
      detail: 'A refresh token is required',
      status: 400,
    })
    throw error
  }

  try {
    // Decode the received refresh token *not* the one passed via Authorization header.
    const { sub } = jwt.verify(refreshToken, process.env.API_SECRET)

    const user = await Users.findOne({ _id: sub }).select('_id roles isNotActive')
    if (!user || !user.roles) {
      const error = new CustomError({
        title: '!! User not found',
        detail: 'No user was found with provided token sub',
        status: 401,
      })
      throw error
    }

    const userMeta = await UsersMetadata.findOne({ _id: sub })
    if (!userMeta) {
      const error = new CustomError({
        title: ` !! Unauthorized refresh token attempt for ${sub} - User metadata not found`,
        detail: 'Provided refresh token is not authorized, user metadata was not found',
        status: 404,
      })
      throw error
    }

    if (user.isNotActive) {
      // If user account is not active, return forbidden.
      const error = new CustomError({
        title: `!! User is not active - ${user}`,
        detail: 'No active user was found',
        status: 404,
      })
      throw error
    }

    const payload = {
      sub: user._id,
      roles: user.roles,
    }
    const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.accessTokenExpiration })

    // Update lastSessionAt info on user.
    user.lastSessionAt = new Date()
    await user.save()

    console.info(' --> Refresh token for:', user._id, user.roles)

    return token
  } catch (err) {
    const error = new CustomError({
      title: err.title || `getRefreshToken exception ${err.message}`,
      detail: err.detail || `getRefreshToken exception ${err}`,
      status: err.status || 404,
    })
    throw error
  }
}

// --------------------
async function requestResetPassword (email, origin) {
  if (!email) {
    const error = new CustomError({
      title: '!! Email is required',
      detail: 'Email is required',
      status: 400,
    })
    throw error
  }

  try {
    const user = await Users.findOne({ email, isNotActive: { $ne: true } }).select('_id givenName familyName email roles').lean()
    if (!user) {
      // Return OK if no user to avoid giving extra unnecessary info.
      return { msg: 'OK' }
    }

    const payload = {
      sub: user._id,
    }
    const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: '6 hours' })

    const userMeta = await UsersMetadata.findOneAndUpdate(
      { _id: user._id },
      { $set: { verificationToken: token } },
      { new: true }
    )
    // Only send email if userMeta was found.
    if (userMeta) {
      await sendRequestResetPasswordEmail(user, token, origin)
    }

    return { msg: 'OK' }
  } catch (err) {
    const error = new CustomError({
      title: err.title || `requestResetPassword exception ${err.message}`,
      detail: err.detail || `requestResetPassword exception ${err}`,
      status: err.status || 500,
    })

    throw error
  }
}

// --------------------
async function resetPassword ({ email, password, token }) {
  if (!email || !password || !token) {
    const error = new CustomError({
      title: '!! Missing information',
      detail: 'Missing information',
      status: 400,
    })
    throw error
  }

  try {
    const user = await Users.findOne({ email, isNotActive: { $ne: true }  }).select('_id')
    if (!user) {
      const error = new CustomError({
        title: '!! User not found',
        detail: 'No active user was found with provided email',
        status: 404,
      })
      throw error
    }

    const userMeta = await UsersMetadata.findOne({ _id: user._id }).select('+verificationToken')
    const verificationToken = userMeta.verificationToken

    if (token !== verificationToken?.split('.')[1]) {
      const error = new CustomError({
        title: '!! Wrong token',
        detail: 'Provided token is not valid',
        status: 401,
      })
      throw error
    }

    // This will throw an error if token is not correct.
    jwt.verify(verificationToken, process.env.API_SECRET)

    userMeta.password = await argon2.hash(password, { type: argon2.argon2id })
    userMeta.verificationToken = '-'
    await userMeta.save()

    return { msg: 'Password updated' }
  } catch (err) {
    const error = new CustomError({
      title: err.title,
      detail: err.detail,
      status: err.status,
    })
    switch (err.name) {
    case 'TokenExpiredError':
      error.title = '!! Token has expired'
      error.detail = 'Provided toke is expired'
      error.status = 409
      break
    default:
      error.title = `resetPassword exception ${err.message}`
      error.detail = `resetPassword exception ${err}`
      error.status = 500
    }

    throw error
  }
}

export default {
  getAuthToken,
  getRefreshToken,
  resetPassword,
  requestResetPassword,
}
