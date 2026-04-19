'use strict'

import mongoose from 'mongoose'

import { uploadFile, deleteFile, getPresignedUrl } from '../../services/utils.service.js'

import { CustomError } from '../../utils.js'

const Investees = mongoose.model('Investee')
const ChangeLogs = mongoose.model('ChangeLog')

const currentEnv = process.env.NODE_ENV

async function _resolveInvesteeUrl (investee) {
  if (!investee?.publicId) return investee
  const presignedUrl = await getPresignedUrl(investee.publicId)
  return presignedUrl ? { ...investee, logoUrl: presignedUrl } : investee
}

// --------------------
async function getInvestees ({ page, type, limit, sort, term }) {
  try {
    const filter = {}
    const skip = (Number(limit) * Number(page)) - Number(limit)

    if (type) {
      filter.type = { $in: type.split(',') }
    }

    if (term) {
      const decodedTerm = decodeURIComponent(term)
      const escapedTerm = decodedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      filter.$or = [
        { name: { $regex: new RegExp(`${term}`, 'i') } },
        { 'description.es': { $regex: new RegExp(`${escapedTerm}`, 'i') } },
      ]
    }

    const [docs, docCount] = await Promise.all([
      Investees.find(filter).skip(skip).limit(limit).sort(sort).lean(),
      Investees.countDocuments(filter),
    ])

    return { docs: await Promise.all(docs.map(_resolveInvesteeUrl)), docCount }
  } catch (err) {
    const error = new CustomError({
      title: `getInvestees exception, ${err.message}`,
      detail: `getInvestees exception, ${err}`,
      status: 404,
    })
    throw error
  }
}

// --------------------
async function getInvesteeById (investeeId) {
  try {
    const investee = await Investees.findOne({ _id: investeeId }).lean()
    if (!investee) {
      const error = new CustomError({
        title: '!! Could not find investee',
        detail: 'No investee was found with provided id',
        status: 404,
      })
      throw error
    }

    return _resolveInvesteeUrl(investee)
  } catch (err) {
    const error = new CustomError({
      title: err.title || `getInvesteeById exception, ${err.message}`,
      detail: err.detail || `getInvesteeById exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function createInvestee (investeeData, investeeFile, userId) {
  if (!investeeData || !investeeFile) {
    const error = new CustomError({
      title: '!! Missing investee data or file',
      detail: 'Required elements missing',
      status: 400,
    })
    throw error
  }

  try {
    const { name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description = {} } = JSON.parse(investeeData?.value || '')

    const isExistingInvestee = await Investees.exists({ name }).lean()
    if (isExistingInvestee) {
      const error = new CustomError({
        title: '!! Investee already exists',
        detail: 'Cannot create an investee that already exists',
        status: 409,
      })
      throw error
    }

    const buffer = await investeeFile.toBuffer()
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

    return _resolveInvesteeUrl(investee.toObject())
  } catch (err) {
    const error = new CustomError({
      title: err.detail || `createInvestee exception, ${err.message}`,
      detail: err.detail || `createInvestee exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function updateInvesteeImage (investeeId, userId, file) {
  try {
    const investee = await Investees.findOne({ _id: investeeId })
    if (!investee) {
      const error = new CustomError({
        title: '!! Investee not found',
        detail: 'No investee was found with provided investeeId',
        status: 404,
      })
      throw error
    }

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
  } catch (err) {
    const error = new CustomError({
      title: err.title || `updateInvesteeImage exception, ${err.message}`,
      detail: err.detail || `updateInvesteeImage exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function updateInvestee (
  investeeId,
  userId,
  { name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description }
) {
  try {
    const investee = await Investees.findOne({ _id: investeeId })
    if (!investee) {
      const error = new CustomError({
        title: '!! Investee not found',
        detail: 'No investee was found with provided investeeId',
        status: 404,
      })
      throw error
    }

    investee.name = name
    investee.type = type
    investee.investedAt = investedAt
    investee.disinvestedAt = disinvestedAt
    investee.websiteUrl = websiteUrl
    investee.headquarters = headquarters
    investee.description = description
    investee.updatedBy = userId

    await investee.save({ updatedBy: userId })
  } catch (err) {
    const error = new CustomError({
      title: err.title || `updateInvestee exception, ${err.message}`,
      detail: err.detail || `updateInvestee exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function deleteInvestee (investeeId) {
  try {
    const result = await Promise.all([
      Investees.findOneAndDelete({ _id: investeeId }),
      ChangeLogs.deleteOne({ _id: `investee_${investeeId}` }),
    ])
    await deleteFile(result[0].publicId)
  } catch (err) {
    const error = new CustomError({
      title: err.title || `deleteInvestee exception, ${err.message}`,
      detail: err.detail || `deleteInvestee exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

export default {
  getInvestees,
  getInvesteeById,
  createInvestee,
  updateInvesteeImage,
  updateInvestee,
  deleteInvestee,
}
