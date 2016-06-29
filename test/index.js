'use strict'

const assert = require('chai').assert
const MockAPI = require('../index')
const Promise = require('bluebird')
const request = Promise.promisifyAll(require('request'))
const sinon = require('sinon')

const PORT = 13571

describe('MockAPI', () => {
  const api = Promise.promisifyAll(new MockAPI(PORT))

  describe('start/stop', () => {
    it('should start a mock HTTP server', () => {
      return api.startAsync()
        .then(() => request.getAsync(`http://localhost:${PORT}`))
        .then((response) => assert.equal(response.statusCode, 200))
        .then(() => api.stopAsync())
    })
  }) // end 'start'

  describe('stub', () => {
    before(() => api.startAsync())
    after(() => api.stopAsync())
    afterEach(() => api.restore())

    it('should stub basic routes', () => {
      api.stub('GET', '/bent');
      return request.getAsync(`http://localhost:${PORT}/bent`)
        .then(() => sinon.assert.calledOnce(api.stub('GET', '/bent')))
    })

    it('should correctly stub status code', () => {
      api.stub('PUT', '/sf').returns(420)
      return request.putAsync(`http://localhost:${PORT}/sf`)
        .then((response) => assert.equal(response.statusCode, 420))
    })

    it('should stub GET by default', () => {
      api.stub('/shorty').returns(302)
      return request.getAsync(`http://localhost:${PORT}/shorty`)
        .then((response) => assert.equal(response.statusCode, 302))
    })

    it('should correctly stub request body', () => {
      api.stub('POST', '/sign').returns('SIGN POST')
      return request.postAsync(`http://localhost:${PORT}/sign`)
        .then((response) => assert.equal(response.body, 'SIGN POST'))
    })

    it('should correctly stub both status and body', () => {
      const stubResponse = {
        status: 500,
        body: 'REPEAT DELETE'
      }
      api.stub('GET', '/repeat').returns(stubResponse)
      return request.getAsync(`http://localhost:${PORT}/repeat`)
        .then((response) => {
          assert.equal(response.statusCode, stubResponse.status)
          assert.equal(response.body, stubResponse.body)
        })
    })

    it('should stub both status and JSON responses', () => {
      const stubResponse = {
        status: 502,
        body: {
          pity: 'thefool',
          players: ['haters', 'haters', 'haters']
        }
      }
      api.stub('GET', '/playerhaters').returns(stubResponse)
      return request.getAsync(`http://localhost:${PORT}/playerhaters`)
        .then((response) => {
          assert.equal(response.statusCode, stubResponse.status)
          assert.deepEqual(JSON.parse(response.body), stubResponse.body)
        })
    })
  }) // end 'stub'

  describe('restore', () => {
    before(() => api.startAsync())
    after(() => api.stopAsync())
    afterEach(() => api.restore())

    it('should restore all stubbed routes', () => {
      api.stub('GET', '/stuff').returns(404) // (stuff not found)
      api.stub('PUT', '/things').returns(500) // (internal things error)
      api.restore()
      return request.getAsync(`http://localhost:${PORT}/stuff`)
        .then((response) => assert.equal(response.statusCode, 200))
        .then(() => request.putAsync(`http://localhost:${PORT}/things`))
        .then((response) => assert.equal(response.statusCode, 200))
    })
  }) // end 'restore'
}) // end 'MockAPI'
