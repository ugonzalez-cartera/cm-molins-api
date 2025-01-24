import { getCouncils, getCouncilsBucketByYear, getCouncil, deleteCouncilsBucket } from './councils.handlers.js'

import { configAllowance } from '../../services/authorization.service.js'
import config from '../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance({ role: [...config.roleGroups.admin.role, ...config.roleGroups.counselor.role] })

  fastify.get('/', { ...opts }, getCouncils)
  fastify.get('/:councilYear', { ...opts }, getCouncilsBucketByYear)
  fastify.delete('/:councilYear', { ...opts }, deleteCouncilsBucket)
  fastify.get('/:councilYear/:councilId', { ...opts }, getCouncil)
}

export default routes
