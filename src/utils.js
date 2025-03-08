'use strict'

import dayjs from 'dayjs'
import 'dayjs/locale/es.js'

// --------------------
/**
 * Parses a date and returns the month and year.
 * @param {string|Date} date - The date to parse.
 * @returns {{month: string, year: string}} The parsed month and year.
 */
export function getParsedDate(date) {
  const month = dayjs(date).locale('es').format('MMMM').toUpperCase()
  const year = dayjs(date).format('YYYY')
  return { month, year }
}

// --------------------
// This custom Error class is used to handle errors in the API.
// https://www.rfc-editor.org/rfc/rfc7807

/**
 * Custom error class for API errors.
 */
export class CustomError extends Error {
  /**
   * Creates a new CustomError.
   * @param {Object} params - The error parameters.
   * @param {string} params.title - The error title.
   * @param {string} params.detail - The error detail.
   * @param {number} params.status - The HTTP status code.
   * @param {string} [params.type] - The error type.
   * @param {string} [params.instance] - The error instance.
   */
  constructor({ title, detail, status, type = 'about:blank', instance = '', code = '' }) {
    super(title)
    this.name = this.constructor.name
    this.title = title
    this.detail = detail
    this.status = status
    this.type = type
    this.instance = instance
    this.code = code
  }

  /**
   * Converts the error to a JSON object.
   * @returns {Object} The JSON representation of the error.
   */
  toJSON() {
    return {
      name: this.name,
      title: this.title,
      detail: this.detail,
      status: this.status,
      type: this.type || 'about:blank',
      instance: this.instance,
      code: this.code,
    }
  }

  /**
   * Prints the error to the console.
   */
  print() {
    console.error(
      `\n =================== \n` +
      `${JSON.stringify(this.toJSON(), null, 2)}` +
      `\n =================== \n`
    )
  }
}
