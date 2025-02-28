import { getCouncils, getCouncilsByYear, getCouncil } from './councils.handlers.js'

import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance({ roles: [...config.roleGroups.admin.roles, ...config.roleGroups.counselor.roles] })

  fastify.get('/', { ...opts }, getCouncils)
  fastify.get('/year/:councilYear', { ...opts }, getCouncilsByYear)
  fastify.get('/:councilId', { ...opts }, getCouncil)
}

export default routes
