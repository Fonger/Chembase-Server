const BSON = require('../../utils/bsonSerializer')
const EJSON = require('mongodb-extjson')

function compoundMiddleware (req, res, next) {
  req.collection = req.labInstance.database.collection(req.beaker.id)
  next()
}

function listCompounds (req, res, next) {
  let conditions = {}
  let options = null
  if (req.body.conditions) {
    conditions = EJSON.parse(req.body.conditions)
  }
  if (req.body.options) {
    options = JSON.parse(req.body.options)
  }
  req.collection.find(conditions, options).toArray().then(compounds => {
    res.json({ compounds: EJSON.stringify(compounds, {relaxed: true}) })
  }).catch(next)
}

function createCompound (req, res, next) {
  const compound = EJSON.parse(req.body.compound)
  req.collection.insertOne(compound, req.body.options || null).then(response => {
    if (response.result.n === 0) {
      throw new Error('Create compound failed. Write conflict?')
    }
    res.json({ compounds: EJSON.stringify(response.ops[0], {relaxed: true}) })
  }).catch(next)
}

function updateCompound (req, res, next) {
  const _id = BSON.ObjectId.createFromHexString(req.params.compoundId)
  const update = EJSON.parse(req.body.update)

  if (!update.$inc) update.$inc = {}
  update.$inc.__version = 1

  const options = req.body.options || {}
  if (!('returnOriginal' in options)) options.returnOriginal = false

  req.collection.findOneAndUpdate({ _id }, update, options).then(result => {
    if (!result.value) throw new Error('Compound not found')
    res.json({ compound: EJSON.stringify(result.value, {relaxed: true}) })
  }).catch(next)
}

function deleteCompound (req, res, next) {
  const _id = BSON.ObjectId.createFromHexString(req.params.compoundId)
  req.collection.deleteOne({ _id }, req.body.options || null).then(result => {
    if (result.n === 0) throw new Error('Compound not found')
    res.json({ compound: EJSON.stringify({ _id }) })
  }).catch(next)
}

module.exports = { compoundMiddleware, listCompounds, createCompound, updateCompound, deleteCompound }
