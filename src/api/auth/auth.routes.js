import { getToken, refreshToken, requestResetPassword, resetPassword } from './auth.handlers.js'
import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config
  opts.config = configAllowance(config.roleGroups.guest)

  fastify.post('/token', { ...opts }, getToken)

  fastify.post('/refreshtoken', { ...opts }, refreshToken)

  fastify.put('/password/request', { ...opts }, requestResetPassword)

  fastify.put('/password', { ...opts }, resetPassword)
}

export default routes
