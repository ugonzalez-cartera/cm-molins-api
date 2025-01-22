import { createCouncil, getCouncils } from './councils.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/', { ...opts }, getCouncils)
  fastify.post('/', { ...opts }, createCouncil)
}

export default routes
