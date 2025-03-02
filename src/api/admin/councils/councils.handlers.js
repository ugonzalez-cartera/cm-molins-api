'use strict'

import mongoose from 'mongoose'

import {  uploadFile, deleteFile, deleteResourcesByPrefix, deleteFolder } from '../../../services/utils.service.js'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const Councils = mongoose.model('Council')
const Users = mongoose.model('User')
const ChangeLogs = mongoose.model('ChangeLog')

import { sendNotificationEmail } from '../../../services/utils.service.js'

const currentEnv = process.env.NODE_ENV

// --------------------
async function createCouncil (req, reply) {
  const {  id: userId } = req.user
  const additionalDocs = []
  let reportFile = {}
  let filesToUpload = 0

  let month, year, agenda, newDate

  let newCouncil

  try {
    if (req.isMultipart()) {
      const parts = req.files()
      for await (const part of parts) {
        if (part.file && part.fieldname === 'councilAdditionalDocs') {
          // Get part format.
          const format = part.mimetype
          if (format !== 'application/pdf') {
            const error = this.httpErrors.badRequest('Only PDF files are allowed.')
            error.code = 'invalid-format'
            return reply.send(error)
          }

          filesToUpload +=1
          if (filesToUpload > 3) {
            const error = this.httpErrors.badRequest('Max allowed files are 3.')
            error.code = 'max-allowed-files'
            return reply.send(error)
          }
        }

        const councilData = part.fields?.councilData?.value ? JSON.parse(part.fields?.councilData?.value) : {}
        const { date, agenda: councilAgenda } = councilData
        if (!date || !councilAgenda) return reply.badRequest('Missing required fields.')

        agenda = councilAgenda
        month = dayjs(date).month()
        year = dayjs(date).year()
        newDate = dayjs(date).startOf('day').utc(true).toISOString()

        const isExistingCouncil = await Councils.findOne({ year, month })
        if (isExistingCouncil) return reply.conflict('Council already exists')

        const buffer = await part.toBuffer()
        const dir = part.fieldname === 'councilAdditionalDocs' ? 'additional-docs' : 'reports'

        const folder = `${currentEnv}-carteracm/councils/${month}-${year}/${dir}`
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
        date: newDate,
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
      newDate = dayjs(date).startOf('day').utc(true).toISOString()

      const isExistingCouncil = await Councils.exists({ year, month })
      if (isExistingCouncil) return reply.conflict('Council already exists')

      newCouncil = new Councils({
        year,
        month,
        date: newDate,
        agenda: parsedAgenda,
      })
    }

    newCouncil.updatedBy = userId

    await newCouncil.save({ updatedBy: userId })

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
async function deleteCouncilYear (req, reply) {
  const { councilYear } = req.params

  try {
    const councils = await Councils.find({ year: Number(councilYear) })

    for (const council of councils) {
      await Promise.all([
        ChangeLogs.deleteOne({ _id: `council_${council._id}` }),
        Councils.deleteOne({ _id: council._id }),
      ])

      if (council.report?.publicId || council.docs.length > 0) {
        await deleteResourcesByPrefix(`${currentEnv}-carteracm/councils/${council.month}-${council.year}/`)
        await deleteFolder(`${currentEnv}-carteracm/councils/${council.month}-${council.year}`)
      }
    }


    return { msg: 'OK' }
  } catch (err) {
    console.error(' !! Could not delete council year.', councilYear, err)
    reply.internalServerError(err)
  }
}

// --------------------
async function deleteCouncil (req, reply) {
  const { councilId } = req.params

  try {
    const council = await Councils.findOneAndDelete({ _id: councilId }).lean()

    if (council.report?.publicId || council.docs.length > 0) {
      await deleteResourcesByPrefix(`${currentEnv}-carteracm/councils/${council.month}-${council.year}/`)
      await deleteFolder(`${currentEnv}-carteracm/councils/${council.month}-${council.year}`)
    }

    return 'OK'
  } catch (err) {
    console.error(' !! Could not delete council bucket.', councilId, err)
    reply.internalServerError(err)
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
    const existingCouncil = await Councils.findOne({ month }).lean()
    if (existingCouncil) {
      if (existingCouncil._id !== councilId) return reply.conflict('Council already exists.')
    }

    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $set: update },
      { new: true, updatedBy: userId }
    )

    if (!council) return reply.notFound('Council not found.')

    return council
  } catch (err) {
    console.error(' !! Could not delete council year.', councilId, err)
    reply.internalServerError(err)
  }
}

// --------------------
async function deleteCouncilReport (req, reply) {
  const { councilId } = req.params

  try {

    const council = await Councils.findOneAndUpdate({ _id: councilId }, { $unset: { report: 0 } })

    if (council.report?.publicId) {
      deleteFile(council.report.publicId)
    }

    return 'OK'
  } catch (err) {
    console.error(' !! Could not delete council report.', err)
    reply.internalServerError(err)
  }
}

// --------------------
async function updateCouncilFileResource (req, reply) {
  const {  id: userId } = req.user
  const { councilId, resource } = req.params

  try {
    const council = await Councils.findOne({ _id: councilId })
    if (!council) return reply.notFound('Council not found.')

    const file = await req?.file()

    let uploadedFile
    if (file) {
      const councilFile = file.fields.councilFile

      const buffer = await file.fields.councilFile.toBuffer()

      const folder = `${currentEnv}-carteracm/councils/${council.month}-${council.year}/${resource}`
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
      { $set: { [resource]: { file: updatedFile } } },
      { updatedBy: userId }
    )
  } catch (err) {
    console.error(' !! Could not update council file resource.', err)
    reply.internalServerError(err)
  }
}

// --------------------
async function deleteCouncilFileResource (req, reply) {
  const { councilId, resource } = req.params

  try {
    const council = await Councils.findOne
      ({ _id: councilId })

    if (!council) return reply.notFound('Council not found.')

    if (council[resource]?.file?.publicId) {
      deleteFile(council[resource].file.publicId)
    }

    await Councils.updateOne(
      { _id: councilId },
      { $unset: { [resource]: 0 } }
    )

    return 'OK'
  } catch (err) {
    console.error(' !! Could not delete council file resource.', err)
    reply.internalServerError(err)
  }
}

// --------------------
async function updateCouncilReport (req, reply) {
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

      const folder = `${currentEnv}-carteracm/councils/${council.month}-${council.year}/reports`
      uploadedFile = await uploadFile(buffer, folder, councilReportFile.filename)

      if (council.report?.publicId) {
        deleteFile(council.report.publicId)
      }
    }

    let reportFile
    if (uploadedFile) {
      reportFile = {
        secureUrl: uploadedFile.secure_url,
        publicId: uploadedFile.public_id
      }
    }

    await Councils.updateOne(
      { _id: councilId },
      { $set: { report: reportFile } },
      { updatedBy: userId }
    )
  } catch (err) {
    console.error(' !! Could not update council report.', err)
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


    if (!council) return reply.notFound('Council not found.')

    deleteFile(decodedDocId)

    return 'OK'

  } catch (err) {
    console.error(' !! Could not delete council doc.', err)
    reply.internalServerError(err)
  }
}

// --------------------
async function createCouncilDocs (req, reply) {
  const { id: userId } = req.user
  const { councilId } = req.params

  const additionalDocs = []
  let filesToUpload = 0

  try {
    const council = await Councils.findOne({ _id: councilId })

    if (!council) return reply.notFound('Council not found.')

    const parts = req.files()

    for await (const part of parts) {
      if (part.file) {
        // Get part format.
        const format = part.mimetype
        if (format !== 'application/pdf') {
          const error = this.httpErrors.badRequest('Only PDF files are allowed.')
          error.code = 'invalid-format'
          return reply.send(error)
        }


        filesToUpload +=1
        if (filesToUpload > 3) {
          const error = this.httpErrors.badRequest('Max allowed files are 3.')
          error.code = 'max-allowed-files'
          return reply.send(error)
        }
      }

      const buffer = await part.toBuffer()

      const folder = `${currentEnv}-carteracm/councils/${council.month}-${council.year}/additional-docs`
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
    console.error(' !! Could not create council doc', err)
    reply.internalServerError(err)
  }
}

// --------------------
async function getAvailableCallCouncils (req, reply) {
  try {
    const councils = await Councils.find({ date: { $gt: dayjs().tz('Europe/Paris').startOf('day').toISOString() } }).lean()

    return councils
  } catch (err) {
    console.error(' !! Could not get available call councils.', err)
    reply.internalServerError(err)
  }
}

// --------------------
async function createCouncilCall (req, reply) {
  const { origin } = req.headers
  const { id: userId } = req.user
  const { councilId } = req.params
  const callData = req.body

  if (!councilId || !callData) return reply.badRequest('Missing required fields.')

  try {
    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $set: { call: callData } },
      { new: true, updatedBy: userId },
    )

    if (!council) return reply.notFound('Council not found.')

    const emailData = {
      templateId: 3,
      description: council.call.description,
      body: council.agenda,
      title: council.call.title,
      subject: `Convocatoria Consejo Cartera de inversiones C.M.- ${dayjs(council.date).tz('Europe/Paris').format('DD/MM/YYYY')}`,
    }

    const counselors = await Users.find({ roles: { $in: ['counselor'] } ,isNotActive: { $ne: true } }).lean()

    for (const counselor of counselors) {
      Object.assign(emailData,  {
        name: counselor.givenName.toUpperCase(),
        familyName: counselor.familyName.toUpperCase(),
        email: counselor.email,
        locale: counselor.country,
        ctaLink: `${origin}`,
      })

      sendNotificationEmail(emailData)
    }

    return council
  } catch (err) {
    console.error(' !! Could not create call.', err)
    reply.internalServerError(err)
  }
}

export default {
  createCouncil,
  deleteCouncilYear,
  deleteCouncil,
  updateCouncil,
  updateCouncilReport,
  createCouncilDocs,
  deleteCouncilDoc,
  createCouncilCall,
  getAvailableCallCouncils,
  deleteCouncilReport,
  updateCouncilFileResource,
  deleteCouncilFileResource,
}
