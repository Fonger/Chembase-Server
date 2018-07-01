if (typeof io === 'undefined') throw new Error('socket.io is required to be loaded before chembase sdk')
var Beaker = require('./beaker.js')
var Lab = require('./lab.js')

window.Chembase = {
  Lab: Lab,
  Beaker: Beaker
}
