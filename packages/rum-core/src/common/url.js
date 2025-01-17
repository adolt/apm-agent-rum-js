/**
 * MIT License
 *
 * Copyright (c) 2017-present, Elasticsearch BV
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

/**
 * Bare miniaml URL parser that is not compatible with URL Api
 * in the browser
 *
 * Does not support
 * - URLSearchParams
 * - Unicode chars, Punycode
 *
 * {
 *    hash: '',
 *    host: '',
 *    origin: '',
 *    path: ''
 *    protocol: '',
 *    query: '',
 * }
 *
 * Based on code from url-parser!
 * https://github.com/unshiftio/url-parse/blob/master/index.js
 *
 */

/**
 * Order of the RULES are very important
 *
 * RULE[0] -> for checking the index of the character on the URL
 * RULE[1] -> key to store the associated value present after the RULE[0]
 * RULE[2] -> Extract from the front till the last index
 * RULE[3] -> Left over values of the URL
 */
const RULES = [
  ['#', 'hash'],
  ['?', 'query'],
  ['/', 'path'],
  ['@', 'auth', 1],
  [NaN, 'host', undefined, 1] //
]
const PROTOCOL_REGEX = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\S\s]*)/i

class Url {
  constructor(url) {
    let { protocol, address, slashes } = this.extractProtocol(url || '')
    const relative = !protocol && !slashes
    const location = this.getLocation()
    const instructions = RULES.slice()
    // Sanitize what is left of the address
    address = address.replace('\\', '/')

    /**
     * When the authority component is absent the URL starts with a path component.
     * By setting it as NaN, we set the remaining parsed address to path
     */
    if (!slashes) {
      instructions[2] = [NaN, 'path']
    }

    let index
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i]
      const parse = instruction[0]
      const key = instruction[1]

      if (typeof parse === 'string') {
        index = address.indexOf(parse)
        if (~index) {
          const instLength = instruction[2]
          if (instLength) {
            /**
             * we need to figure out the explicit index where the auth portion
             * in the host ends before parsing the rest of the URL as host.
             *
             * ex: http://a@b@c.com/d
             * auth -> a@b
             * host -> c.com
             */
            let newIndex = address.lastIndexOf(parse)
            index = Math.max(index, newIndex)
            this[key] = address.slice(0, index)
            address = address.slice(index + instLength)
          } else {
            this[key] = address.slice(index)
            address = address.slice(0, index)
          }
        }
      } else {
        /** NaN condition */
        this[key] = address
        address = ''
      }
      /**
       * Default values for all keys from location if url is relative
       */
      this[key] =
        this[key] || (relative && instruction[3] ? location[key] || '' : '')
      /**
       * host should be lowercased so they can be used to
       * create a proper `origin`.
       */
      if (instruction[3]) this[key] = this[key].toLowerCase()
    }

    /**
     * if the URL is relative, prepend the path with `/`
     * to construct the href correctly
     */
    if (relative && this.path.charAt(0) !== '/') {
      this.path = '/' + this.path
    }

    this.relative = relative

    this.protocol = protocol || location.protocol

    this.origin =
      this.protocol && this.host && this.protocol !== 'file:'
        ? this.protocol + '//' + this.host
        : 'null'

    this.href = this.toString()
  }

  toString() {
    let result = this.protocol
    result += '//'
    if (this.auth) {
      const REDACTED = '[REDACTED]'
      const userpass = this.auth.split(':')
      const username = userpass[0] ? REDACTED : ''
      const password = userpass[1] ? ':' + REDACTED : ''
      result += username + password + '@'
    }
    result += this.host
    result += this.path
    result += this.query
    result += this.hash
    return result
  }

  getLocation() {
    var globalVar = {}
    if (typeof window !== 'undefined') {
      globalVar = window
    }

    return globalVar.location
  }

  extractProtocol(url) {
    const match = PROTOCOL_REGEX.exec(url)
    return {
      protocol: match[1] ? match[1].toLowerCase() : '',
      slashes: !!match[2],
      address: match[3]
    }
  }
}

export default Url
