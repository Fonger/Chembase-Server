if (typeof io === 'undefined') throw new Error('socket.io is required to be loaded before chembase sdk')
var Beaker = require('./beaker.js')
var Lab = require('./lab.js')
var utils = require('./utils')

window.Chembase = {
  Lab: Lab,
  Beaker: Beaker,
  ServerValue: {
    Date: new utils.$ServerDate()
  }
}
