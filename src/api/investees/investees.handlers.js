'use strict'

import mongoose from 'mongoose'

import { uploadImage, deleteImage, createChangeLog } from '../../services/utils.service.js'

const Investees = mongoose.model('Investee')

// --------------------
export async function getInvestees (req, reply) {
  try {
    const { page, type, limit } = req.query

    const filter = {}
    const skip = (limit * page) - limit

    if (type) {
      filter.type = { $in: type.split(',') }
    }

    const [docs, docCount] = await Promise.all([
      Investees.find(filter).skip(skip).limit(limit).lean(),
      Investees.countDocuments(filter),
    ])

    return { docs, docCount }
  } catch (err) {
    console.error(' !! Could not fetch investees', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function createInvestee (req, reply) {
  try {
    const file = await req.file()

    const { investeeData, investeeFile } = file.fields

    if (!investeeData || !investeeFile) return reply.badRequest('Missing investee data or file.')

    const { name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description = {} } = JSON.parse(file.fields?.investeeData?.value || '')

    const isExistingInvestee = await Investees.exists({ name })
    if (isExistingInvestee) return reply.conflict('Investee already exists.')

    const buffer = await file.fields.investeeFile.toBuffer()

    const folder = 'carteracm/investees'
    const uploadImageResult = await uploadImage(buffer, folder, investeeFile.filename)

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

    await investee.save()

    return investee

  } catch (err) {
    console.error(' !! Could not create investee', err)
    return reply.internalServerError(err)
  }
}

// --------------------
export async function updateInvestee (req, reply) {
  const {  id: userId } = req.user
  const { investeeId } = req.params

  const {  name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description } = req.body || {}

  try {
    const investee = await Investees.findOne({ _id: investeeId })
    if (!investee) return reply.notFound('Investee not found.')

    const changeLog = {
      collection: Investees,
      _id: `inv_${investeeId}`,
      updatedBy: userId,
    }

    let uploadImageResult = null
    if (req.isMultipart()) {
      const file = await req?.file()

      if (file) {
        const investeeFile = file.fields.investeeFile

        const buffer = await file.fields.investeeFile.toBuffer()

        const folder = 'carteracm/investees'
        uploadImageResult = await uploadImage(buffer, folder, investeeFile.filename)
      }

      if (uploadImageResult) {
        investee.logoUrl = uploadImageResult.secure_url
        investee.publicId = uploadImageResult.public_id
      }

      await createChangeLog(changeLog)

      await investee.save()
    } else {
      investee.name = name
      investee.type = type
      investee.investedAt = investedAt
      investee.disinvestedAt = disinvestedAt
      investee.websiteUrl = websiteUrl
      investee.headquarters = headquarters
      investee.description = description

      await createChangeLog(changeLog)

      await investee.save()
    }

    return investee

  } catch (err) {
    console.error(` !! Could not update investe: ${investeeId}`, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function deleteInvestee (req, reply) {
  try {
    const { investeeId } = req.params

    const investee = await Investees.findOneAndDelete({ _id: investeeId })
    if (!investee) return reply.notFound('Investee not found.')

    await deleteImage(investee.publicId)

    return { msg: 'Ok' }

  } catch (err) {
    console.error(' !! Could not delete investee', err)
    return reply.internalServerError(err)
  }
}
