const express = require('express')
const router = express.Router()

const { io } = require('../handler/server')
const { Developer } = require('../database')
const { signIn, signOut, signUp, requestPass } = require('./handler/auth')
const { labMiddleware, listLab, getLab, createLab, updateLab, deleteLab } = require('./handler/lab')
const { beakerMiddleware, listBeaker, getBeaker, createBeaker, updateBeaker, deleteBeaker } = require('./handler/beaker')
const socketHandler = require('./handler/socket')

router.post('/auth/sign-in', signIn)
router.post('/auth/sign-out', signOut)
router.post('/auth/sign-up', signUp)
router.post('/auth/request-pass', requestPass)

/* req.developer */
router.use(async function (req, res, next) {
  try {
    if (!req.headers.authorization) throw new Error('No token provided')
    const authHeaderParts = req.headers.authorization.split(' ')
    if (authHeaderParts[0] === 'Bearer') {
      req.token = authHeaderParts[1]
    } else {
      req.token = req.headers.authorization
    }
    req.developer = await Developer.findByToken(req.token)
    next()
  } catch (err) {
    next(err)
  }
})

router.get('/labs', listLab)
router.post('/labs', createLab)

/* req.lab and req.labInstance */
router.use('/labs/:labId', labMiddleware)
router.get('/labs/:labId', getLab)
router.patch('/labs/:labId', updateLab)
router.delete('/labs/:labId', deleteLab)

router.get('/labs/:labId/beakers', listBeaker)
router.post('/labs/:labId/beakers', createBeaker)

/* req.beaker */
router.use('/labs/:labId/beakers/:beakerId', beakerMiddleware)
router.get('/labs/:labId/beakers/:beakerId', getBeaker)
router.patch('/labs/:labId/beakers/:beakerId', updateBeaker)
router.delete('/labs/:labId/beakers/:beakerId', deleteBeaker)

router.use((error, req, res, next) => {
  res.status(400).json(error)
})

io.of('/admin').on('connection', socketHandler)
module.exports = router
