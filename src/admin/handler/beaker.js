function beakerMiddleware (req, res, next) {
  const beaker = req.lab.beakers.find(b => b.id === req.params.beakerId)
  if (!beaker) throw new Error('Beaker not found')
  req.beaker = beaker
  next()
}

function listBeaker (req, res, next) {
  res.json(req.lab.beakers.map(b => ({ id: b.id })))
}

function getBeaker (req, res, next) {
  res.json(req.beaker)
}

async function createBeaker (req, res, next) {
  try {
    const lab = req.lab
    let beaker = req.body
    lab.beakers.push(beaker)
    await req.developer.save()
    beaker = lab.beakers.find(b => b.id === beaker.id).toObject() // convert mongoose to plain object
    req.labInstance.newBeaker(beaker)
    res.json(beaker)
  } catch (err) {
    next(err)
  }
}

async function updateBeaker (req, res, next) {
  try {
    let beaker = req.beaker
    if (req.body.rule) {
      beaker.rule = { ...beaker.rule.toJSON(), ...req.body.rule }
    }
    await req.developer.save()
    beaker = req.lab.beakers.find(b => b.id === req.beaker.id).toObject() // convert mongoose to plain object
    req.labInstance.updateBeaker(beaker)
    res.json(beaker)
  } catch (err) {
    next(err)
  }
}

async function deleteBeaker (req, res, next) {
  try {
    req.beaker.remove()
    await req.developer.save()
    res.json({ id: req.beaker.id })
  } catch (err) {
    next(err)
  }
}
module.exports = { beakerMiddleware, listBeaker, getBeaker, createBeaker, updateBeaker, deleteBeaker }
