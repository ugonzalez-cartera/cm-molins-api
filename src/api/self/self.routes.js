import { getOwnUser, updateOwnUser, updateOwnPassword } from './self.handlers.js'

import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance({ roles: [...config.roleGroups.admin.roles, ...config.roleGroups.counselor.roles] })

  fastify.get('/', { ...opts }, getOwnUser)
  fastify.put('/', { ...opts }, updateOwnUser)
  fastify.put('/password', { ...opts }, updateOwnPassword)
}

export default routes
