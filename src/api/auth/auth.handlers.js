'use strict'

import jwt from 'jsonwebtoken'
import bcrypt from'bcryptjs'
import mongoose from 'mongoose'

import config from '../../config.js'

import { sendRequestResetPasswordEmail } from '../../services/notification.service.js'


const Sysusers = mongoose.model('Sysuser')
const Counselors = mongoose.model('Counselor')
const UsersMetadata = mongoose.model('UserMetadata')

// --------------------
export async function getToken (req, reply) {
  const { email, password } = req.body

  if (!email || !password) return reply.badRequest('Email and password are required.')

  try {
    let user = await Counselors.findOne({ email })
    if (!user) {
      user = await Sysusers.findOne({ email })
    }

    if (!user || !user.role) return reply.unauthorized('User not found.')

    const userMeta = await UsersMetadata.findOne({ userId: user._id }).select('+password').lean()
    if (!userMeta) return reply.unauthorized('User not found.')

    if (user.isNotActive) {
      // If user account is not active, return forbidden.
      console.error('  !! User is not active:', user)
      return reply.forbidden('User is not active.')
    }

    const passwordMatch = await bcrypt.compare(password, userMeta.password)
    if (!passwordMatch) return reply.unauthorized('Invalid password.')

      const payload = {
        sub: user._id,
        role: user.role,
      }

      const refreshTokenPayload = {
        sub: user._id,
      }

    const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.accessTokenExpiration })
    const refreshToken = jwt.sign(refreshTokenPayload, process.env.API_SECRET, { expiresIn: config.tokens.refreshTokenExpiration })

    // Update lastSessionAt for user.
    user.lastSessionAt = new Date()
    await user.save()

    console.info(' --> Access token for', user._id, user.role)

    return { token, refreshToken }
  } catch (err) {
    console.error(` !! Unauthorized login attem for: ${email}.`, err)
    reply.unauthorized(err)
  }
}

// --------------------
export async function refreshToken (req, reply) {
  const { refreshToken } = req.body
  if (!refreshToken) {
    console.error(' !! Refresh token is required.')
    return reply.badRequest('Refresh token is required.')
  }

  try {
    // Decode the received refresh token *not* the one passed via Authorization header.
    const { sub } = jwt.verify(refreshToken, process.env.API_SECRET)

    let user = await Counselors.findOne({ _id: sub }).lean()
    if (user) {
      user.role = ['counselor']
    } else {
      user = await Sysusers.findOne({ _id: sub }).select('+role').lean()
    }

    if (!user || !user.role) return reply.unauthorized('User not found.')

    const userMeta = await UsersMetadata.findOne({ _id: sub })
    if (!userMeta) {
      console.error(`  !! Unauthorized refresh token attempt for ${sub} - User metadata not found.`)
      return reply.notFound('User metadata not found.')
    }

    if (user.isNotActive) {
      // If user account is not active, return forbidden.
      console.error('  !! User is not active:', user)
      return reply.forbidden('User is not active.')
    }

    const payload = {
      sub: user._id,
      role: user.role,
    }

    const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.accessTokenExpiration })

    console.info(' Refresh token for:', user._id, user.role)

    return { token }
  } catch (err) {
    console.error(' !! Unauthorized refresh token attempt:', err)
    reply.unauthorized(err)
  }
}

// --------------------
export async function requestResetPassword (req, reply) {
  const { origin } = req.headers

  const { email } = req.body
  if (!email) return reply.badRequest('Email is required.')

  try {
    let user = await Counselors.findOne({ email, isNotActive: { $ne: true } }).lean()
    if (user) {
      user.role = 'counselor'
    } else {
      user = await Sysusers.findOne({ email, isNotActive: { $ne: true }  }).lean()
    }

    if (!user || !user.role) return reply.unauthorized('User not found.')

    const payload = {
      sub: user._id,
    }

    const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: '6 hours' })

    const userMeta = await UsersMetadata.findOneAndUpdate({ _id: user._id }, { $set: { verificationToken: token } }, { new: true })

    // Only send email if userMeta was found.
    if (userMeta) {
      await sendRequestResetPasswordEmail(user, token, origin)
    }
  } catch (err) {
    console.error(` !! Unauthorized password reset request for: ${email}.`, err)
    return reply.unauthorized(err)
  }
}

// --------------------
export async function resetPassword (req, reply) {
  const { email, password, token } = req.body
  if (!email || !password || !token) return reply.badRequest('Missing information.')

  try {
    let user = await Counselors.findOne({ email, isNotActive: { $ne: true }  }).lean()
    if (!user) {
      user = await Sysusers.findOne({ email, isNotActive: { $ne: true }  }).lean()
    }

    if (!user || !user.role) return reply.unauthorized('User not found.')

    const userMeta = await UsersMetadata.findOne({ _id: user._id }).select('verificationToken')
    if (!userMeta) return reply.unauthorized('User not found.')

    const verificationToken = userMeta.verificationToken

    if (verificationToken?.split('.')[1] !== token) {
      return reply.unauthorized('Invalid token.')
    }

    // This will throw an error if token is not correct.
    jwt.verify(verificationToken, process.env.API_SECRET)

    userMeta.password = await bcrypt.hash(password, 10)
    userMeta.verificationToken = '-'
    await userMeta.save()

    reply.send({ msg: 'Password updated.' })
  } catch (err) {
    console.error(`  ! Could not reset password for ${email} - ${err.name} / ${err.message}.`)
    switch (err.name) {
      case 'TokenExpiredError':
        return reply.conflict('Token has expired.') // code: 409
      default:
        return reply.internalServerError('Could not reset password.')
    }
  }
}
