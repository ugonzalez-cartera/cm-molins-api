'use strict'

import investeesService from './investees.service.js'

import mongoose from 'mongoose'

import { CustomError } from '../../../utils.js'

import { uploadFile, deleteFile } from '../../../services/utils.service.js'

const Investees = mongoose.model('Investee')
const ChangeLogs = mongoose.model('ChangeLog')

const currentEnv = process.env.NODE_ENV

// --------------------
async function getInvestees (req, reply) {
  try {
    const { page, type, limit, sort, term } = req.query

    const { docs, docCount } = await investeesService.getInvestees({ page, type, limit, sort, term })
    return { docs, docCount }
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function fetchInvesteeById (req, reply) {
  try {
    const { investeeId } = req.params

    const investee = await investeesService.getInvesteeById(investeeId)
    return investee
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function createInvestee (req, reply) {
  const { id: userId } = req.user

  try {
    const file = await req.file()
    const { investeeData, investeeFile } = file.fields
    if (!investeeData || !investeeFile) {
      const error = new CustomError({
        title: '!! Missing investee data or file',
        detail: 'Required elements missing',
        status: 400,
      })
      error.print()
      return reply.status(error.status).send(error.toJSON())
    }

    const investee = await investeesService.createInvestee(investeeData, investeeFile, userId)
    return investee

  } catch (err) {
    err.print()
    err.instance = req.url
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function updateInvesteeImage (req, reply) {
  const { id: userId } = req.user
  const { investeeId } = req.params

  try {
    const file = await req?.file()
    const investee = await investeesService.updateInvesteeImage(investeeId, userId, file)
    return investee
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

async function updateInvestee (req, reply) {
  const {  id: userId } = req.user
  const { investeeId } = req.params
  const {  name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description } = req.body || {}

  try {
    const investee = await investeesService.updateInvestee(
      investeeId,
      userId,
      { name, type, investedAt, disinvestedAt, websiteUrl, headquarters, description },
    )
    return investee
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

// --------------------
async function deleteInvestee (req, reply) {
  try {
    const { investeeId } = req.params
    await investeesService.deleteInvestee(investeeId)

    return { msg: 'Ok' }
  } catch (err) {
    err.instance = req.url
    err.print()
    return reply.status(err.status).send(err.toJSON())
  }
}

export default {
  getInvestees,
  fetchInvesteeById,
  createInvestee,
  updateInvestee,
  updateInvesteeImage,
  deleteInvestee,
}
