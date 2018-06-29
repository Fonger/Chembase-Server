const Database = require('./Database')
const bcrypt = require('bcrypt-promise')
const ObjectID = require('mongodb').ObjectID
const BSON = require('../utils/bsonSerializer')

require('../utils/errorjson')

class Lab {
  constructor (rawLab, rawDeveloper, socketIO) {
    console.log(`    Lab id: ${rawLab.id} key: ${rawLab.apiKey}`)
    this.database = Database.MongoClient.db(rawLab.id)
    let rules = {}
    try {
      rules = JSON.parse(rawLab.rule)
      console.log('        Rule is valid')
    } catch (e) {
      console.error(`        Rule is invalid`)
    }
    this.apiKey = rawLab.apiKey
    this.authMethods = rawLab.auth
    this.users = {}
    this.userCollection = this.database.collection('_users')
    this.io = socketIO.of(`/${rawLab.id}`)
    this.io.use(this.ioMiddleware.bind(this))
    this.io.on('connection', this.onConnection.bind(this))
    this.allowOrigins = rawLab.allowOrigins || [
      'http://localhost:8080',
      'http://localhost:9966'
    ]
    this.beakers = rawLab.beakers.map(beakerId => {
      console.log(`        beaker id: ${beakerId}`)

      // let collection = this.database.collection(beakerId)

      return {
        id: beakerId,
        rule: rules[beakerId] || {}
      }
    })
    this.beakerIdlist = this.beakers.map(beaker => beaker.id)
    this.changeStreams = new Map()
  }
  async ioMiddleware (socket, next) {
    console.log('middleware!!')
    if (socket.handshake.query.apiKey !== this.apiKey) {
      return next(new Error('API Key is not matched'))
    }

    if (!this.allowOrigins.includes(socket.handshake.headers.origin)) {
      return next(new Error('lab origin not allowed'))
    }

    let sessionId = socket.handshake.query.sessionId
    if (sessionId) {
      /* TODO: find session table instead */
      try {
        socket.user = await this.userCollection.findOne({ _id: sessionId })
        if (socket.user.expiredAt && socket.user.expiredAt < Date.now()) {
          socket.user = undefined
        }
      } catch (err) {
        return next(err)
      }
    }
    next()
  }
  onConnection (socket) {
    console.log('onConnection! ' + socket.id)
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
    socket.on('disconnect', this.onDisconnect.bind(this, socket))
  }
  onDisconnect (socket, reason) {
    console.log('on disconnect', socket)
    if (socket.listeningChangeStreamMap) {
      for (let subscriptionId of socket.listeningChangeStreamMap.keys()) {
        let changeStream = socket.listeningChangeStreamMap.get(subscriptionId)
        if (changeStream && changeStream.callbackHandlers) {
          changeStream.callbackHandlers.delete(subscriptionId)
        }
      }
    }
  }
  register () { }
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

          let isMatch = await bcrypt.compare(user.password, data.bassword)
          if (!isMatch) throw new Error('Incorrect password')

          socket.user = user
          this.users[socket.id] = user._id
          cb(null, user)
          break
        case 'ldap':
          user = await this.userCollection.findOne({ ldapUser: data.user })
          if (!user) throw new Error('ldap user not found')

          socket.user = user
          this.users[socket.id] = user._id
          cb(null, user)
          break
        default:
          throw new Error('authentication method is under development')
      }
    } catch (err) {
      cb(err)
    }
  }
  logout (socket) {
    delete socket.user
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
      let response = await collection.insertOne(
        compound
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
      let collection = this.database.collection(query.beakerId)
      query.options.raw = true
      let result = await collection
        .find(BSON.deserialize(Buffer.from(query.condition)), query.options)
        .toArray()

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
      let compound = await collection.findOne(
        { _id: ObjectID.createFromHexString(request._id) },
        { raw: true }
      )
      if (!compound) throw new Error('Compound does not exist')

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
      let compound = await collection.findOne(queryById)
      if (!compound) throw new Error('Compound does not exist')

      /* TODO: rule validation & replace option */

      let update = {
        $set: BSON.deserialize(Buffer.from(request.data)) || {}
      }

      if (typeof compound.__version === 'number') {
        queryById.__version = compound.__version
        update.$inc = { __version: 1 }
      } else {
        update.$set.__version = 0
      }

      let response = await collection.updateOne(queryById, update, {
        upsert: false
      })

      if (response.result.n === 0) {
        throw new Error('Compound does not exist or have write conflict')
      }
      cb(null, {
        data: response.result
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
      let compound = await collection.findOne(queryById)
      if (!compound) throw new Error('Compound does not exist')

      /* TODO: rule validation */

      if (typeof compound.__version === 'number') {
        queryById.__version = compound.__version
      }

      let response = await collection.deleteOne(queryById)
      if (response.result.n === 0) {
        throw new Error('Compound does not exist or have write conflict')
      }
      cb(null, {
        data: response.result
      })
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
        query.condition
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
      const pipeline = { $match: condition }
      const options = {
        updateLookup: 'updateLookup'
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
}

module.exports = Lab
