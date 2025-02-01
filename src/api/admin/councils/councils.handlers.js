'use strict'

import mongoose from 'mongoose'

import {  uploadFile, deleteFile } from '../../../services/utils.service.js'

import dayjs from 'dayjs'

const CouncilsBucket = mongoose.model('CouncilBucket')

import { createChangeLog } from '../../../services/utils.service.js'

// --------------------
export async function createCouncil (req, reply) {
  const additionalDocs = []
  let reportFile = {}
  let filesToUpload = 0

  let month, year, agenda

  let newCouncilBucket
  let newCouncil

  try {
    if (req.isMultipart()) {
      const parts = req.files()
      for await (const part of parts) {
        if (part.file && part.fieldname === 'councilAdditionalDocs') {
          filesToUpload +=1
          if (filesToUpload > 3) {
            return reply.badRequest('Maximum of 3 additionalDocs allowed for docs.')
          }
        }

        const councilData = part.fields?.councilData?.value ? JSON.parse(part.fields?.councilData?.value) : {}
        const { date, agenda: councilAgenda } = councilData
        if (!date || !councilAgenda) return reply.badRequest('Missing required fields.')

          agenda = councilAgenda
          month = dayjs(date).month()
          year = dayjs(date).year()

        const buffer = await part.toBuffer()
        const dir = part.fieldname === 'councilAdditionalDocs' ? 'additional-docs' : 'reports'

        const folder = `carteracm/councils/${month}-${year}/${dir}`
        const uploadedFile = await uploadFile(buffer, folder, part.filename)


        if (part.fieldname === 'councilAdditionalDocs') {
          additionalDocs.push({
            secureUrl: uploadedFile.secure_url,
            publicId: uploadedFile.public_id
          })
        }

        if (part.fieldname === 'councilReport') {
          reportFile = {
            secureUrl: uploadedFile.secure_url,
            publicId: uploadedFile.public_id
          }
        }
      }

      const parsedAgenda = agenda.replace(/(?:\r\n|\r|\n)/g, '<br>')

       newCouncil = {
        _id: `${month}-${year}`,
        report: reportFile,
        docs: additionalDocs.length > 0 ? additionalDocs : undefined,
        agenda: parsedAgenda,
      }
    } else {
      const { date, agenda } = req.body || {}
      if (!date || !agenda) return reply.badRequest('Missing required fields.')

      const parsedAgenda = agenda.replace(/(?:\r\n|\r|\n)/g, '<br>')
      month = dayjs(date).month()
      year = dayjs(date).year()

      newCouncil = {
        _id: `${month}-${year}`,
        agenda: parsedAgenda,
      }
    }

    newCouncilBucket = await CouncilsBucket.findOneAndUpdate(
      { _id: year, councils: { $not: { $elemMatch: { _id: `${month}-${year}` } } } },
      { $push: { councils: newCouncil } },
      { upsert: true, new: true }
    )

    return newCouncilBucket
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error code.
      reply.code(409).send({ error: 'Council already exists' })
    } else {
      console.error(' !! Could not create council.', err)
      reply.internalServerError(err)
    }
  }
}

// --------------------
export async function deleteCouncilsBucket (req, reply) {
  const { councilYear } = req.params

  try {
    await CouncilsBucket.deleteOne({ _id: councilYear })

    return 'OK'
  } catch (err) {
    console.error(' !! Could not delete council bucket.', councilYear, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function updateCouncil (req, reply) {
  const { councilYear, councilId } = req.params
  const { agenda, minutes, action } = req.body || {}

  const update = {}
  if (action === 'delete') {
    update.$pull = { councils: { _id: councilId } }
  } else {
    update.$set = {
      'councils.$.agenda': agenda,
      'councils.$.minutes': minutes,
    }
  }

  try {
    const councilBucket = await CouncilsBucket.findOneAndUpdate(
      { _id: councilYear, 'councils._id': councilId },
      update,
      { new: true }
    )

    if (!councilBucket) return reply.notFound('Council not found.')

    if (councilBucket.councils.length === 0) {
      // Clean up bucket if no more councils.
      await CouncilsBucket.deleteOne({ _id: councilYear })
    }

    return councilBucket
  } catch (err) {
    console.error(' !! Could not delete council year.', councilYear, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function updateCouncilReport (req, reply) {
  const { id: userId } = req.user
  const { councilYear, councilId } = req.params

  try {
    const councilBucket = await CouncilsBucket.findOne(
      {
        _id: councilYear,
        'councils._id': councilId,
      },
      { 'councils.$': 1 },
    )
    if (!councilBucket) return reply.notFound('Council not found.')

    const file = await req?.file()

    let uploadedFile
    if (file) {
      const councilReportFile = file.fields.councilReportFile

      const buffer = await file.fields.councilReportFile.toBuffer()

      const folder = `carteracm/councils/${councilId}/reports`
      uploadedFile = await uploadFile(buffer, folder, councilReportFile.filename)
    }

    let reportFile
    if (uploadedFile) {
      reportFile = {
        secureUrl: uploadedFile.secure_url,
        publicId: uploadedFile.public_id
      }
    }

    const changeLog = {
      collection: CouncilsBucket,
      _id: `counc-buck_${councilYear}-${councilId}`,
      updatedBy: userId,
    }

    await createChangeLog(changeLog)

    await CouncilsBucket.updateOne(
      { _id: councilYear, 'councils._id': councilId },
      { $set: { 'councils.$.report': reportFile }
    })
  } catch (err) {
    console.error(' !! Could not update council report', err)
    if (err.http_code) {
      const error = this.httpErrors.badRequest('Invalid format.')
      error.code = err.http_code
      reply.send(error)
    } else {
      reply.internalServerError(err)
    }
  }
}

// --------------------
export async function deleteCouncilDoc (req, reply) {
  const { councilYear, councilId, docId } = req.params

  const decodedDocId = decodeURIComponent(docId)

  try {
    const councilBucket = await CouncilsBucket.findOneAndUpdate(
      {
        _id: councilYear,
        'councils._id': councilId,
        'councils.$.docs.publicId': decodedDocId,
      },
      { $pull: { 'councils.$.docs': { publicId: decodedDocId } } },
      { new: true }
    )


    if (!councilBucket) return reply.notFound('Council not found.')

    await deleteFile(decodedDocId)

    return 'OK'

  } catch (err) {
    console.error(' !! Could not delete council doc.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function createCouncilDocs (req, reply) {
  const { councilYear, councilId } = req.params

  const additionalDocs = []
  let filesToUpload = 0

  try {
    const councilBucket = await CouncilsBucket.findOne(
      {
        _id: councilYear,
        'councils._id': councilId,
      },
      { 'councils.$': 1 },
    )

    if (!councilBucket) return reply.notFound('Council not found.')

    const parts = req.files()

    let uploadedFile
    for await (const part of parts) {
      if (part.file) {
        filesToUpload +=1
        if (filesToUpload > 3) {
          return reply.badRequest('Maximum of 3 additionalDocs allowed for docs.')
        }
      }

      const buffer = await part.toBuffer()

      const folder = `carteracm/councils/${councilId}/additional-docs`
      const uploadedFile = await uploadFile(buffer, folder, part.filename)

      additionalDocs.push({
        secureUrl: uploadedFile.secure_url,
        publicId: uploadedFile.public_id
      })
    }

    await CouncilsBucket.updateOne(
      { _id: councilYear, 'councils._id': councilId },
      { $push: { 'councils.$.docs': { $each: additionalDocs } } }
    )

    console.info(additionalDocs)
  } catch (err) {
    console.error(' !! Could not create council doc', err)
    reply.internalServerError(err)
  }
}


// --------------------
export async function createCouncilCall (req, reply) {
  const { councilYear, councilId } = req.params
  const callData = req.body

  if (!councilYear || !councilId || !callData) return reply.badRequest('Missing required fields.')

  try {
    await CouncilsBucket.updateOne(
      { _id: councilYear, 'councils._id': councilId },
      { $set: { 'councils.$.call': callData } }
    )
  } catch (err) {
    console.error(' !! Could not create call', err)
    reply.internalServerError(err)
  }
}
