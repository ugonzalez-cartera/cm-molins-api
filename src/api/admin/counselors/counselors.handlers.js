import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import config from '../../../config.js'

import { generateStrongPassword, createChangeLog } from '../../../services/utils.service.js'
import { sendCreateUserEmail } from '../../../services/notification.service.js'

const Counselors = mongoose.model('Counselor')
const UsersMetadata = mongoose.model('UserMetadata')
const ChangeLogs = mongoose.model('ChangeLog')

// --------------------
export async function createCounselor (req, reply) {
  const { origin } = req.headers

  const { email, givenName, familyName } = req.body
  if (!email) return reply.badRequest('Email and password are required.')

  const isExistingCounselor = await Counselors.exists({ email })
  if (isExistingCounselor) return reply.conflict('Counselor already exists.')

  const counselor = new Counselors({
    email,
    givenName,
    familyName,
    country: 'es',
  })

  await counselor.validate()

  const password = generateStrongPassword()

  const hash = await bcrypt.hash(password, 10)

  const payload = {
    sub: counselor._id,
  }

  const token = jwt.sign(payload, process.env.API_SECRET, { expiresIn: config.tokens.newUserTokenExpiration })

  const newCounselorMeta = new UsersMetadata({ _id: counselor._id, password: hash, verificationToken: token })

  await Promise.all([
    counselor.save(),
    newCounselorMeta.save(),
  ])

  const emailData = {
    _id: counselor._id,
    name: counselor.givenName,
    familyName: counselor.familyName.toUpperCase(),
    email: counselor.email.toUpperCase(),
    locale: counselor.country,
    subject: `Bienvenido - ${counselor.givenName} ${counselor.familyName}`,
    body: 'Para crear tu contraseña personalizada, haz clic en el botón.',
    ctaText: 'Crear nueva contraseña',
  }

  await sendCreateUserEmail({ userData: counselor, emailData, token, baseUrl: origin })

  return counselor
}

// --------------------
export async function getCounselors (req, reply) {
  const { status, limit, page, sort } = req.query

  const filter = {}
  const skip = (limit * page) - limit

  if (status) {
    filter.status = status
  }

  try {
    const [docs, docCount] = await Promise.all([
      Counselors.find(filter).skip(skip).limit(limit).sort(sort).lean(),
      Counselors.countDocuments(filter),
    ])

    if (docs.length  === 0) return reply.notFound('No counselors found.')

    return {
      docs,
      docCount,
     }
  } catch (err) {
    console.error(' !! Could not get counselors.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function getCounselorById (req, reply) {
  const { counselorId } = req.params

  try {
    const counselor = await Counselors.findOne({ _id: counselorId }).lean()

    return counselor
  } catch (err) {
    console.error(' !! Could not get counselor.', counselorId, err)
  }
}

// --------------------
export async function getCounselor (req, reply) {
  const { counselorId } = req.params

  try {
    const counselor = await Counselors.findOne({ _id: counselorId }).lean()
    if (!counselor) return reply.notFound('User not found.')

    return counselor
  } catch (err) {
    console.error(' !! Could not get counselor.', err)
    return reply.internalServerError(err)
  }
}


// --------------------
export async function updateCounselor (req, reply) {
  const { id: userId } = req.user
  const { counselorId } = req.params
  const { givenName, familyName, email, isNotActive } = req.body

  const newData = {
    givenName,
    familyName,
    email,
    isNotActive,
  }

  try {
    const changeLog = {
      collection: Counselors,
      _id: `coun_${counselorId}`,
      updatedBy: userId,
    }

    await createChangeLog(changeLog)

    const counselor = await Counselors.findOneAndUpdate({ _id: counselorId }, { $set: newData }, { new: true })
    if (!counselor) return reply.notFound('Counselor not found.')

    return counselor
  } catch (err) {
    console.error(' !! Could not update counselor.', err)
    return reply.internalServerError(err)
  }
}

// --------------------
export async function deleteCounselor (req, reply) {
  const { counselorId } = req.params
  if (!counselorId) return reply.badRequest('Missing params.')

  try {
    await Promise.all([
      Counselors.deleteOne({ _id: counselorId }),
      UsersMetadata.deleteOne({ _id: counselorId }),
      ChangeLogs.deleteOne({ _id: `coun_${counselorId}` }),
    ])

    return { msg: 'OK' }
  } catch (err) {
    console.error(' !! Could not delete counselor.', err)
    reply.internalServerError(err)
  }
}
