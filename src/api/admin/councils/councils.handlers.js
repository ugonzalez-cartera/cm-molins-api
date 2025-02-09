'use strict'

import mongoose from 'mongoose'

import {  uploadFile, deleteFile } from '../../../services/utils.service.js'

import dayjs from 'dayjs'

const Councils = mongoose.model('Council')
const Counselors = mongoose.model('Counselor')
const ChangeLogs = mongoose.model('ChangeLog')

import { sendNotificationEmail } from '../../../services/utils.service.js'

// --------------------
export async function createCouncil (req, reply) {
  const {  id: userId } = req.user
  const additionalDocs = []
  let reportFile = {}
  let filesToUpload = 0

  let month, year, agenda

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

      newCouncil = new Councils({
        year,
        month,
        report: reportFile,
        docs: additionalDocs.length > 0 ? additionalDocs : undefined,
        agenda: parsedAgenda,
      })
    } else {
      const { date, agenda } = req.body || {}
      if (!date || !agenda) return reply.badRequest('Missing required fields.')

      const parsedAgenda = agenda.replace(/(?:\r\n|\r|\n)/g, '<br>')
      month = dayjs(date).month()
      year = dayjs(date).year()

      newCouncil = new Councils({
        year,
        month,
        agenda: parsedAgenda,
      })
    }

    newCouncil.updatedBy = userId

    await newCouncil.save()

    return newCouncil
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
export async function deleteCouncilYear (req, reply) {
  const { councilYear } = req.params

  try {
    await Promise.all([
      Councils.deleteMany({ year: Number(councilYear) }),
      ChangeLogs.deleteMany({ _id: `` }),
    ])

    return { msg: 'OK' }
  } catch (err) {
    console.error(' !! Could not delete council year.', councilYear, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function deleteCouncil (req, reply) {
  const { councilId } = req.params

  try {
    await Councils.deleteOne({ _id: councilId })

    return 'OK'
  } catch (err) {
    console.error(' !! Could not delete council bucket.', councilId, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function updateCouncil (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params
  const { agenda, minutes } = req.body || {}

  const update = { agenda, minutes, updatedBy: userId }

  try {
    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $set: update },
      { new: true }
    )

    if (!council) return reply.notFound('Council not found.')

    return council
  } catch (err) {
    console.error(' !! Could not delete council year.', councilId, err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function updateCouncilReport (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params

  try {
    const council = await Councils.findOne({ _id: councilId })
    if (!council) return reply.notFound('Council not found.')

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

    await Councils.updateOne({ _id: councilId }, { $set: { report: reportFile, updatedBy: userId } })
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
  const { councilId, docId } = req.params

  const decodedDocId = decodeURIComponent(docId)

  try {
    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $pull: { docs: { publicId: decodedDocId } } },
      { new: true }
    )


    if (!council) return reply.notFound('Council not found.')

    await deleteFile(decodedDocId)

    return 'OK'

  } catch (err) {
    console.error(' !! Could not delete council doc.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function createCouncilDocs (req, reply) {
  const { councilId } = req.params

  const additionalDocs = []
  let filesToUpload = 0

  try {
    const council = await Councils.findOne({ _id: councilId })

    if (!council) return reply.notFound('Council not found.')

    const parts = req.files()

    for await (const part of parts) {
      if (part.file) {
        filesToUpload +=1
        if (filesToUpload > 3) {
          return reply.badRequest('Maximum of 3 additionalDocs allowed for docs.')
        }
      }

      const buffer = await part.toBuffer()

      const folder = `carteracm/councils/${council.year}/${councilId}/additional-docs`
      const uploadedFile = await uploadFile(buffer, folder, part.filename)

      additionalDocs.push({
        secureUrl: uploadedFile.secure_url,
        publicId: uploadedFile.public_id
      })
    }

    await Councils.updateOne(
      { _id: councilId },
      { $push: { docs: { $each: additionalDocs } } }
    )
  } catch (err) {
    console.error(' !! Could not create council doc', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function getAvailableCallCouncils (req, reply) {
  const currentMonth = dayjs().month()
  const currentYear = dayjs().year()
  try {
    const councils = await Councils.find({ month: { $gte: currentMonth }, year: { $gte: currentYear } }).lean()

    return councils
  } catch (err) {
    console.error(' !! Could not get available call councils.', err)
    reply.internalServerError(err)
  }
}

// --------------------
export async function createCouncilCall (req, reply) {
  const { councilId } = req.params
  const callData = req.body

  if (!councilId || !callData) return reply.badRequest('Missing required fields.')

  try {
    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $set: { call: callData } },
      { new: true },
    )

    if (!council) return reply.notFound('Council not found.')

    const emailData = {
      templateId: 3,
      description: council.call.description,
      body: council.agenda,
      title: council.call.title,
      subject: `Convocatoria Consejo Cartera C.M.- ${dayjs(council.call.date).format('DD/MM/YYYY')}`,
    }

    const hasAttachment = council.docs.length > 0 || !!council.report
    if (hasAttachment) {
      emailData.attachment = [
        // Add .jpg extension to publicId as public id has the original extension.
        ...council.docs?.map(doc => ({ url: doc.secureUrl, name: doc.publicId + '.jpg' })),
        { url: council.report?.secureUrl, name: council.report?.publicId + '.jpg' },
      ]
    }

    const counselors = await Counselors.find({ isNotActive: { $ne: true } }).lean()

    for (const counselor of counselors) {
      Object.assign(emailData,  {
        name: counselor.givenName.toUpperCase(),
        familyName: counselor.familyName.toUpperCase(),
        email: counselor.email,
        locale: counselor.country,
      })

      sendNotificationEmail(emailData)
    }

    return council
  } catch (err) {
    console.error(' !! Could not create call.', err)
    reply.internalServerError(err)
  }
}
