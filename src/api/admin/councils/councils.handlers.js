'use strict'

import councilsService from './councils.service.js'

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
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function deleteCouncilYear (req, reply) {
  const { councilYear } = req.params

  try {
    await councilsService.deleteCouncilYear(Number(councilYear))
    return { message: 'OK' }
  } catch (err) {
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function deleteCouncil (req, reply) {
  const { councilId } = req.params

  try {
    await councilsService.deleteCouncil(councilId)
    return { message: 'OK' }
  } catch (err) {
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function updateCouncil (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params

  const { agenda, minutes, date } = req.body || {}

  try {
    const council = await councilsService.updateCouncil(councilId, userId, { agenda, minutes, date })
    return council
  } catch (err) {
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
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
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function deleteCouncilFileResource (req, reply) {
  const { councilId, resource } = req.params

  try {
    await councilsService.deleteCouncilFileResource(councilId, resource)
    return { message: 'OK' }
  } catch (err) {
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
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
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
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
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function getAvailableCallCouncils (req, reply) {
  try {
    const councils = await councilsService.getAvailableCallCouncils()
    return councils
  } catch (err) {
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function createCouncilCall (req, reply) {
  const { origin } = req.headers
  const { id: userId } = req.user
  const { councilId } = req.params
  const { callData, hasAttachment } = req.body

  try {
    const council = await councilsService.createCouncilCall({ councilId, callData, userId, origin, hasAttachment })
    return council
  } catch (err) {
    err.instance = req.url
    err.print()
    reply.status(err.status).send(err.toJSON())
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
