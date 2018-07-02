const Database = require('./Database')
const Redis = require('ioredis')
const bcrypt = require('bcrypt-promise')
const ObjectID = require('mongodb').ObjectID
const BSON = require('../utils/bsonSerializer')
const RuleRunner = require('../rules/rule-runner')
const CompoundUtils = require('../utils/compound-utils')

const SALT_WORK_FACTOR = 10
require('../utils/errorjson')

const redis = new Redis({
  port: 6379,
  host: '127.0.0.1',
  family: 4,
  // password: 'auth',
  db: 0
})

class Lab {
  constructor (rawLab, rawDeveloper, socketIO) {
    console.log(`    Lab id: ${rawLab.id} key: ${rawLab.apiKey}`)
    this.database = Database.MongoClient.db(rawLab.id)
    this.apiKey = rawLab.apiKey
    this.authMethods = rawLab.auth

    this.userCollection = this.database.collection('_users')
    this.userCollection.createIndex({ email: 1 }, { sparse: true, unique: true })
      .then(console.log)
      .catch(console.error)
    this.io = socketIO.of(`/${rawLab.id}`)
    this.io.use(this.ioMiddleware.bind(this))
    this.io.on('connection', this.onConnection.bind(this))
    this.allowOrigins = rawLab.allowOrigins || [
      'http://localhost:8080',
      'http://localhost:9966'
    ]
    // this.beakers = rawLab.beakers
    // dummy data
    this.rawBeakers = [
      {
        id: 'beaker1',
        rules: {
          list: 'request.user != null',
          get: 'request.user != null',
          update: 'request.user != null',
          create: 'request.user != null',
          delete: 'request.user != null'
        }
      },
      {
        id: 'beaker2',
        rules: {
          list: 'true',
          get: 'true',
          update: 'true',
          create: 'true',
          delete: 'true'
        }
      }
    ]
    this.beakers = {}
    this.rawBeakers.forEach(beaker => {
      this.beakers[beaker.id] = beaker
    })
    this.beakerIdlist = Object.keys(this.beakers)
    this.changeStreams = new Map()
  }
  async ioMiddleware (socket, next) {
    console.log('middleware!!')
    console.log(socket.handshake.query)
    if (socket.handshake.query.apiKey !== this.apiKey) {
      return next(new Error('API Key is not matched'))
    }

    if (!this.allowOrigins.includes(socket.handshake.headers.origin)) {
      return next(new Error('lab origin not allowed'))
    }

    let oldSocketId = socket.handshake.query.oldSocketId
    if (oldSocketId) {
      console.log(oldSocketId + ' ===> ' + socket.id)
      try {
        let userId = await redis.hget(oldSocketId, 'userId')
        if (userId) {
          let user = await this.userCollection.findOne({ _id: ObjectID.createFromHexString(userId) })
          if (!user) return next(new Error('user not found'))
          socket.user = user
          await redis.rename(oldSocketId, socket.id)
        }
      } catch (err) {
        console.error(err)
        // ignore the error
      }
    }
    next()
  }
  onConnection (socket) {
    console.log('onConnection! ' + socket.id)
    socket.uniqueCounter = 0
    socket.txnSessions = new Map()
    redis.hmset(socket.id, {
      uniqueCounter: 0,
      socketId: socket.id
    })
    socket.on('register', this.register.bind(this, socket))
    socket.on('login', this.login.bind(this, socket))
    socket.on('logout', this.logout.bind(this, socket))
    socket.on('create', this.create.bind(this, socket))
    socket.on('find', this.find.bind(this, socket))
    socket.on('get', this.get.bind(this, socket))
    socket.on('update', this.update.bind(this, socket))
    socket.on('delete', this.delete.bind(this, socket))
    socket.on('subscribe', this.subscribe.bind(this, socket))
    socket.on('unsubscribe', this.unsubscribe.bind(this, socket))
    socket.on('txn_start', this.startTransaction.bind(this, socket))
    socket.on('txn_commit', this.commitTransaction.bind(this, socket))
    socket.on('txn_abort', this.abortTransaction.bind(this, socket))
    socket.on('disconnect', this.onDisconnect.bind(this, socket))
  }
  onDisconnect (socket, reason) {
    console.log('on disconnect', reason)
    /*
      reason may be one of the followings
      'client namespace disconnect'
      'server namespace disconnect'
      'transport error'
      'ping timeout'
      'transport close'
      'io server disconnect'
    */
    for (let txnSession of socket.txnSessions.values()) {
      txnSession.endSession()
    }
    if (socket.listeningChangeStreamMap) {
      for (let subscriptionId of socket.listeningChangeStreamMap.keys()) {
        let changeStream = socket.listeningChangeStreamMap.get(subscriptionId)
        if (changeStream && changeStream.callbackHandlers) {
          changeStream.callbackHandlers.delete(subscriptionId)
        }
      }
    }
    delete socket.user
    redis.expire(socket.id, 30) // expire session if offline over 30 seconds
  }
  async register (socket, data, cb) {
    console.log('register!')
    try {
      let user
      switch (data.method) {
        case 'email':
          let salt = await bcrypt.genSalt(SALT_WORK_FACTOR)
          let hashedPassword = await bcrypt.hash(data.password, salt)

          let response = await this.userCollection.insertOne({
            email: data.email,
            password: hashedPassword
          })

          if (response.result.n === 0) {
            throw new Error('user already exists')
          }

          /* TODO: email verification */
          user = response.ops[0]
          break
        default:
          throw new Error('authentication method is under development')
      }
      socket.user = user
      const { password, ...sUser } = user
      cb(null, sUser)
    } catch (err) {
      if (err.code === 11000) return cb(new Error('user already exists'))
      cb(err)
    }
  }
  async login (socket, data, cb) {
    console.log('login!')
    try {
      if (typeof this.authMethods[data.method] === 'undefined') {
        return new Error('authentication method is unsupported')
      }
      let user
      switch (data.method) {
        case 'email':
          user = await this.userCollection.findOne({ email: data.email })
          if (!user) throw new Error('User not found')

          let isMatch = await bcrypt.compare(data.password, user.password)
          if (!isMatch) throw new Error('Incorrect password')

          break
        case 'ldap':
          user = await this.userCollection.findOne({ ldapUser: data.user })
          if (!user) throw new Error('ldap user not found')

          break
        default:
          throw new Error('authentication method is under development')
      }

      socket.user = user
      redis.hset(socket.id, 'userId', user._id)
      const { password, ...sUser } = user
      cb(null, sUser)
    } catch (err) {
      delete socket.user
      cb(err)
    }
  }
  logout (socket, data, cb) {
    delete socket.user
    redis.hdel(socket.id, 'userId', function (err) {
      console.error(err)
    })
    cb()
  }
  checkRequest (request) {
    if (
      request &&
      request.beakerId &&
      !this.beakerIdlist.includes(request.beakerId)
    ) {
      throw new Error('You do not has access to this beaker')
    }
  }
  async create (socket, request, cb) {
    try {
      this.checkRequest(request)
      /* TODO: rule validation */
      let collection = this.database.collection(request.beakerId)
      let compound = BSON.deserialize(Buffer.from(request.data))

      CompoundUtils.validateObject(compound)
      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rules.create)
      let passACL = await ruleRunner.run({ request: { compound, user: socket.user } })
      if (!passACL) {
        throw new Error('Access denined')
      }

      let options = {}
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let response = await collection.insertOne(
        compound,
        options
      ) /* insertOne has no raw option */
      if (response.result.n === 0) {
        throw new Error('Create compound failed. Write conflict?')
      }
      cb(null, {
        data: BSON.serialize(response.ops[0]) /* so we need to serialize it */
      })
    } catch (err) {
      cb(err)
    }
  }
  async find (socket, query, cb) {
    try {
      this.checkRequest(query)
      /* TODO: rule validation */

      const parsedConditions = BSON.deserialize(Buffer.from(query.conditions))
      query.conditions = parsedConditions

      let ruleRunner = new RuleRunner(this.beakers[query.beakerId].rules.list)
      let passACL = await ruleRunner.run({ request: { user: socket.user } }, query)
      if (!passACL) {
        throw new Error('Access denined')
      }

      let collection = this.database.collection(query.beakerId)

      let options = { ...query.options, raw: true }
      if (query.txnSessionId) {
        let txnSession = socket.txnSessions.get(query.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let result = await collection.find(parsedConditions, options).toArray()

      cb(null, {
        data: result
      })
    } catch (err) {
      cb(err)
    }
  }
  async get (socket, request, cb) {
    try {
      this.checkRequest(request)
      let collection = this.database.collection(request.beakerId)

      let options = { raw: true }
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let compound = await collection.findOne(
        { _id: ObjectID.createFromHexString(request._id) }, options
      )
      if (!compound) throw new Error('Compound does not exist')

      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rules.get)
      let passACL = await ruleRunner.run({ compound, request: { user: socket.user } })
      if (!passACL) {
        throw new Error('Access denined')
      }

      /* TODO: rule validation */
      cb(null, {
        data: compound
      })
    } catch (err) {
      cb(err)
    }
  }

  async update (socket, request, cb) {
    try {
      this.checkRequest(request)
      let collection = this.database.collection(request.beakerId)
      let queryById = { _id: ObjectID.createFromHexString(request._id) }

      let options = {}
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let compound = await collection.findOne(queryById, options)
      if (!compound) throw new Error('Compound does not exist')

      let newSetData = BSON.deserialize(Buffer.from(request.data)) || {}
      let context = {
        compound,
        request: {
          user: socket.user,
          compound: { ...compound, ...CompoundUtils.dotNotationToObject(newSetData) }
        }
      }

      CompoundUtils.validateObject(context.request.compound)
      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rules.update)
      let passACL = await ruleRunner.run(context)
      if (!passACL) {
        throw new Error('Access denined')
      }

      /* TODO: rule validation & replace option */

      let update = {
        $set: newSetData
      }

      if (typeof compound.__version === 'number') {
        queryById.__version = compound.__version
        update.$inc = { __version: 1 }
      } else {
        update.$set.__version = 0
      }

      let response = await collection.updateOne(queryById, update, options)

      if (response.result.n === 0) {
        throw new Error('Compound does not exist or have write conflict')
      }

      cb(null, {
        data: { ok: true, result: response.result }
      })
    } catch (err) {
      cb(err)
    }
  }
  async delete (socket, request, cb) {
    try {
      this.checkRequest(request)
      let collection = this.database.collection(request.beakerId)
      let queryById = { _id: ObjectID.createFromHexString(request._id) }

      let options = {}
      if (request.txnSessionId) {
        let txnSession = socket.txnSessions.get(request.txnSessionId)
        if (!txnSession) throw new Error('Invalid txnSessionId')
        options.session = txnSession
      }

      let compound = await collection.findOne(queryById, options)
      if (!compound) throw new Error('Compound does not exist')

      /* TODO: rule validation */
      let ruleRunner = new RuleRunner(this.beakers[request.beakerId].rules.delete)
      let passACL = await ruleRunner.run({ compound, request: { user: socket.user } })
      if (!passACL) {
        throw new Error('Access denined')
      }

      if (typeof compound.__version === 'number') {
        queryById.__version = compound.__version
      }

      let response = await collection.deleteOne(queryById, options)
      if (response.result.n === 0) {
        throw new Error('Compound does not exist or have write conflict')
      }
      cb(null, {
        data: { ok: true }
      })

      /*
      TODO: notify delete
      let matchSubscribeQuery = await collection.aggregate([
        { $limit: 1 },
        { $project: { '###nonexist': 0 } },
        { $addFields: compound },
        { $match: condition },
        { $count: 'n' }
      ])
      if (matchSubscribeQuery.n === 1) {
        emit delete now
      }
      */
    } catch (err) {
      cb(err)
    }
  }
  subscribe (socket, query, cb) {
    try {
      /* TODO: rule validation */
      this.checkRequest(query)
      const changeStream = this.getChangeStream(
        query.beakerId,
        query.conditions
      )
      if (!socket.listeningChangeStreamMap) {
        socket.listeningChangeStreamMap = new Map()
      }

      const subscriptionId = changeStream.uniqueCounter
        ? ++changeStream.uniqueCounter
        : 0

      const handler = (err, changeData) => {
        socket.emit('change' + subscriptionId, err, changeData)
      }

      socket.listeningChangeStreamMap.set(subscriptionId, changeStream)
      changeStream.callbackHandlers.set(subscriptionId, handler)

      cb(null, {
        data: {
          subscriptionId: subscriptionId
        }
      })
    } catch (err) {
      cb(err)
    }
  }
  unsubscribe (socket, request, cb) {
    try {
      this.checkRequest(request)
      let subscriptionId = request.subscriptionId

      if (!socket.listeningChangeStreamMap) {
        throw new Error('No subscription')
      }
      let changeStream = socket.listeningChangeStreamMap.get(subscriptionId)
      if (!changeStream) {
        throw new Error('Invalid subscription id')
      }

      if (!changeStream.callbackHandlers.delete(subscriptionId)) {
        throw new Error('Invalid subscription id')
      }

      cb(null, {
        data: {
          removedSubscriptionId: subscriptionId
        }
      })
    } catch (err) {
      cb(err)
    }
  }
  getChangeStream (beakerId, condition) {
    const key = beakerId + JSON.stringify(condition)
    let changeStream = this.changeStreams.get(key)

    if (!changeStream) {
      let lookupCondition = Object.assign(...Object.entries(condition)
        .map(([k, v]) => ({['fullDocument.' + k]: v})))

      const pipeline = [
        { $match: lookupCondition },
        {
          $project: {
            documentKey: 0,
            ns: 0,
            clusterTime: 0
          }
        }
      ]
      const options = {
        fullDocument: 'updateLookup'
      }

      changeStream = this.database
        .collection(beakerId)
        .watch(pipeline, options)

      changeStream.callbackHandlers = new Map()
      this.changeStreams.set(key, changeStream)

      changeStream.on('change', changeData => {
        if (
          changeData.operationType === 'update' &&
          changeData.updateDescription.removedFields.length === 0
        ) {
          let fields = Object.keys(changeData.updateDescription.updatedFields)
          if (fields.length === 1 && fields[0] === '__version') return
        }

        delete changeData._id
        let changeDataRaw = BSON.serialize(changeData)

        for (let subscriptionId of changeStream.callbackHandlers.keys()) {
          let callback = changeStream.callbackHandlers.get(subscriptionId)
          if (callback) {
            setImmediate(() => callback(null, changeDataRaw))
          }
        }
      })
      changeStream.on('error', err => {
        console.error('ChangeStream Error', err)
        for (let subscriptionId of changeStream.callbackHandlers.keys()) {
          let callback = changeStream.callbackHandlers.get(subscriptionId)
          if (callback) {
            setImmediate(() => callback(err))
          }
        }
      })
      changeStream.on('close', () => {
        changeStream.callbackHandlers.clear()
        this.changeStreams.delete(key)
      })
      // changeStream.setMaxListeners(1000);
    }
    return changeStream
  }
  startTransaction (socket, request, cb) {
    try {
      let txnSession = Database.MongoClient.startSession()
      socket.txnSessions.set(++socket.uniqueCounter, txnSession)
      txnSession.startTransaction() /* no return value, no callback */
      cb(null, { txnSessionId: socket.uniqueCounter })
    } catch (err) {
      cb(err)
    }
  }
  async commitTransaction (socket, request, cb) {
    try {
      let txnSession = socket.txnSessions.get(request.txnSessionId)
      if (!txnSession) throw new Error('Invalid txnSessionId')
      let result = await txnSession.commitTransaction() /* a promise if no callback function specified */
      cb(null, { data: result })
    } catch (err) {
      cb(err)
    }
  }
  async abortTransaction (socket, request, cb) {
    try {
      let txnSession = socket.txnSessions.get(request.txnSessionId)
      if (!txnSession) throw new Error('Invalid txnSessionId')
      let result = await txnSession.abortTransaction() /* a promise if no callback function specified */

      /*
        callback is meaningless
        https://github.com/mongodb-js/mongodb-core/blob/d95a4d15eea9455dff3feea38784bbaed338488d/lib/sessions.js#L114
      */
      txnSession.endSession()
      socket.txnSessions.delete(request.txnSessionId)
      cb(null, { data: result })
    } catch (err) {
      cb(err)
    }
  }
}

module.exports = Lab
