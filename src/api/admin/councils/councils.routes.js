import {
  createCouncil,
  deleteCouncilYear,
  deleteCouncil,
  updateCouncil,
  updateCouncilReport,
  createCouncilDocs,
  deleteCouncilDoc,
  createCouncilCall,
  getAvailableCallCouncils
} from './councils.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.post('/', { ...opts }, createCouncil)
  fastify.delete('/year/:councilYear', { ...opts }, deleteCouncilYear)
  fastify.delete('/:councilId', { ...opts }, deleteCouncil)
  fastify.put('/:councilId', { ...opts }, updateCouncil)
  fastify.put('/:councilId/report', { ...opts }, updateCouncilReport)
  fastify.post('/:councilId/docs', { ...opts }, createCouncilDocs)
  fastify.delete('/:councilId/docs/:docId', { ...opts }, deleteCouncilDoc)
  fastify.get('/call', { ...opts }, getAvailableCallCouncils)
  fastify.post('/:councilId/call', { ...opts }, createCouncilCall)
}

export default routes
