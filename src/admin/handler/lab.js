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
    req.developer.labs.push({ ...req.body, apiKey: await random.generateHexString(16) })
    const developer = await req.developer.save()
    let lab = developer.labs.find(lab => lab.id === req.body.id)
    const labInstance = new Lab(lab, req.developer)
    lab = lab.toJSON()
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
    if (req.body.name) lab.name = req.body.name
    if (req.body.description) lab.description = req.body.description
    if (req.body.apiKey === 'new') lab.apiKey = await random.generateHexString(16)
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

    lab = lab.toJSON()
    lab.beakers = lab.beakers.map(beaker => ({ id: beaker.id }))
    res.json(lab)
  } catch (err) {
    next(err)
  }
}

async function deleteLab (req, res, next) {
  try {
    if (req.labInstance) {
      req.labInstance.cleanUp()
    }

    req.lab.remove()
    await req.developer.save()
    res.json({ id: req.lab.id })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  labMiddleware,
  listLab,
  getLab,
  createLab,
  updateLab,
  deleteLab
}
