'use strict'

import config from './config.js'

import mongoose from 'mongoose'

const ChangeLogs = mongoose.model('ChangeLog')

class ChangeLogManager {
  async createChangeLog (oldObj, newObj, changeLogData) {
    if(!oldObj || !newObj) return

    const {  prefix, updatedBy, maxLogItems, excludedKeys } = changeLogData

    const changes = this.#getChangeLogChanges(oldObj, newObj)

    for (const change of changes) {
      const data = {
        key: change.key,
        old: change.old,
        new: change.new,
        updatedBy,
        updatedAt: new Date(),
      }

      if (excludedKeys.includes(data.key)) continue

      await ChangeLogs.updateOne(
        { _id: `${prefix}${oldObj._id}` },
        {
          $push: {
            changes: {
              $each: [data],
              $slice: -maxLogItems
            }
          }
        },
        { upsert: true }
      )
    }
  }

  #getChangeLogChanges (oldObj, newObj, parentKey = '') {
    const changes = []

    for (const key in newObj) {
      const newKey = parentKey ? `${parentKey}.${key}` : key
      if (typeof newObj[key] === 'object' && newObj[key] !== null && !Array.isArray(newObj[key])) {
        changes.push(...this.#getChangeLogChanges(oldObj[key] || {}, newObj[key], newKey))
      } else if (!this.#isDeepEqual(newObj[key], oldObj[key])) {
        changes.push({
          key: newKey,
          old: oldObj[key],
          new: newObj[key]
        })
      }
    }

    return changes
  }

  #isDeepEqual(obj1, obj2) {
    if (obj1 === obj2) return true

    if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
      return false
    }

    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key) || !this.#isDeepEqual(obj1[key], obj2[key])) {
        return false
      }
    }

    return true
  }
}

const changeLogManager = new ChangeLogManager()

const documentFunctions = [
  'save',
]

const queryFunctions = [
  'findOneAndUpdate',
  'updateMany',
  'updateOne',
]

const defaultOptions = {
  maxLogItems: config.changeLogs.maxLogItems,
  defaultUpdatedBy: config.changeLogs.prefixes.default,
  prefixes: config.changeLogs.prefixes,
  excludedKeys: ['updatedBy'],
}

// --------------------
export function changeLogPlugin (schema, options = defaultOptions) {
  const { maxLogItems, defaultUpdatedBy, prefixes, excludedKeys } = options

  schema.pre(documentFunctions, async function (next, options) {
    const { updatedBy = defaultUpdatedBy } = options || {}

    try {
      this._original = await this.constructor.findById(this._id).lean()

      this.$locals.changeLogData = {
        collectionName: this.collection.name,
        originalObj: this._original,
        updatedBy,
      }

      next()
    } catch (err) {
      console.error(err)
    }
  })

  schema.pre(queryFunctions, async function (next) {
    const { updatedBy = defaultUpdatedBy } = this.options || {}

    try {
      this._original = await this.model.findOne(this.getQuery()).lean()

      this.$locals = {
        changeLogData: {
          collectionName: this.model.collection.name,
          originalObj: this._original,
          updatedBy,
        }
      }
    } catch (err) {
      console.error(err)
    }

    next()
  })

  schema.post(documentFunctions, async function (doc) {
    const { changeLogData } = this.$locals

    if (!changeLogData) return

    const { collectionName, originalObj, updatedBy } = changeLogData
    const prefix = prefixes[collectionName]

    try {
      const updatedObj = await this.constructor.findById(this._id).lean()

      await changeLogManager.createChangeLog(originalObj, updatedObj, { prefix, updatedBy, maxLogItems, excludedKeys })
    } catch (err) {
      console.error(' !! Could not create changelog.', err)
    }
  })

  schema.post(queryFunctions, async function (doc) {
    const { changeLogData } = this.$locals

    if (!changeLogData) return

    const { collectionName, originalObj, updatedBy } = changeLogData
    const prefix = prefixes[collectionName]

    try {
      const updatedObj = await this.model.findOne(this.getQuery()).lean()

      await changeLogManager.createChangeLog(originalObj, updatedObj, { prefix, updatedBy, maxLogItems, excludedKeys })
    } catch (err) {
      console.error(' !! Could not create changelog.', err)
    }
  })
}
