const random = require('../../utils/random')
const Lab = require('../../handler/lab')

function labMiddleware (req, res, next) {
  let lab = req.developer.labs.find(lab => lab.id === req.params.labId)
  if (!lab) throw new Error('Lab not found')
  req.lab = lab
  req.labInstance = Lab.get(lab.id)
  next()
}

function listLab (req, res, next) {
  res.json(req.developer.labs.map(lab => ({ id: lab.id })))
}

function getLab (req, res, next) {
  // convert mongoose object into plain object to alter property directly
  const lab = req.lab.toJSON()
  lab.beakers = lab.beakers.map(beaker => ({ id: beaker.id }))
  res.json(lab)
}

async function createLab (req, res, next) {
  try {
    req.developer.labs.push({ ...req.body, apiKey: await random.generateHexString(16), beakers: [] })
    const developer = await req.developer.save()
    let lab = developer.labs.find(lab => lab.id === req.body.id).toObject()
    const labInstance = new Lab(lab, req.developer)
    await labInstance.database.addUser('chembaseuser', lab.apiKey, { roles: ['readWrite'] })
    lab.beakers = labInstance.beakerIdlist.map(b => ({ id: b.id }))
    res.json(lab)
  } catch (err) {
    next(err)
  }
}

async function updateLab (req, res, next) {
  try {
    let lab = req.lab

    let newEmailAuthConfig = false
    let newLdapAuthConfig = false
    let newApiKey = false
    if (req.body.name) lab.name = req.body.name
    if (req.body.description) lab.description = req.body.description
    if (req.body.apiKey === 'new') {
      lab.apiKey = await random.generateHexString(16)
      newApiKey = true
    }
    if (req.body.allowOrigins) lab.allowOrigins = req.body.allowOrigins
    if (req.body.auth) {
      if (req.body.auth.email) {
        lab.auth.email = req.body.auth.email
        newEmailAuthConfig = req.body.auth.email
      }
      if (req.body.auth.ldap) {
        lab.auth.ldap = req.body.auth.ldap
        newLdapAuthConfig = req.body.auth.ldap
      }
    }
    if (req.body.beaker) {
      throw new Error('No beaker update here. please use PATCH /lab/:labId/beakers/:beakerId')
    }

    await req.developer.save()

    const labInstance = req.labInstance || new Lab(lab, req.developer)
    if (newEmailAuthConfig) {
      labInstance.setupEmailAuth(newEmailAuthConfig)
    }
    if (newLdapAuthConfig) {
      labInstance.setupLdapAuth(newLdapAuthConfig)
    }
    labInstance.updateAllowedOrigins(lab.allowOrigins)

    if (newApiKey) {
      await labInstance.database.command({
        updateUser: 'user',
        pwd: lab.apiKey
      })
    }
    lab = lab.toObject()
    lab.beakers = lab.beakers.map(beaker => ({ id: beaker.id }))
    res.json(lab)
  } catch (err) {
    next(err)
  }
}

async function deleteLab (req, res, next) {
  try {
    if (req.labInstance) {
      await req.labInstance.cleanUp()
    }

    req.lab.remove()
    /* TODO delete underlying database */
    await req.developer.save()
    res.json({ id: req.lab.id })
  } catch (err) {
    next(err)
  }
}

async function getLabStats (req, res, next) {
  try {
    const data = await req.labInstance.database.stats()
    data.quotaSize = 1024 * 1024 * 2
    res.json(data)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  labMiddleware,
  listLab,
  getLab,
  getLabStats,
  createLab,
  updateLab,
  deleteLab
}
