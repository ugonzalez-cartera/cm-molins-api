import { getSelfUser, updateSelfUser } from './self.handlers.js'

import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance({ role: [...config.roleGroups.admin.role, ...config.roleGroups.counselor.role] })

  fastify.get('/', { ...opts }, getSelfUser)
  fastify.put('/', { ...opts }, updateSelfUser)
}

export default routes
