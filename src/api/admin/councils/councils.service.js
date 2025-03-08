import mongoose from 'mongoose'

import { CustomError } from '../../../utils.js'
import { uploadFile, deleteFolder, deleteResourcesByPrefix, sendNotificationEmail } from '../../../services/utils.service.js'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const currentEnv = process.env.NODE_ENV

const Councils = mongoose.model('Council')
const ChangeLogs = mongoose.model('ChangeLog')
const Users = mongoose.model('User')

// --------------------
function validateCouncilPart (mimetype, hasReachedMaxFiles) {
  if (mimetype !== 'application/pdf') {
    const error = new CustomError({
      title: 'File type not allowed',
      detail: 'Only PDF files are allowed.',
      status: 400,
      code: 'invalid-format',
    })
    throw error
  }

  if (hasReachedMaxFiles) {
    const error = new CustomError({
      title: 'Max allowed files reached',
      detail: 'Max allowed files are 3.',
      status: 400,
      code: 'max-allowed-files',
    })
    throw error
  }
}

// --------------------
function getDirName (fieldname) {
  const dirs = new Map([
    ['councilAdditionalDocs', 'additional-docs'],
    ['councilReport', 'report'],
    ['councilAgenda', 'agenda'],
  ])

  return dirs.get(fieldname)
}

// --------------------
function getFolderName (month, year, dir) {
  return `${currentEnv}-carteracm/councils/${month}-${year}/${dir}`
}

async function validateCouncilExists (year, month) {
  const isExistingCouncil = await Councils.findOne({ year, month })
  if (isExistingCouncil) {
    const error = new CustomError({
      title: 'Council already exists',
      detail: 'A council for this date already exists.',
      status: 409,
    })
    throw error
  }
}

// --------------------
async function createCouncilWithFiles (parts) {
  try {
    const additionalDocs = []
    let reportFile = {}
    let agendaFile = {}
    let filesToUpload = 0
    let agenda, month, year, newDate

    for await (const part of parts) {
      if (part.file && part.fieldname === 'councilAdditionalDocs') {
        filesToUpload +=1
        validateCouncilPart(part.mimetype, filesToUpload > 3)
      }

      const councilData = part.fields?.councilData?.value ? JSON.parse(part.fields?.councilData?.value) : {}
      const { date, agenda: councilAgenda } = councilData
      if (!date) {
        const error = new CustomError({
          title: 'Missing required fields',
          detail: 'Missing date or agenda',
          status: 400,
        })
        throw error
      }

      agenda = councilAgenda
      month = dayjs(date).month()
      year = dayjs(date).year()
      newDate = dayjs(date).startOf('day').utc(true).toISOString()

      await validateCouncilExists(year, month)

      const buffer = await part.toBuffer()
      const dir = getDirName(part.fieldname)
      const folder = getFolderName(month, year, dir)
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

      if (part.fieldname === 'councilAgenda') {
        agendaFile = {
          secureUrl: uploadedFile.secure_url,
          publicId: uploadedFile.public_id
        }
      }
    }

    const agendaDescription = agenda && {  description: agenda.description?.replace(/(?:\r\n|\r|\n)/g, '<br>') }
    const newAgenda = agendaFile ? { file: agendaFile, ...agendaDescription } : agendaDescription

    const newCouncil = new Councils({
      year,
      month,
      date: newDate,
      report: reportFile,
      docs: additionalDocs.length > 0 ? additionalDocs : undefined,
      agenda: newAgenda,
    })

    await newCouncil.save()
    return newCouncil
  } catch (err) {
    const error = new CustomError({
      title: err.title || 'Error uploading files',
      detail: err.detail,
      status: err.status || 500,
      code: err.code,
    })
    throw error
  }
}

// --------------------
async function createCouncilRegular ({ date, agenda }) {
  if (!date) {
    const error = new CustomError({
      title: 'Missing required fields',
      detail: 'Missing date or agenda',
      status: 400,
    })
    throw error
  }

  try {
    const parsedAgenda = agenda?.replace(/(?:\r\n|\r|\n)/g, '<br>')
    const month = dayjs(date).month()
    const year = dayjs(date).year()
    const newDate = dayjs(date).startOf('day').utc(true).toISOString()

    await validateCouncilExists(year, month)

    const newCouncil = new Councils({
      year,
      month,
      date: newDate,
      agenda: {
        description: parsedAgenda
      },
    })

    await newCouncil.save()
    return newCouncil
  } catch (err) {
    const error = new CustomError({
      title: err.title || 'Error creating council',
      detail: err.detail,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function deleteCouncil (council) {
  try {
    await Promise.all([
      ChangeLogs.deleteOne({ _id: council._id }),
      Councils.deleteOne({ _id: council._id }),
    ])

    if (council.report?.publicId || council.docs.length > 0) {
      try {
        await deleteResourcesByPrefix(`${currentEnv}-carteracm/councils/${council.month}-${council.year}/`)
        await deleteFolder(`${currentEnv}-carteracm/councils/${council.month}-${council.year}`)
      } catch (innerErr) {
        const error = new CustomError({
          title: innerErr.title || 'Error deleting folder or resource',
          detail: innerErr.detail,
          status: innerErr.status,
        })
        throw error
      }
    }
  } catch (err) {
    const error = new CustomError({
      title: err.title || 'Error deleting council',
      detail: err.detail,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function sendCouncilCallEmail (council, origin) {
  try {
    const counselors = await Users.find({ roles: { $in: ['counselor'] }, isNotActive: { $ne: true } }).lean()

    const emailData = {
      templateId: 3,
      description: council.call.description,
      body: council.agenda.description,
      title: council.call.title,
      subject: `Convocatoria Consejo Cartera de inversiones C.M.- ${dayjs(council.date).tz('Europe/Paris').format('DD/MM/YYYY')}`,
    }

    for (const counselor of counselors) {
      Object.assign(emailData,  {
        name: counselor.givenName.toUpperCase(),
        familyName: counselor.familyName.toUpperCase(),
        email: counselor.email,
        locale: counselor.country,
        ctaLink: origin,
      })

      sendNotificationEmail(emailData)
    }
  } catch (err) {
    const error = new CustomError({
      title: err.title || 'Error sending council call email',
      detail: err.detail,
      status: err.status || 500,
    })
    throw error
  }
}

export default {
  validateCouncilPart,
  getDirName,
  getFolderName,
  createCouncilWithFiles,
  createCouncilRegular,
  deleteCouncil,
  sendCouncilCallEmail,
}
