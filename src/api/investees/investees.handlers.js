'use strict'

import investeesService from './investees.service.js'

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
