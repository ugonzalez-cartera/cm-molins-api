'use strict'

import authorizationService from './auth.service.js'

import { CustomError } from '../../utils.js'

// --------------------
export async function getToken (req, reply) {
  const { email, password } = req.body
  if (!email || !password) {
    const error = new CustomError({
      title: '!! Invalid credentials',
      detail: 'Email and password are required.',
      status: 400,
      instance: req.url
    })
    error.print()
    return reply.status(error.status).send(error.toJSON())
  }

  try {
    const { token, refreshToken } = await authorizationService.getAuthToken({ email, password })
    return { token, refreshToken }
  } catch (err) {
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
export async function refreshToken (req, reply) {
  const { refreshToken } = req.body
  if (!refreshToken) {
    const error = new CustomError({
      title: '!! Refresh token is required',
      detail: 'A refersh token is required',
      status: 400,
    })
    error.print()
    return reply.status(error.status).send(error.toJSON())
  }

  try {
    const token = await authorizationService.getRefreshToken(refreshToken)
    return { token }
  } catch (err) {
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
export async function requestResetPassword (req, reply) {
  const { origin } = req.headers

  const { email } = req.body
  if (!email) {
    const error = new CustomError({
      title: '!! Email is required',
      detail: 'Email is required',
      status: 400,
    })
    error.print()
    return reply.status(error.status).send(error.toJSON())
  }

  try {
    await authorizationService.requestResetPassword(email, origin)
  } catch (err) {
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
export async function resetPassword (req, reply) {
  const { email, password, token } = req.body
  if (!email || !password || !token) {
    const error = new CustomError({
      title: '!! Missing information',
      detail: 'Missing information',
      status: 400,
    })
    error.print()
    return reply.status(error.status).send(error.toJSON())
  }

  try {
    await authorizationService.resetPassword({ email, password, token })
  } catch (err) {
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}
