'use strict'

import mongoose from 'mongoose'

import { CustomError } from '../../../utils.js'

import councilsService from './councils.service.js'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const Councils = mongoose.model('Council')

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
    await councilsService.deleteCouncilYear(Number(councilYear))
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
    await councilsService.deleteCouncil(councilId)
    return { message: 'OK' }
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not delete council',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function updateCouncil (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params

  const { agenda, minutes, date } = req.body || {}
  const year = dayjs(date).year()
  const month = dayjs(date).month()
  const updatedCouncil = { agenda, minutes, date, year, month }

  try {
    const council = await councilsService.updateCouncil(councilId, updatedCouncil, userId)
    return council
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not update council',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function updateCouncilFileResource (req, reply) {
  const {  id: userId } = req.user
  const { councilId, resource } = req.params

  try {
    const file = await req?.file()
    await councilsService.updateCouncilFileResource({ councilId, resource, file, userId })
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not update council file resource',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function deleteCouncilFileResource (req, reply) {
  const { councilId, resource } = req.params

  try {
    await councilsService.deleteCouncilFileResource(councilId, resource)
    return { message: 'OK' }
  } catch (err) {
    const error = new CustomError({
      title: err.title ||'!! Could not delete council file resource',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function deleteCouncilDoc (req, reply) {
  const {  id: userId } = req.user
  const { councilId, docId } = req.params

  const decodedDocId = decodeURIComponent(docId)

  try {
    await councilsService.deleteCouncilDoc(councilId, decodedDocId, userId)

    return { message: 'OK' }
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not delete council doc',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
      code: err.code,
    })
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function createCouncilDocs (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params

  try {
    const parts = req.files()
    await councilsService.createCouncilDocs(councilId, parts, userId)
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not create council docs',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
      code: err.code,
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
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
    reply.status(error.status).send(error.toJSON())
  }
}

// --------------------
async function createCouncilCall (req, reply) {
  const { origin } = req.headers
  const { id: userId } = req.user
  const { councilId } = req.params
  const callData = req.body

  try {
    const council = await councilsService.createCouncilCall({ councilId, callData, userId, origin })
    return council
  } catch (err) {
    const error = new CustomError({
      title: err.title || '!! Could not create call',
      detail: err.detail || err.message,
      status: err.status || 500,
      instance: req.url,
    })
    error.print()
    reply.status(error.status).send(error.toJSON())
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
