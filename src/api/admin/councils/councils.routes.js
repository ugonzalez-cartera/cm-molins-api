import councilsHandlers from './councils.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.post('/', { ...opts }, councilsHandlers.createCouncil)
  fastify.delete('/year/:councilYear', { ...opts }, councilsHandlers.deleteCouncilYear)
  fastify.delete('/:councilId', { ...opts }, councilsHandlers.deleteCouncil)
  fastify.put('/:councilId', { ...opts }, councilsHandlers.updateCouncil)
  fastify.put('/:councilId/report', { ...opts }, councilsHandlers.updateCouncilReport)
  fastify.put('/:councilId/:resource', { ...opts }, councilsHandlers.updateCouncilFileResource)
  fastify.delete('/:councilId/:resource', { ...opts }, councilsHandlers.deleteCouncilFileResource)
  fastify.delete('/:councilId/report', { ...opts }, councilsHandlers.deleteCouncilReport)
  fastify.post('/:councilId/docs', { ...opts }, councilsHandlers.createCouncilDocs)
  fastify.delete('/:councilId/docs/:docId', { ...opts }, councilsHandlers.deleteCouncilDoc)
  fastify.get('/call', { ...opts }, councilsHandlers.getAvailableCallCouncils)
  fastify.post('/:councilId/call', { ...opts }, councilsHandlers.createCouncilCall)
}

export default routes
