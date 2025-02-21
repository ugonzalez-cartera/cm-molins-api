'use strict'

import mongoose from 'mongoose'

import { uploadFile, deleteFile } from '../../services/utils.service.js'

const Investees = mongoose.model('Investee')
const ChangeLogs = mongoose.model('ChangeLog')

const currentEnv = process.env.NODE_ENV

// --------------------
export async function getInvestees (req, reply) {
  try {
    const { page, type, limit, sort, term } = req.query

    const filter = {}
    const skip = (Number(limit) * Number(page)) - Number(limit)

    if (type) {
      filter.type = { $in: type.split(',') }
    }

    if (term) {
      filter.name = { $regex: new RegExp(`^${term}`, 'i') }
    }


    const [docs, docCount] = await Promise.all([
      Investees.find(filter).skip(skip).limit(limit).sort(sort).lean(),
      Investees.countDocuments(filter),
    ])

    return { docs, docCount }
  } catch (err) {
    console.error(' !! Could not fetch investees', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function fetchInvesteeById (req, reply) {
  try {
    const { investeeId } = req.params

    const investee = await Investees.findOne({ _id: investeeId }).lean()
    if (!investee) return reply.notFound('Investee not found.')

    return investee
  } catch (err) {
    console.error(' !! Could not fetch investee', investeeId, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function createInvestee (req, reply) {
  const { id: userId } = req.user

  try {
    const file = await req.file()

    const { investeeData, investeeFile } = file.fields

    if (!investeeData || !investeeFile) return reply.badRequest('Missing investee data or file.')

    const { name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description = {} } = JSON.parse(file.fields?.investeeData?.value || '')

    const isExistingInvestee = await Investees.exists({ name })
    if (isExistingInvestee) return reply.conflict('Investee already exists.')

    const buffer = await file.fields.investeeFile.toBuffer()

    const folder = `${currentEnv}-carteracm/investees`
    const uploadImageResult = await uploadFile(buffer, folder, investeeFile.filename)

    const investee = new Investees({
      name,
      type,
      investedAt,
      disinvestedAt,
      websiteUrl,
      logoUrl: uploadImageResult.secure_url,
      publicId: uploadImageResult.public_id,
      headquarters,
      description,
    })

    await investee.save({ updatedBy: userId })

    return investee

  } catch (err) {
    console.error(' !! Could not create investee', err)
    return reply.internalServerError(err)
  }
}

// --------------------
export async function updateInvesteeImage (req, reply) {
  const { id: userId } = req.user
  const { investeeId } = req.params

  try {
    const investee = await Investees.findOne({ _id: investeeId })
    if (!investee) return reply.notFound('Investee not found.')

    const file = await req?.file()

    let uploadImageResult
    if (file) {
      const investeeFile = file.fields.investeeFile

      const buffer = await file.fields.investeeFile.toBuffer()

      const folder = `${currentEnv}-carteracm/investees`
      uploadImageResult = await uploadFile(buffer, folder, investeeFile.filename)
    }

    if (uploadImageResult) {
      investee.logoUrl = uploadImageResult.secure_url
      investee.publicId = uploadImageResult.public_id
    }

    await investee.save({ updatedBy: userId })


    return investee
  } catch (err) {
    console.error(' !! Could not update investee image.', err)
    reply.internalServerError(err)
  }
}

export async function updateInvestee (req, reply) {
  const {  id: userId } = req.user
  const { investeeId } = req.params

  const {  name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description } = req.body || {}

  try {
    const investee = await Investees.findOne({ _id: investeeId })
    if (!investee) return reply.notFound('Investee not found.')

    investee.name = name
    investee.type = type
    investee.investedAt = investedAt
    investee.disinvestedAt = disinvestedAt
    investee.websiteUrl = websiteUrl
    investee.headquarters = headquarters
    investee.description = description
    investee.updatedBy = userId

    await investee.save({ updatedBy: userId })

    return investee

  } catch (err) {
    console.error(` !! Could not update investe: ${investeeId}.`, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function deleteInvestee (req, reply) {
  try {
    const { investeeId } = req.params

    const result = await Promise.all([
      Investees.findOneAndDelete({ _id: investeeId }),
      ChangeLogs.deleteOne({ _id: `inv_${investeeId}` }),
    ])

    await deleteFile(result[0].publicId)

    return { msg: 'Ok' }

  } catch (err) {
    console.error(' !! Could not delete investee', err)
    return reply.internalServerError(err)
  }
}
