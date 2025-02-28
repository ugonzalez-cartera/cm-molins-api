import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

import config from '../../../config.js'

import { sendCreateUserEmail } from '../../../services/notification.service.js'
import { generateStrongPassword } from '../../../services/utils.service.js'

const Sysusers = mongoose.model('Sysuser')
const UsersMetadata = mongoose.model('UserMetadata')
const ChangeLogs = mongoose.model('ChangeLog')
const Counselors = mongoose.model('Counselor')

// --------------------
export async function createSysuser (req, reply) {
  const { id: userId } = req.user
  const { origin } = req.headers
  const { email, givenName, familyName } = req.body
  if (!email) return reply.badRequest('Email and password are required.')

  // Do not allow creating a counselor with an existing email in counselors or sysusers collection.
  const isExistingCounselor = await Counselors.exists({ email })
  const isExistingSysuser = await Sysusers.exists({ email })
  if (isExistingSysuser || isExistingCounselor) return reply.conflict('Sysuser already exists.')

  const user = new Sysusers({
    email,
    givenName,
    familyName,
    country: 'es',
    roles: ['admin'],
    updatedBy: userId,
  })

  await user.validate()

  const password = generateStrongPassword()

  const hash = await argon2.hash(password, { type: argon2.argon2id })

  const payload = {
    sub: user._id,
  }

  const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.newUserTokenExpiration })

  const newUserMeta = new UsersMetadata({ _id: user._id, password: hash, verificationToken: token })

  await Promise.all([
    user.save(),
    newUserMeta.save(),
  ])

  const emailData = {
    _id: user._id,
    name: user.givenName.toUpperCase(),
    familyName: user.familyName.toUpperCase(),
    email: user.email,
    locale: user.country,
    subject: `Bienvenido - ${user.givenName} ${user.familyName}`,
    body: 'Para crear tu contraseña personalizada, haz clic en el botón',
    ctaText: 'Crear nueva contraseña',
  }

  await sendCreateUserEmail({ userData: user, emailData, token, baseUrl: origin })

  return user
}

// --------------------
export async function getSysusers (req, reply) {
  const { id: userId } = req.user
  const { status, limit, page, sort } = req.query

  const filter = {
    _id: { $not: { $eq: userId } }
  }
  const skip = (limit * page) - limit

  if (status) {
    filter.status = status
  }

  try {
    const [docs, docCount] = await Promise.all([
      Sysusers.find(filter).skip(skip).limit(limit).sort(sort).lean(),
      Sysusers.countDocuments(filter),
    ])

    return {
      docs,
      docCount,
     }
  } catch (err) {
    console.error(' !! Could not get sysusers.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function getSysuser (req, reply) {
  const { id } = req.user
  const { sysuserId: queryParamsSysuserId } = req.params

  const sysuserId = queryParamsSysuserId || id

  try {
    const user = await Sysusers.findOne(({ _id: sysuserId })).lean()
    if (!user) return reply.notFound('User not found.')

    return user
  } catch (err) {
    console.error(' !! Could not get sysuser.', err)
    return reply.internalServerError(err)
  }
}


// --------------------
export async function updateSysuser (req, reply) {
  const { id: userId } = req.user
  const { sysuserId } = req.params
  const { givenName, familyName, email, isNotActive } = req.body

  const newData = {
    givenName,
    familyName,
    email,
    isNotActive,
  }

  try {
    const sysuser = await Sysusers.findOneAndUpdate(
      { _id: sysuserId },
      { $set: newData },
      { new: true, updatedBy: userId, },
    )
    if (!sysuser) return reply.notFound('Sysuser not found.')


    return sysuser
  } catch (err) {
    console.error(' !! Could not update sysuser', err)
    return reply.internalServerError(err)
  }
}

// --------------------
export async function deleteSysuser (req, reply) {
  const { sysuserId } = req.params

  try {
    await Promise.all([
      Sysusers.deleteOne({ _id: sysuserId }),
      UsersMetadata.deleteOne({ _id: sysuserId }),
      ChangeLogs.deleteOne({ _id: `sysuser_${sysuserId}` }),
    ])

    return { message: 'OK' }
  } catch (err) {
    console.error(' !! Could not delete sysuser.', err)
    return reply.internalServerError(err)
  }
}
