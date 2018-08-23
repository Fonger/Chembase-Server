const express = require('express')
const router = express.Router()

const { io } = require('../handler/server')
const { Developer } = require('../database')
const { signIn, signOut, signUp, requestPass } = require('./handler/auth')
const { labMiddleware, listLab, getLab, getLabStats, createLab, updateLab, deleteLab } = require('./handler/lab')
const { labUserMiddleware, listLabUser, getLabUser, updateLabUser, createLabUser, deleteLabUser } = require('./handler/lab-user')
const { beakerMiddleware, listBeaker, getBeaker, createBeaker, updateBeaker, deleteBeaker } = require('./handler/beaker')
const { compoundMiddleware, listCompounds, createCompound, updateCompound, deleteCompound } = require('./handler/compound')
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

router.get('/labs/:labId/stats', getLabStats)

router.get('/labs/:labId/users', listLabUser)
router.post('/labs/:labId/users', createLabUser)
router.use('/labs/:labId/users/:userId', labUserMiddleware)
router.get('/labs/:labId/users/:userId', getLabUser)
router.patch('/labs/:labId/users/:userId', updateLabUser)
router.delete('/labs/:labId/users/:userId', deleteLabUser)

router.get('/labs/:labId/beakers', listBeaker)
router.post('/labs/:labId/beakers', createBeaker)

/* req.beaker */
router.use('/labs/:labId/beakers/:beakerId', beakerMiddleware)
router.get('/labs/:labId/beakers/:beakerId', getBeaker)
router.patch('/labs/:labId/beakers/:beakerId', updateBeaker)
router.delete('/labs/:labId/beakers/:beakerId', deleteBeaker)

/* req.collection */
router.use('/labs/:labId/beakers/:beakerId/compounds', compoundMiddleware)
router.get('/labs/:labId/beakers/:beakerId/compounds', listCompounds)
router.post('/labs/:labId/beakers/:beakerId/compounds/query', listCompounds)
router.post('/labs/:labId/beakers/:beakerId/compounds', createCompound)
router.patch('/labs/:labId/beakers/:beakerId/compounds/:compoundId', updateCompound)
router.delete('/labs/:labId/beakers/:beakerId/compounds/:compoundId', deleteCompound)

router.use((error, req, res, next) => {
  res.status(400).json(error)
})

const adminIO = io.of('/admin')
adminIO.use(function (socket, next) {
  if (!socket.handshake.query || !socket.handshake.query.token) return next(new Error('No token'))
  Developer.findByToken(socket.handshake.query.token).then(developer => {
    socket.developer = developer
    next()
  }).catch(next)
})
adminIO.on('connection', socketHandler)
module.exports = router
