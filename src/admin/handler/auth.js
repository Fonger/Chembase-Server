const Developer = require('../../database/developer')

async function signIn (req, res, next) {
  try {
    const developer = await Developer.findOne({ email: req.body.email })
      .collation({ locale: 'en_US', strength: 1 })

    if (!developer) throw new Error('Developer not found')
    const passCorrect = await developer.comparePassword(req.body.password)
    if (passCorrect) {
      res.json({ token: await developer.getToken() })
    } else {
      res.status(400).json({ error: true })
    }
  } catch (err) {
    next(err)
  }
}

function signOut (req, res, next) {
  res.json({ ok: true })
}

async function signUp (req, res, next) {
  try {
    let developer = new Developer()
    developer.name = req.body.fullName
    developer.email = req.body.email
    developer.password = req.body.password
    await developer.save()
    res.json({ token: await developer.getToken() })
  } catch (err) {
    next(err)
  }
}

function requestPass (req, res, next) {

}

module.exports = { signIn, signOut, signUp, requestPass }
