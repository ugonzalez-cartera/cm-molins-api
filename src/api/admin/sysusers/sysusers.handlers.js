import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import config from '../../../config.js'

import { generateStrongPassword } from '../../../services/utils.service.js'
import { sendCreateUserEmail } from '../../../services/notification.service.js'

const SysUsers = mongoose.model('SysUser')
const UsersMetadata = mongoose.model('UserMetadata')

// --------------------
export async function createSysUser (req, reply) {
  const { email, givenName, familyName } = req.body
  if (!email) return reply.badRequest('Email and password are required.')

  const isExisingUser = await SysUsers.exists({ email })
  if (isExisingUser) return reply.conflict('User already exists.')

  const user = new SysUsers({
    email,
    givenName,
    familyName,
    country: 'es',
    role: 'admin'
  })

  await user.validate()

  const password = generateStrongPassword()

  const hash = await bcrypt.hash(password, 10)

  const payload = {
    sub: user._id,
  }

  const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.newSysUserTokenExpiration })

  const newUserMeta = new UsersMetadata({ _id: user._id, password: hash, verificationToken: token })

  await Promise.all([
    user.save(),
    newUserMeta.save(),
  ])

  await sendCreateUserEmail(user)

  return user
}

// --------------------
export async function getSysUsers (req, reply) {
  const { status, limit, page } = req.query

  const filter = {}
  const skip = (limit * page) - limit

  if (status) {
    filter.status = status
  }

  try {
    const [docs, docCount] = await Promise.all([
      SysUsers.find(filter).skip(skip).limit(limit).lean(),
      SysUsers.countDocuments(filter),
    ])

    if (docs.length  === 0) return reply.notFound('No users found.')

    return {
      docs,
      docCount,
     }
  } catch (err) {
    console.error(' !! Could not get sysUsers', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function getSysUser (req, reply) {
  const { id } = req.user
  const { sysUserId: queryParamsSysUserId } = req.params

  const sysUserId = queryParamsSysUserId || id

  try {
    const user = await SysUsers.findById(sysUserId).lean()
    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not get sysUser', err)
    return reply.internalServerError(err)
  }
}


// --------------------
export async function updateSysUser (req, reply) {
  const { sysUserId } = req.params
  const { givenName, familyName, email, isNotActive } = req.body

  const newData = {
    givenName,
    familyName,
    email,
    isNotActive,
  }

  try {
    const user = await SysUsers.findOneAndUpdate({ _id: sysUserId }, { $set: newData }, { new: true })
    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not update sysUser', err)
    return reply.internalServerError(err)
  }
}
