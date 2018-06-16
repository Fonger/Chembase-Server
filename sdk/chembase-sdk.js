(function() {
    if (typeof io === 'undefined') throw new Error('socket.io is required to be loaded before chembase sdk');
    var labId = 'testdb';
    var Chembase = function(options) {
        this.socket = io('http://localhost:8080/' + options.labId, {
            query: {
                apiKey: options.apiKey
            },
            transports: ['websocket'],
            upgrade: false
        })

        this.socket.on('error', function(err) {
            console.log(err);
        });
    }

    Chembase.prototype.login = function(data) {
        console.log('login start');
        this.socket.emit('login', data, function(result) {
            console.log('login result', result);
        });
    }

    Chembase.prototype.register = function(method, data) {
        this.socket.emit('register', data, function(result) {
            console.log('register result');
        });
    }

    window.Chembase = Chembase;
})();

var chemBase = new Chembase({labId: 'testdb', apiKey: '8f65263ad306bc0e0d765e3dff69fb43'});
console.log(chemBase.socket);
chemBase.socket.on('connect', function() {
    console.log('connected');
});
chemBase.login({
    method: 'email'
}, function(result) {
    console.log(result);
});
