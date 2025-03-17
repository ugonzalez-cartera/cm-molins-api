'use strict'

import authorizationService from './auth.service.js'

// --------------------
export async function getToken (req, reply) {
  const { email, password } = req.body

  try {
    const { token, refreshToken } = await authorizationService.getAuthToken({ email, password })
    return { token, refreshToken }
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
export async function refreshToken (req, reply) {
  const { refreshToken } = req.body

  try {
    const token = await authorizationService.getRefreshToken(refreshToken)
    return { token }
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
export async function requestResetPassword (req, reply) {
  const { origin } = req.headers
  const { email } = req.body

  try {
    await authorizationService.requestResetPassword(email, origin)
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
export async function resetPassword (req, reply) {
  const { email, password, token } = req.body

  try {
    await authorizationService.resetPassword({ email, password, token })
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}
