'use strict'

import jwt from 'jsonwebtoken'

// --------------------
export function configAllowance ({ roles, reason }) {
  // Clean up duplicate roles if any.
  const uniqueRoles = [...new Set(roles)]

  return { authorize: { roles: uniqueRoles, reason } }
}

// --------------------
export function logTokens () {
  const payload = {
    sub: 'apikey01',
    roles: ['guest'],
  }
  const options = {
    algorithm: 'HS256',
    noTimestamp: true,
  }

  // Guest token
  const token = jwt.sign(payload, process.env.API_SECRET, options)
  console.info('----------')
  console.info('Guest token:')
  console.info(token)
  console.info(jwt.decode(token, process.env.API_SECRET))
  console.info('----------')
}
