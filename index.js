'use strict'

const http = require('http')
const isFunction = require('101/is-function')
const isNumber = require('101/is-number')
const isObject = require('101/is-object')
const isString = require('101/is-string')
const isRegExp = require('101/is-regexp')
const keypather = require('keypather')()
const noop = require('101/noop')
const sinon = require('sinon')
const debug = require('debug')
const debugInit = debug('mehpi:init')
const debugInitError = debug('mehpi:init:error')
const debugSetup = debug('mehpi:setup')
const debugSetupError = debug('mehpi:setup:error')
const debugRespone = debug('mehpi:response')
const debugResponeError = debug('mehpi:response:error')

const PRIORITY_LIMIT = 100
const PRIORITY_DEFAULT = 10

/**
 * Mock API server. Allows one to mock any api and setup stubs for particlar
 * routes (via sinon).
 * @author Ryan Sandor Richards
 */
module.exports = class MockAPI {
  /**
   * Creates a new mock api server.
   * @param {Integer} port The port for the api server.
   */
  constructor (port) {
    this.port = port
    this.restore()
    this.server = http.createServer(this._handler.bind(this))
    this.routeStubs = {
      'text': {},
      'regex': []
    }
    // Have the mock always return a 200 on index
    this.setStub('GET', '/')
  }

  /**
   * Starts the mock api server.
   * @param {function} done Callback to execute once the server is listening.
   */
  start (done) {
    if (!isFunction(done)) {
      done = noop
    }
    this.server.listen(this.port, (err) => {
      if (err) {
        debugInitError(`Failed to start server (port: ${this.port}) / ${err.message}`)
        done(err)
        return
      }
      debugInit(`Server listening (port: ${this.port})`)
      done()
    })
  }

  /**
   * Stops the mock api server.
   * @param {function} done Callback to execute once the server is stopped.
   */
  stop (done) {
    if (!isFunction(done)) {
      done = noop
    }
    this.server.close((err) => {
      debugInit(`Server stopped (port: ${this.port})`)
      done(err)
    })
  }

  /**
   * Handles incoming requests to the mock server. This will call stub methods
   * appropriately.
   */
  _handler (request, response) {
    const method = request.method
    const path = request.url
    const routeStub = this.getStub(method, path)
    if (!routeStub) {
      return this.stubNotFound(response)
    }
    const result = routeStub(request, response)

    debugRespone(`Request: ${method} ${path}`)

    let status = 200
    let body = 'response'
    let contentType = 'text/plain'

    if (isNumber(result)) {
      status = result
    } else if (isString(result)) {
      body = result
    } else if (isObject(result)) {
      if (isNumber(result.status)) {
        status = result.status
      }
      if (isObject(result.body) || Array.isArray(result.body)) {
        contentType = 'application/json'
        body = JSON.stringify(result.body)
      } else if (result.body) {
        body = result.body.toString()
      }
    }

    debugRespone(`Response: ${status} ${body} (${contentType})`)

    response.writeHead(status, { 'Content-Type': contentType })
    response.end(body)
  }

  getStub (method, path) {
    if (!path) {
      path = method
      method = 'GET'
    }
    method = method.toUpperCase()

    const key = `${method} ${path}`
    let textStub = keypather.get(this.routeStubs.text, key)
    if (textStub) {
      debugRespone(`Found string match: ${method} ${path}`)
      return textStub
    }
    // Check all regular expressions
    for (var i = PRIORITY_LIMIT; i >= 0; i -= 1) {
      if (Array.isArray(this.routeStubs.regex[i])) {
        for (let entry of this.routeStubs.regex[i]) {
          if (path.match(entry.regex)) {
            debugRespone(`Found regular expression: ${method} ${path} ${entry.regex}`)
            return entry.stub
          }
        }
      }
    }
    return null
  }

  /**
   * Returns the stub method for a route on the server.
   * @param {string} [method] HTTP Method for the request stub (ex: PUT, POST).
   * @param {string} path Path to stub (ex: /users/me)
   */
  setStub (method, path, priority) {
    if (!path) {
      path = method
      method = 'GET'
    }
    method = method.toUpperCase()

    if (isString(path)) {
      const key = `${method} ${path}`
      let textStub = keypather.get(this.routeStubs, `text.${method}.${path}`)
      if (!textStub) {
        this.routeStubs.text[key] = sinon.stub()
        // throw new Error('Stub already declared')
      }
      debugSetup(`String stub added: ${path}`)
      return this.routeStubs.text[key]
    }
    if (isRegExp(path)) {
      if (priority > PRIORITY_LIMIT) {
        throw new Error(`'priority' must be under ${PRIORITY_LIMIT}`)
      }
      if (priority === undefined) {
        priority = PRIORITY_DEFAULT
      }
      if (!isNumber(priority)) {
        throw new Error('\'priority\' is not a number')
      }
      let newStub = sinon.stub()
      if (!this.routeStubs.regex[priority]) {
        this.routeStubs.regex[priority] = []
      }
      // Replace same regex if found
      let regexKeys = this.routeStubs.regex[priority].map(x => x.regex.toString())
      if (regexKeys.indexOf(path.toString()) !== -1) {
        let i = regexKeys.indexOf(path.toString())
        this.routeStubs.regex[priority][i] = {
          regex: path,
          stub: newStub
        }
        debugSetup(`Regex stub replaced: ${path}`)
        return newStub
      }
      this.routeStubs.regex[priority].push({
        regex: path,
        stub: newStub
      })
      debugSetup(`Regex stub added: ${path}`)
      return newStub
    }
    debugSetupError('Only strings and regexs allowed')
    throw new Error('Only regular expressions and strings allowed')
  }

  stub () {
    return this.setStub.apply(this, arguments)
  }

  stubNotFound (response) {
    let status = 500
    let body = 'The requested route has not been declared.'
    let contentType = 'text/plain'
    debugResponeError('No Stub Found')
    response.writeHead(status, { 'Content-Type': contentType })
    response.end(body)
  }

  /**
   * Restores all stubbed routes on the mock api server.
   */
  restore () {
    this.routeStubs = {
      'text': {},
      'regex': []
    }
  }
}
