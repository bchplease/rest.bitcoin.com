/*
  TESTS FOR THE SLP.TS LIBRARY

  This test file uses the environment variable TEST to switch between unit
  and integration tests. By default, TEST is set to 'unit'. Set this variable
  to 'integration' to run the tests against BCH mainnet.

  TODO:
  -See listSingleToken() tests.
*/

"use strict"

const chai = require("chai")
const assert = chai.assert
const nock = require("nock") // HTTP mocking
const sinon = require("sinon")

// Prepare the slpRoute for stubbing dependcies on slpjs.
const slpRoute = require("../../dist/routes/v2/slp")

let originalEnvVars // Used during transition from integration to unit tests.

// Mocking data.
const { mockReq, mockRes } = require("./mocks/express-mocks")
const mockData = require("./mocks/slp-mocks")

// Used for debugging.
const util = require("util")
util.inspect.defaultOptions = { depth: 1 }

describe("#SLP", () => {
  let req, res, mockServerUrl
  let sandbox

  before(() => {
    // Save existing environment variables.
    originalEnvVars = {
      BITDB_URL: process.env.BITDB_URL
    }

    // Set default environment variables for unit tests.
    if (!process.env.TEST) process.env.TEST = "unit"
    if (process.env.TEST === "unit") {
      process.env.BITDB_URL = "http://fakeurl/"
      mockServerUrl = `http://fakeurl`
    }
  })

  // Setup the mocks before each test.
  beforeEach(() => {
    // Mock the req and res objects used by Express routes.
    req = mockReq
    res = mockRes

    // Explicitly reset the parmas and body.
    //req.params = {}
    req.body = {}
    req.query = {}

    // Activate nock if it's inactive.
    if (!nock.isActive()) nock.activate()

    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    // Clean up HTTP mocks.
    nock.cleanAll() // clear interceptor list.
    nock.restore()

    sandbox.restore()
  })

  after(() => {
    // Restore any pre-existing environment variables.
    process.env.BITDB_URL = originalEnvVars.BITDB_URL
  })

  describe("#root", async () => {
    // root route handler.
    const root = slpRoute.testableComponents.root

    it("should respond to GET for base route", async () => {
      const result = root(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.equal(result.status, "slp", "Returns static string")
    })
  })

  describe("list()", () => {
    // list route handler
    const list = slpRoute.testableComponents.list

    it("should throw 500 when network issues", async () => {
      // Save the existing BITDB_URL.
      const savedUrl2 = process.env.BITDB_URL

      // Manipulate the URL to cause a 500 network error.
      process.env.BITDB_URL = "http://fakeurl/api/"

      const result = await list(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      // Restore the saved URL.
      process.env.BITDB_URL = savedUrl2

      assert.isAbove(
        res.statusCode,
        499,
        "HTTP status code 500 or greater expected."
      )
      //assert.include(result.error,"Network error: Could not communicate with full node","Error message expected")
    })

    it("should GET list", async () => {
      // Mock the RPC call for unit tests.
      if (process.env.TEST === "unit") {
        const b64 = `eyJ2IjozLCJxIjp7ImZpbmQiOnsib3V0LmgxIjoiNTM0YzUwMDAiLCJvdXQuczMiOiJHRU5FU0lTIn0sImxpbWl0IjoxMDAwfSwiciI6eyJmIjoiWyAuW10gfCB7IGlkOiAudHguaCwgdGltZXN0YW1wOiAoLmJsay50IHwgc3RyZnRpbWUoXCIlWS0lbS0lZCAlSDolTVwiKSksIHN5bWJvbDogLm91dFswXS5zNCwgbmFtZTogLm91dFswXS5zNSwgZG9jdW1lbnQ6IC5vdXRbMF0uczYgfSBdIn19`

        nock(process.env.BITDB_URL)
          .get(uri => uri.includes("/"))
          .reply(200, mockData.mockList)
      }

      const result = await list(req, res)
      //console.log(`test result: ${util.inspect(result)}`)

      assert.isArray(result)
      assert.hasAnyKeys(result[0], [
        "id",
        "timestamp",
        "symbol",
        "name",
        "documentUri",
        "documentHash",
        "decimals",
        "initialTokenQty"
      ])
    })
  })

  describe("listSingleToken()", () => {
    const listSingleToken = slpRoute.testableComponents.listSingleToken

    it("should throw 400 if tokenId is empty", async () => {
      const result = await listSingleToken(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "tokenId can not be empty")
    })

    it("should throw 503 when network issues", async () => {
      // Save the existing BITDB_URL.
      const savedUrl2 = process.env.BITDB_URL

      // Manipulate the URL to cause a 500 network error.
      process.env.BITDB_URL = "http://fakeurl/api/"

      req.params.tokenId =
        "650dea14c77f4d749608e36e375450c9ac91deb8b1b53e50cb0de2059a52d19a"

      const result = await listSingleToken(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      // Restore the saved URL.
      process.env.BITDB_URL = savedUrl2

      assert.isAbove(
        res.statusCode,
        499,
        "HTTP status code 500 or greater expected."
      )
      //assert.include(result.error,"Network error: Could not communicate with full node","Error message expected")
    })

    it("should return 'not found' for mainnet txid on testnet", async () => {
      // Mock the RPC call for unit tests.
      if (process.env.TEST === "unit") {
        nock(mockServerUrl)
          .get(uri => uri.includes("/"))
          .reply(200, mockData.mockSingleToken)
      }

      req.params.tokenId =
        // testnet
        //"650dea14c77f4d749608e36e375450c9ac91deb8b1b53e50cb0de2059a52d19a"
        // mainnet
        "259908ae44f46ef585edef4bcc1e50dc06e4c391ac4be929fae27235b8158cf1"

      const result = await listSingleToken(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["id"])
      assert.include(result.id, "not found")
    })

    it("should get token information", async () => {
      // Mock the RPC call for unit tests.
      if (process.env.TEST === "unit") {
        nock(mockServerUrl)
          .get(uri => uri.includes("/"))
          .reply(200, mockData.mockSingleToken)
      }

      req.params.tokenId =
        // testnet
        "650dea14c77f4d749608e36e375450c9ac91deb8b1b53e50cb0de2059a52d19a"

      const result = await listSingleToken(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, [
        "id",
        "timestamp",
        "symbol",
        "name",
        "documentUri",
        "documentHash",
        "decimals",
        "initialTokenQty"
      ])
    })
  })

  describe("balancesForAddress()", () => {
    const balancesForAddress = slpRoute.testableComponents.balancesForAddress

    it("should throw 400 if address is empty", async () => {
      const result = await balancesForAddress(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "address can not be empty")
    })

    it("should throw 400 if address is invalid", async () => {
      req.params.address = "badAddress"

      const result = await balancesForAddress(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "Invalid BCH address.")
    })

    it("should throw 400 if address network mismatch", async () => {
      req.params.address =
        "simpleledger:qr5agtachyxvrwxu76vzszan5pnvuzy8duhv4lxrsk"

      const result = await balancesForAddress(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "Invalid")
    })

    // I don't think balancesForAddress() works yet, as it comes from slp-sdk?
    /*
    it("should throw 5XX error when network issues", async () => {
      // Save the existing BITDB_URL.
      const savedUrl2 = process.env.BITDB_URL

      // Manipulate the URL to cause a 500 network error.
      process.env.BITDB_URL = "http://fakeurl/api/"

      req.params.address = "slptest:qz35h5mfa8w2pqma2jq06lp7dnv5fxkp2shlcycvd5"

      const result = await balancesForAddress(req, res)
      console.log(`result: ${util.inspect(result)}`)

      // Restore the saved URL.
      process.env.BITDB_URL = savedUrl2

      assert.isAbove(res.statusCode, 499, "HTTP status code 500 or greater expected.")
      assert.include(
        result.error,
        "Network error: Could not communicate",
        "Error message expected"
      )
    })
*/
  })

  describe("balancesForAddressByTokenID()", () => {
    const balancesForAddressByTokenID =
      slpRoute.testableComponents.balancesForAddressByTokenID

    it("should throw 400 if address is empty", async () => {
      req.params.address = ""
      req.params.tokenId =
        "650dea14c77f4d749608e36e375450c9ac91deb8b1b53e50cb0de2059a52d19a"
      const result = await balancesForAddressByTokenID(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "address can not be empty")
    })

    it("should throw 400 if tokenId is empty", async () => {
      req.params.address =
        "simpleledger:qr5agtachyxvrwxu76vzszan5pnvuzy8duhv4lxrsk"
      req.params.tokenId = ""
      const result = await balancesForAddressByTokenID(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "tokenId can not be empty")
    })

    it("should throw 400 if address is invalid", async () => {
      req.params.address = "badAddress"
      req.params.tokenId =
        "650dea14c77f4d749608e36e375450c9ac91deb8b1b53e50cb0de2059a52d19a"

      const result = await balancesForAddressByTokenID(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "Invalid BCH address.")
    })

    it("should throw 400 if address network mismatch", async () => {
      req.params.address =
        "simpleledger:qr5agtachyxvrwxu76vzszan5pnvuzy8duhv4lxrsk"

      const result = await balancesForAddressByTokenID(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "Invalid")
    })
    //
    // it("should throw 503 when network issues", async () => {
    //   // Save the existing BITDB_URL.
    //   const savedUrl2 = process.env.BITDB_URL
    //
    //   // Manipulate the URL to cause a 500 network error.
    //   process.env.BITDB_URL = "http://fakeurl/api/"
    //
    //   req.params.address = "slptest:qz35h5mfa8w2pqma2jq06lp7dnv5fxkp2shlcycvd5"
    //
    //   const result = await balancesForAddress(req, res)
    //   console.log(`result: ${util.inspect(result)}`)
    //
    //   // Restore the saved URL.
    //   process.env.BITDB_URL = savedUrl2
    //
    //   assert.equal(res.statusCode, 503, "HTTP status code 503 expected.")
    //   assert.include(
    //     result.error,
    //     "Network error: Could not communicate with full node",
    //     "Error message expected"
    //   )
    // })
  })

  describe("convertAddress()", () => {
    const convertAddress = slpRoute.testableComponents.convertAddress

    it("should throw 400 if address is empty", async () => {
      req.params.address = ""
      const result = await convertAddress(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "address can not be empty")
    })
    //
    it("should convert address", async () => {
      // Mock the RPC call for unit tests.
      if (process.env.TEST === "unit") {
        nock(`${process.env.BITDB_URL}`)
          .post(``)
          .reply(200, { result: mockData.mockConvert })
      }

      req.params.address = "slptest:qz35h5mfa8w2pqma2jq06lp7dnv5fxkp2shlcycvd5"

      const result = await convertAddress(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["cashAddress", "legacyAddress", "slpAddress"])
    })
  })

  describe("validateBulk()", () => {
    const validateBulk = slpRoute.testableComponents.validateBulk

    it("should throw 400 if txid array is empty", async () => {
      const result = await validateBulk(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "txids needs to be an array")
      assert.equal(res.statusCode, 400)
    })

    it("should throw 400 error if array is too large", async () => {
      const testArray = []
      for (var i = 0; i < 25; i++) testArray.push("")

      req.body.txids = testArray

      const result = await validateBulk(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "Array too large")
    })

    it("should error appropriately for mainnet tx on testnet", async () => {
      // Stub out dependencies for unit tests.
      if (process.env.TEST === "unit") {
        sandbox.stub(slpRoute.testableComponents, "isValidSlpTxid").throws({
          response: {
            status: 500,
            data: {
              result: null,
              error: {
                message: "No such mempool"
              }
            }
          }
        })
      }

      req.body.txids = [
        "88b121101d71b73599dfc7d79eead599031912b2c48298bf5c1f37f4dd743ffa"
      ]

      const result = await validateBulk(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "No such mempool")
    })

    it("should error appropriately for nonsensical txid", async () => {
      // Stub out dependencies for unit tests.
      if (process.env.TEST === "unit") {
        sandbox.stub(slpRoute.testableComponents, "isValidSlpTxid").throws({
          response: {
            status: 500,
            data: {
              result: null,
              error: {
                message: "parameter 1 must be of length 64"
              }
            }
          }
        })
      }

      req.body.txids = ["abc123"]

      const result = await validateBulk(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ["error"])
      assert.include(result.error, "parameter 1 must be of length 64")
    })

    it("should validate array with single element", async () => {
      // Stub out dependencies for unit tests.
      if (process.env.TEST === "unit") {
        sandbox
          .stub(slpRoute.testableComponents, "isValidSlpTxid")
          .resolves(true)
      }

      req.body.txids = [
        "78d57a82a0dd9930cc17843d9d06677f267777dd6b25055bad0ae43f1b884091"
      ]

      const result = await validateBulk(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.isArray(result)
      assert.hasAllKeys(result[0], ["txid", "valid"])
    })

    it("should validate array with two elements", async () => {
      // Stub out dependencies for unit tests.
      if (process.env.TEST === "unit") {
        sandbox
          .stub(slpRoute.testableComponents, "isValidSlpTxid")
          .resolves(true)
      }

      req.body.txids = [
        "78d57a82a0dd9930cc17843d9d06677f267777dd6b25055bad0ae43f1b884091",
        "82d996847a861b08b1601284ef7d40a1777d019154a6c4ed11571609dd3555ac"
      ]

      const result = await validateBulk(req, res)
      //console.log(`result: ${util.inspect(result)}`)

      assert.isArray(result)
      assert.hasAllKeys(result[0], ["txid", "valid"])
      assert.equal(result.length, 2)
    })
  })

  describe("tokenTransfer()", () => {
    const tokenTransfer = slpRoute.testableComponents.tokenTransfer

    it("should run my test", async () => {
      req.params.txhex =
        //"0200000001d84aac974d54cf66ac3dcf88f43159fba586b8ec8588f7babce04140a7472eae030000006a47304402203acf52ed938f366be04e6bf2a245460be4c2b99f9bca0fdbc6ef2a47361ff98d02202a069dfe9eed3aef6995b481f7714c974a9e8c6396363a57981c6cb7d0ef1edd4121027879b72facc4bab074c03519d942cd3fbda868b5e07415550e92359fb9f46999ffffffff0400000000000000004f6a04534c500001010747454e4553495306534c5053444b15417765736f6d6520534c502053444b20546f6b656e1262616467657240626974636f696e2e636f6d4c0001020102080000000005f5e10022020000000000001976a9145c4c1653762d35fc3c87d1e9e377caa755462faf88ac22020000000000001976a9145c4c1653762d35fc3c87d1e9e377caa755462faf88acd9a4fa02000000001976a9145c4c1653762d35fc3c87d1e9e377caa755462faf88ac00000000"

        "02000000020779e744b480a2fbf44f174ba4a60a16cfef41a0397ec68b8c7a1088123de32f030000006b48304502210085fdad342a1111d85a4278ac756859106a6587b0d99a557494b618e48c915ec402200c08d358367801920302d284a70ec48554b96b9d202a1552dc6818de4f37030f41210242faa7cc02f9e6c3a0aec97a946b9d3793fa6ab76362e02dd239bc56393671cdffffffff0779e744b480a2fbf44f174ba4a60a16cfef41a0397ec68b8c7a1088123de32f020000006a47304402203fa6346af949b849e97c74ce551704b1a64500ada82ffe8423e4ca23c63bd1d502204261e69fb8c9ffd96ad6ed35dfe965d9bf64e36835957bd5eddf5a761454d35c41210242faa7cc02f9e6c3a0aec97a946b9d3793fa6ab76362e02dd239bc56393671cdffffffff040000000000000000406a04534c500001010453454e4420d250f9649646aeaba38e61191f5edcd8dcf2f087a3a71203e1cadf87cc863db40800000002540be4000801634518e7a27c0022020000000000001976a914d619e71bf3211ceb76f841161bb7902b2f079b9c88ac22020000000000001976a914a8f9b1307fa412da6a909f08930e5a502d27a74a88ac9cbd0f01000000001976a914a8f9b1307fa412da6a909f08930e5a502d27a74a88ac00000000"

      const result = await tokenTransfer(req, res)
      console.log(`result: ${util.inspect(result)}`)
    })
  })
})
