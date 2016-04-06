# mehpi
Simple External API Mocking via Sinon

## Motivation
So why another testing utility library for mocking HTTP servers? Because:

1. We love [sinon](https://npmjs.com/package/sinon)
2. We wanted to love functional tests, but [nock](https://npmjs.com/package/nock) was unideal
3. We thought, "Hey wouldn't it be cool if we could mock apis with sinon?"

## Example
```js
const MockAPI = require('mehpi')
const request = require('request')
const sinon = require('sinon')

describe('functional tests', () => {
  // Create a new mock api for github (localhost:5678)
  const github = new MockAPI('5678')

  // Start the API before all tests, stop it when we're done
  before(github.start)
  after(github.stop)

  // Setup some route stubs for the API
  beforeEach(() => {
    github.stub('GET /users/:username').returns(200)
    github.stub('GET /repos/:owner/:repo/comments').returns({
      status: 500,
      body: 'Internal Server Error'
    })
    github.stub('POST /gists')
      .onFirstCall().returns(500)
      .onSecondCall().returns(200)
  })

  // Restore all route stubs after each test
  afterEach(() => {
    github.restore()
  })

  // Write a test!
  it('should call github', (done) => {
    const getUsers = github.stub('GET /users/:username')
    request.get('http://localhost:5678/users/rsandor', function () {
      sinon.assert.calledOnce(getUsers)
      done()
    })
  })
})
```

## API Reference

### `new MockAPI(port)`
Creates a new `MockAPI` instance that runs locally on the given port.

### `.start(done)`
Starts the server, then calls the `done` callback.

### `.stop([done])`
Stops the server. If defined, calls the `done` callback.

### `.stub(route, [handler])`
Creates and returns the sinon stub for the given `route` string. Optionally one
can define a custom handler for that route via the `handler` argument.

### `.restore([route])`
When called with no arguments, this restores all route stubs on the mocked server.
When called with a `route` string, this restores only the specified route stub.

## License
MIT
