if (typeof io === 'undefined') throw new Error('socket.io is required to be loaded before chembase sdk');
var Beaker = require('./beaker.js');

var Lab = function(options) {
    this.sessionId = undefined;
    this.socket = io('http://localhost:8080/' + options.labId, {
        query: {
            apiKey: options.apiKey
        },
        transports: ['websocket'],
        upgrade: false
    })

    this.socket.on('reconnect_attempt', function() {
        //socket.io.opts.query.sessionId = this.sessionId;
        console.log('reconnect attempt');
    });
    this.socket.on('error', function(err) {
        console.log(err);
    });
}

Lab.prototype.login = function(data) {
    console.log('login start');
    this.socket.emit('login', data, function(result) {
        console.log('login result', result);
    });
}

Lab.prototype.register = function(method, data) {
    this.socket.emit('register', data, function(result) {
        console.log('register result');
    });
}

Lab.prototype.beaker = function (id) {
    return new Beaker(this, id);
};
window.Chembase = {
    Lab: Lab,
    Beaker: Beaker
};