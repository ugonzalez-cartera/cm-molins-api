'use strict'

import mongoose from 'mongoose'

import {  uploadFile, deleteFile } from '../../../services/utils.service.js'

import { CustomError } from '../../../utils.js'

import councilsService from './councils.service.js'
import { sendNotificationEmail } from '../../../services/utils.service.js'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const Councils = mongoose.model('Council')
const Users = mongoose.model('User')

// --------------------
async function createCouncil (req, reply) {
  let newCouncil

  try {
    if (req.isMultipart()) {
      const parts = req.files()
      newCouncil = await councilsService.createCouncilWithFiles(parts)
    } else {
      const { date, agenda } = req.body || {}
      newCouncil = await councilsService.createCouncilRegular({ date, agenda })
    }

    return newCouncil
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not create council',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
      code: err.code
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function deleteCouncilYear (req, reply) {
  const { councilYear } = req.params

  try {
    const councils = await Councils.find({ year: Number(councilYear) })

    for (const council of councils) {
      await councilsService.deleteCouncil(council)
    }

    return { message: 'OK' }
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not delete council year',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function deleteCouncil (req, reply) {
  const { councilId } = req.params

  try {
    const council = await Councils.findOneAndDelete({ _id: councilId }).lean()
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot delete a council that does not exist',
        status: 404,
        instance: req.url,
      })
      error.print()
      reply.status(error.status).send(error)
    }
    await councilsService.deleteCouncil(council)

    return { message: 'OK' }
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not delete council',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error)
  }
}

// --------------------
async function updateCouncil (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params

  const { agenda, minutes, date } = req.body || {}
  const year = dayjs(date).year()
  const month = dayjs(date).month()
  const update = { agenda, minutes, date, year, month }

  try {
    const existingCouncil = await Councils.findOne({ year, month }).lean()
    if (existingCouncil) {
      if (existingCouncil._id !== councilId) {
        const error = new CustomError({
          title: 'Council already exists',
          detail: 'Cannot create a council in an existing month.',
          status: 409,
          instance: req.url,
        })
        error.print()
        return reply.status(error.status).send(error)
      }
    }

    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $set: update },
      { new: true, updatedBy: userId }
    )
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot update a council that does not exist',
        status: 404,
        instance: req.url,
      })
      error.print()
      return reply.status(error.status).send(error)
    }

    return council
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not update council',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error)
  }
}

// --------------------
async function updateCouncilFileResource (req, reply) {
  const {  id: userId } = req.user
  const { councilId, resource } = req.params

  try {
    const council = await Councils.findOne({ _id: councilId })
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot update a council that does not exist.',
        status: 404,
        instance: req.url,
      })
      error.print()
      return reply.status(error.status).send(error)
    }

    const file = await req?.file()
    let uploadedFile
    if (file) {
      const councilFile = file.fields.councilFile
      const buffer = await file.fields.councilFile.toBuffer()
      const folder = councilsService.getFolderName(council.month, council.year, resource)
      uploadedFile = await uploadFile(buffer, folder, councilFile.filename)
      if (council[resource]?.publicId) {
        deleteFile(council[resource].publicId)
      }
    }

    let updatedFile
    if (uploadedFile) {
      updatedFile = {
        secureUrl: uploadedFile.secure_url,
        publicId: uploadedFile.public_id
      }
    }

    await Councils.updateOne(
      { _id: councilId },
      { $set: { [`${resource}.file`]: updatedFile } },
      { updatedBy: userId }
    )
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not update council file resource',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error)
  }
}

// --------------------
async function deleteCouncilFileResource (req, reply) {
  const { councilId, resource } = req.params

  try {
    const council = await Councils.findOne({ _id: councilId }).lean()
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot delete a resource from a council that does not exist',
        status: 404,
        instance: req.url,
      })
      error.print()
      return reply.status(error.status).send(error)
    }

    if (council[resource]?.file?.publicId) {
      deleteFile(council[resource].file.publicId)
    }

    await Councils.updateOne(
      { _id: councilId },
      { $unset: { [`${resource}.file`]: 0 } }
    )

    return { message: 'OK' }
  } catch (err) {
    const error = new CustomError({
      title: err.title ||'!! Could not delete council file resource',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error)
  }
}

// --------------------
async function deleteCouncilDoc (req, reply) {
  const {  id: userId } = req.user
  const { councilId, docId } = req.params

  const decodedDocId = decodeURIComponent(docId)

  try {
    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $pull: { docs: { publicId: decodedDocId } } },
      { new: true, updatedBy: userId },
    )
    if (!council) return reply.notFound('Council not found')

    deleteFile(decodedDocId)

    return { message: 'OK' }

  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not delete council doc',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
      code: err.code,
    })
    reply.status(error.status).send(error)
  }
}

// --------------------
async function createCouncilDocs (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params

  const additionalDocs = []
  let filesToUpload = 0

  try {
    const council = await Councils.findOne({ _id: councilId }).lean()
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot add docs to a council that does not exist.',
        status: 404,
        instance: req.url,
      })
      error.print()
      return reply.status(error.status).send(error)
    }

    const parts = req.files()
    for await (const part of parts) {
      if (part.file) {
        filesToUpload += 1
        councilsService.validateCouncilPart(part.mimetype, filesToUpload > 3)
      }

      const buffer = await part.toBuffer()
      const folder = councilsService.getFolderName(council.month, council.year, 'additional-docs')
      const uploadedFile = await uploadFile(buffer, folder, part.filename)

      additionalDocs.push({
        secureUrl: uploadedFile.secure_url,
        publicId: uploadedFile.public_id
      })
    }

    await Councils.updateOne(
      { _id: councilId },
      { $push: { docs: { $each: additionalDocs } } },
      { updatedBy: userId }
    )
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not create council docs',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
      code: err.code,
    })
    error.print()
    reply.status(error.status).send(error)
  }
}

// --------------------
async function getAvailableCallCouncils (req, reply) {
  try {
    const councils = await Councils.find({ date: { $gt: dayjs().tz('Europe/Paris').startOf('day').toISOString() } }).lean()
    return councils
  } catch (err) {
    const error = new CustomError({
      title: '!! Could not get available call councils.',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error)
  }
}

// --------------------
async function createCouncilCall (req, reply) {
  const { origin } = req.headers
  const { id: userId } = req.user
  const { councilId } = req.params
  const callData = req.body

  try {
    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $set: { call: callData } },
      { new: true, updatedBy: userId },
    )
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot create a call for a council that does not exist.',
        status: 404,
        instance: req.url,
      })
      error.print()
      return reply.status(error.status).send(error)
    }
    councilsService.sendCouncilCallEmail(council, origin)

    return council
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not create call',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error)
  }
}

export default {
  createCouncil,
  deleteCouncilYear,
  deleteCouncil,
  updateCouncil,
  createCouncilDocs,
  deleteCouncilDoc,
  createCouncilCall,
  getAvailableCallCouncils,
  updateCouncilFileResource,
  deleteCouncilFileResource,
}
