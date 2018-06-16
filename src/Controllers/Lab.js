const Database = require('./Database');
const bcrypt = require('bcrypt-promise');

class Lab {
    constructor(rawLab, rawDeveloper, socketIO) {
        console.log(`    Lab id: ${rawLab.id} key: ${rawLab.apiKey}`);
        let database = Database.MongoClient.db(rawLab.id);
        let rules = {};
        try {
            rules = JSON.parse(rawLab.rule);
            console.log('        Rule is valid');
        }
        catch(e) {
            console.error(`        Rule is invalid`);
        }

        this.apiKey = rawLab.apiKey;
        this.userCollection = database.collection('_users');
        this.io = socketIO.of(`/${rawLab.id}`);
        this.io.use(this.ioMiddleware.bind(this));
        this.io.on('connection', this.onConnection.bind(this));
        this.allowOrigins = rawLab.allowOrigins || ['http://localhost:8080'];
        this.beakers = rawLab.beakers.map(beakerId => {
            console.log(`        beaker id: ${beakerId}`);

            let collection = database.collection(beakerId);
            
            return {
                id: beakerId,
                rule: rules[beakerId] || {}
            }
        });
    }
    ioMiddleware(socket, next) {
        console.log('middleware!!');
        if (socket.handshake.query.apiKey !== this.apiKey) {
            return next(new Error('API Key is not matched'));
        }

        if (!this.allowOrigins.includes(socket.handshake.headers.origin)) {
            return next(new Error('lab origin not allowed'));
        }
        next();
    }
    onConnection(socket) {
        console.log('onConnection!');
        socket.on('register', this.register);
        socket.on('login', this.login.bind(this));
        socket.on('logout', this.logout);
        socket.on('find', this.find);
        socket.on('update', this.update);
        socket.on('subscribe', this.subscribe);
        socket.on('unsubscribe', this.unsubscribe);
        socket.on('disconnect', this.onDisconnect);
    }
    onDisconnect(reason) {

    }
    register() {

    }
    async login(data, cb) {
        console.log('login!');
        switch (data.method) {
            case 'email':
                let user = await this.userCollection.findOne({email: data.email});
                if (!user) return cb({error: true, reason: 'user not found'});

                let isMatch = await bcrypt.compare(user.password, data.bassword);
                if (!isMatch) return cb({error: true, reason: 'incorrect password'});
                socket.user = user;
                break;
            default:
                cb({error: true, reason: 'unknown authentication method'});
                break;
        }
    }
    logout() {

    }
    find() {

    }
    update() {

    }
    subscribe() {

    }
    unsubscribe() {

    }
}

module.exports = Lab;