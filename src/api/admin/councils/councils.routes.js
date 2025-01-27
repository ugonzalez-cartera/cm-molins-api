import { createCouncil, deleteCouncilsBucket, updateCouncil, updateCouncilReport, updateCouncilDocs, deleteCouncilDoc } from './councils.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.post('/', { ...opts }, createCouncil)
  fastify.delete('/:councilYear', { ...opts }, deleteCouncilsBucket)
  fastify.put('/:councilYear/:councilId', { ...opts }, updateCouncil)
  fastify.put('/:councilYear/:councilId/report', { ...opts }, updateCouncilReport)
  fastify.put('/:councilYear/:councilId/docs', { ...opts }, updateCouncilDocs)
  fastify.delete('/:councilYear/:councilId/docs/:docId', { ...opts }, deleteCouncilDoc)
}

export default routes
