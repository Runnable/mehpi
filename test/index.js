'use strict'

const assert = require('chai').assert
const MockAPI = require('../index')
const Promise = require('bluebird')
const request = Promise.promisifyAll(require('request'))
const sinon = require('sinon')

const PORT = 13571

describe('MockAPI', () => {
  const api = Promise.promisifyAll(new MockAPI(PORT))

  describe('start', () => {
    it('should start a mock HTTP server', () => {
      return api.startAsync()
        .then(() => request.getAsync(`http://localhost:${PORT}`))
        .then((response) => assert.equal(response.statusCode, 200))
        .then(() => api.stopAsync())
    })

    it('should accept an empty callback', () => {
      sinon.stub(api.server, 'listen')
      api.start()
      sinon.assert.calledOnce(api.server.listen)
      api.server.listen.restore()
    })

    it('should fail on error when starting the server', (done) => {
      const listenError = new Error('woah there...')
      sinon.stub(api.server, 'listen').yieldsAsync(listenError)
      api.start((err) => {
        assert.equal(err, listenError)
        api.server.listen.restore()
        done()
      })
    })
  }) // end 'start'

  describe('stub', () => {
    before(() => api.startAsync())
    after(() => api.stopAsync())
    afterEach(() => api.restore())

    it('should stub basic routes', () => {
      api.stub('GET', '/bent')
      return request.getAsync(`http://localhost:${PORT}/bent`)
        .then(() => sinon.assert.calledOnce(api.getStub('GET', '/bent')))
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

    describe('Regular Expressions', () => {

      const status = 200
      let body
      beforeEach(() => {
        body = { hello: 'world' }
      })

      describe('Basic', () => {
        beforeEach(() => {
          const stubResponse = {
            status: 200,
            body: body
          }
          api.stub('GET', /[A-z]+/i).returns(stubResponse)
        })

        it('should return the right response if it matches the regular expression', () => {
          return request.getAsync(`http://localhost:${PORT}/aaaa`)
            .then((response) => {
              assert.equal(response.statusCode, status)
              assert.deepEqual(JSON.parse(response.body), body)
            })
        })

        it('should return not return any response if not matches are found', () => {
          return request.getAsync(`http://localhost:${PORT}/111`)
            .then((response) => {
              assert.equal(response.statusCode, 500)
            })
        })
      })

      describe('Priorities', () => {
        const status1 = status
        const status2 = 404
        let stubResponse1
        let stubResponse2

        beforeEach(() => {
          stubResponse1 = {
            status: status1
          }
          stubResponse2 = {
            status: status2
          }
        })

        it('should respect a higher priority', () => {
          api.stub('GET', /[0-9]+/i, 0).returns(stubResponse1)
          api.stub('GET', /[A-z]+/i, 1).returns(stubResponse2)
          return request.getAsync(`http://localhost:${PORT}/aa11`)
            .then((response) => {
              assert.equal(response.statusCode, status2)
            })
        })

        it('should respect order of declration if priority is the same', () => {
          api.stub('GET', /[0-9]+/i, 1).returns(stubResponse1)
          api.stub('GET', /[A-z]+/i, 1).returns(stubResponse2)
          return request.getAsync(`http://localhost:${PORT}/aa11`)
            .then((response) => {
              assert.equal(response.statusCode, status1)
            })
        })
      })
    })

    describe('Overwriting Stub', function () {
      it('should overwrite a string stub if redefined', () => {
        api.stub('GET', '/bent').returns({
          status: 200,
          body: 'hello'
        })
        api.stub('GET', '/bent').returns({
          status: 200,
          body: 'goodbye'
        })
        return request.getAsync(`http://localhost:${PORT}/bent`)
        .then(res => {
          assert.equal(res.body, 'goodbye')
        })
      })
      it('should not overwrite a regex stub if redefined', () => {
        api.stub('GET', /bent/).returns({
          status: 200,
          body: 'hello'
        })
        api.stub('GET', /bent/).returns({
          status: 200,
          body: 'goodbye'
        })
        return request.getAsync(`http://localhost:${PORT}/bent`)
        .then(res => {
          assert.equal(res.body, 'goodbye')
        })
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
        .then((response) => assert.equal(response.statusCode, 500))
        .then(() => request.putAsync(`http://localhost:${PORT}/things`))
        .then((response) => assert.equal(response.statusCode, 500))
    })
  }) // end 'restore'
}) // end 'MockAPI'
