import { getCounselors, createCounselor, deleteCounselor, updateCounselor } from './counselors.handlers.js'

import { configAllowance } from '../../../services/authorization.service.js'
import config from '../../../config.js'

async function routes (fastify, opts) {
  // Set global authorization config.
  opts.config = configAllowance(config.roleGroups.admin)

  fastify.get('/', { ...opts }, getCounselors)
  fastify.post('/', { ...opts }, createCounselor)
  fastify.put('/:counselorId', { ...opts }, updateCounselor)
  fastify.delete('/:counselorId', { ...opts }, deleteCounselor)
}

export default routes
