const BSON = require('../../utils/bsonSerializer')
const assert = require('assert')
const bcrypt = require('bcrypt')
const SALT_WORK_FACTOR = 10

function listLabUser (req, res, next) {
  req.labInstance.userCollection.find({}).toArray().then((users) => {
    res.json(users)
  }).catch(next)
}

function labUserMiddleware (req, res, next) {
  req.labUserId = BSON.ObjectId.createFromHexString(req.params.userId)
  next()
}

function getLabUser (req, res, next) {
  req.labInstance.userCollection
    .findOne({ _id: req.labUserId })
    .then((user) => {
      if (!user) throw new Error('labUser not found')
      res.json(user)
    }).catch(next)
}

async function createLabUser (req, res, next) {
  try {
    let { method, email, password, username, verified } = req.body
    let user = { method }

    switch (user.method) {
      case 'email':
        assert.ok(typeof email === 'string' && email !== '', 'email should be string')
        assert.ok(typeof password === 'string', 'password should be string')
        verified = verified === true || verified === 'true'
        password = await bcrypt.hash(password, SALT_WORK_FACTOR)
        email = email.toLowerCase()
        user = { method, email, password, verified }
        break
      case 'ldap':
        assert.ok(typeof username === 'string' && username !== '', 'username should be string')
        username = username.toLowerCase()
        user = { method, username }
        break
      default:
        throw new Error('Not support auth method')
    }
    const response = await req.labInstance.userCollection.insertOne(user)

    user = response.ops[0]
    res.json(user)
  } catch (err) {
    next(err)
  }
}

async function updateLabUser (req, res, next) {
  try {
    const update = { method: req.body.method }
    switch (update.method) {
      case 'email':
        if (typeof req.body.email === 'string') {
          if (req.body.email === '') throw new Error('email required')
          update.email = req.body.email.toLowerCase()
        }
        if (typeof req.body.verified === 'boolean') {
          update.verified = req.body.verified
        }
        break
      case 'ldap':
        if (typeof req.body.username === 'string' && req.body.username !== '') {
          update.username = req.body.username.toLowerCase()
        }
        break
      default:
        throw new Error('Not support auth method')
    }
    const response = await req.labInstance.userCollection.findOneAndUpdate(
      { _id: req.labUserId },
      { $set: update },
      { returnOriginal: false })

    const user = response.value
    if (!user) throw new Error('labUser not found')
    res.json(user)
  } catch (err) {
    next(err)
  }
}

async function deleteLabUser (req, res, next) {
  try {
    const response = await req.labInstance.userCollection.deleteOne({ _id: req.labUserId })
    if (response.result.n === 0) {
      throw new Error('labUser not found')
    }
    res.json({ _id: req.params.ObjectId })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  labUserMiddleware,
  listLabUser,
  getLabUser,
  createLabUser,
  updateLabUser,
  deleteLabUser
}
