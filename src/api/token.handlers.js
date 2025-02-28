'use strict'

import jwt from 'jsonwebtoken'

import { arraysOverlap } from '../services/utils.service.js'

const DEFAULT_REASON = 'Access not authorized.'

// --------------------
export async function verifyToken (req, reply) {
  // All requests go through this hook. If the token is not valid or doesn't have a role, it is rejected.
  // If it is valid, data is extracted from it and added to the req object for subsequent calls.
  try {
    // Do not verify token if explicitly specified as verifyToken is set as global hook and some endpoint requests do not require token.
    if (req.routeOptions.config?.verifyToken === false) return

    // The authorization header contains 'Bearer <token>' so we need to extract the actual jwtToken from that string.
    const jwtToken = req.headers.authorization?.split(' ')[1]
    const decodedToken = jwt.verify(jwtToken, process.env.API_SECRET)

    // Refresh tokens don't have roles -- this prevents using RT's for accessing the API.
    if (!decodedToken) return reply.unauthorized()
    console.info(' --> Access token for', decodedToken.sub, decodedToken.roles)

    req.user = {
      id: decodedToken.sub,
      roles: decodedToken.roles,
    }
  } catch (err) {
    return reply.unauthorized()
  }
}


// --------------------
export function authorize (req, reply, done) {
  const { roles: authorizedRoles = [], reason } = req.routeOptions.config?.authorize || {}
  const userRoles = req.user?.roles || []

  console.info(' --> Authorizing', req.user.id, 'for', authorizedRoles)

  // If authorizedRoles only contains '*', always allow the request.
  if (authorizedRoles.length === 1 && authorizedRoles[0] === '*') return

  if (!arraysOverlap(userRoles, authorizedRoles)) {
    req.log.warn(reason || DEFAULT_REASON)
    reply.forbidden()
    return reply
  }

  done()
}
