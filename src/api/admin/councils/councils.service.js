import mongoose from 'mongoose'

import { CustomError } from '../../../utils.js'
import { uploadFile, deleteFile, deleteFolder, deleteResourcesByPrefix, sendNotificationEmail } from '../../../services/utils.service.js'

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
function _validateCouncilPart (mimetype, hasReachedMaxFiles) {
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
function _getDirName (fieldname) {
  const dirs = new Map([
    ['councilAdditionalDocs', 'additional-docs'],
    ['councilReport', 'report'],
    ['councilAgenda', 'agenda'],
  ])

  return dirs.get(fieldname)
}

// --------------------
function _getFolderName (month, year, dir) {
  return `${currentEnv}-carteracm/councils/${month}-${year}/${dir}`
}

async function _validateCouncilExists (year, month) {
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
        _validateCouncilPart(part.mimetype, filesToUpload > 3)
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

      await _validateCouncilExists(year, month)

      const buffer = await part.toBuffer()
      const dir = _getDirName(part.fieldname)
      const folder = _getFolderName(month, year, dir)
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
      title: err.title || `createCouncilWithFiles exception, ${err.message}`,
      detail: err.detail || `createCouncilWithFiles exception, ${err}`,
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

    await _validateCouncilExists(year, month)

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
      title: err.title || `createCouncilRegular exception, ${err.message}`,
      detail: err.detail || `createCouncilRegular exception, ${err}`,
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
      body: council.agenda.description.replace(/<br>/g, '\n'),
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
      title: err.title || `sendCouncilEmail exception, ${err.message}`,
      detail: err.detail || `sendCouncilEmail exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function deleteCouncilDoc (councilId, docId, userId) {
  try {
    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $pull: { docs: { publicId: docId } } },
      { new: true, updatedBy: userId },
    )
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'The council was not found',
        status: 404,
      })
      throw error
    }

    deleteFile(docId)
  } catch (err) {
    const error = new CustomError({
      title: err.title || `deleteCouncilDoc exception, ${err.message}`,
      detail: err.detail || `deleteCouncilDoc exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function createCouncilDocs (councilId, parts, userId) {
  const additionalDocs = []
  let filesToUpload = 0

  try {
    const council = await Councils.findOne({ _id: councilId }).lean()
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot add docs to a council that does not exist.',
        status: 404,
      })
      throw error
    }

    for await (const part of parts) {
      if (part.file) {
        filesToUpload += 1
        _validateCouncilPart(part.mimetype, filesToUpload > 3)
      }

      const buffer = await part.toBuffer()
      const folder = _getFolderName(council.month, council.year, 'additional-docs')
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
      title: err.title || `createCouncilDocs exception, ${err.message}`,
      detail: err.detail || `createCouncilDocs exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function createCouncilCall ({  councilId, callData, userId, origin }) {
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
      })
      throw error
    }
    sendCouncilCallEmail(council, origin)
  } catch (err) {
    const error = new CustomError({
      title: err.title || `createCouncilCall exception, ${err.message}`,
      detail: err.detail || `createCouncilCall exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function deleteCouncilFileResource (councilId, resource) {
  try {
    const council = await Councils.findOne({ _id: councilId }).lean()
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot delete a resource from a council that does not exist',
        status: 404,
      })
      throw error
    }

    if (council[resource]?.file?.publicId) {
      deleteFile(council[resource].file.publicId)
    }

    await Councils.updateOne(
      { _id: councilId },
      { $unset: { [`${resource}.file`]: 0 } }
    )
  } catch (err) {
    const error = new CustomError({
      title: err.title || `deleteCouncilFileResource exception, ${err.message}`,
      detail: err.detail || `deleteCouncilFileResource exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function updateCouncilFileResource ({ councilId, resource, file, userId }) {
  try {
    const council = await Councils.findOne({ _id: councilId })
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot update a council that does not exist',
        status: 404,
      })
      throw error
    }

    let uploadedFile
    if (file) {
      const councilFile = file.fields.councilFile
      const buffer = await councilFile.toBuffer()
      const folder = _getFolderName(council.month, council.year, resource)
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
      title: err.title || `updateCouncilFileResource exception, ${err.message}`,
      detail: err.detail || `updateCouncilFileResource exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function updateCouncil (councilId, userId, { agenda, minutes, date }) {
  const year = dayjs(date).year()
  const month = dayjs(date).month()
  const updatedCouncil = { agenda: { description: agenda.description.replace(/(?:\r\n|\r|\n)/g, '<br>') } , minutes, date, year, month }

  try {
    const existingCouncil = await Councils.findOne({ year, month }).lean()
    if (existingCouncil) {
      if (existingCouncil._id !== councilId) {
        const error = new CustomError({
          title: 'Council already exists',
          detail: 'Cannot create a council in an existing month.',
          status: 409,
        })
        throw error
      }
    }

    const council = await Councils.findOneAndUpdate(
      { _id: councilId },
      { $set: updatedCouncil },
      { new: true, updatedBy: userId }
    )
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot update a council that does not exist',
        status: 404,
      })
      throw error
    }

    return council
  } catch (err) {
    const error = new CustomError({
      title: err.title || `UpdateCouncil exception, ${err.message}`,
      detail: err.detail || `UpdateCouncil exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function deleteCouncil (councilId) {
  try {
    const council = await Councils.findOneAndDelete({ _id: councilId }).lean()
    if (!council) {
      const error = new CustomError({
        title: 'Council not found',
        detail: 'Cannot delete a council that does not exist',
        status: 404,
      })
      throw error
    }

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
          title: `delete files exception, ${innerErr}`,
          detail: `delete files exception, ${innerErr}`,
          status: innerErr.status,
        })
        throw error
      }
    }
  } catch (err) {
    const error = new CustomError({
      title: err.title || `deleteCouncil exception, ${err.message}`,
      detail: err.detail || `deleteCouncil exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function deleteCouncilYear (year) {
  try {
    const councils = await Councils.find({ year })

    for (const council of councils) {
      await deleteCouncil(council)
    }
  } catch (err) {
    const error = new CustomError({
      title: err.title || `deleteCouncilYear exception, ${err.message}`,
      detail: err.detail || `deleteCouncilYear exception, ${err}`,
      status: err.status || 500,
    })
    throw error
  }
}

// --------------------
async function getAvailableCallCouncils () {
  try {
    const availableCouncilCalls = await Councils.find({ date: { $gt: dayjs().tz('Europe/Paris').startOf('day').toISOString() } }).lean()
    return availableCouncilCalls
  } catch (err) {
    const error = new CustomError({
      title: `getAvailableCallCouncils exception, ${err.message}`,
      detail: `getAvailableCallCouncils exception, ${err}`,
      status: 500,
    })
    throw error
  }
}

export default {
  createCouncilWithFiles,
  createCouncilRegular,
  sendCouncilCallEmail,
  createCouncilDocs,
  deleteCouncilDoc,
  createCouncilCall,
  deleteCouncilFileResource,
  updateCouncilFileResource,
  updateCouncil,
  deleteCouncil,
  deleteCouncilYear,
  getAvailableCallCouncils,
}
