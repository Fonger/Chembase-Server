const Database = require('./Database');
const bcrypt = require('bcrypt-promise');
const ObjectID = require('mongodb').ObjectID;
const deepEqual = require('fast-deep-equal');
const Expression = require('../utils/expression');
const BSON = require('../utils/bsonSerializer');

require('../utils/errorjson');

console.log(BSON.Int32(241241).valueOf() == BSON.Int32(241241).valueOf());

process.exit();

class Lab {
    constructor(rawLab, rawDeveloper, socketIO) {
        console.log(`    Lab id: ${rawLab.id} key: ${rawLab.apiKey}`);
        this.database = Database.MongoClient.db(rawLab.id);
        let rules = {};
        try {
            rules = JSON.parse(rawLab.rule);
            console.log('        Rule is valid');
        }
        catch (e) {
            console.error(`        Rule is invalid`);
        }
        this.apiKey = rawLab.apiKey;
        this.authMethods = rawLab.auth;
        this.users = {};
        this.userCollection = this.database.collection('_users');
        this.io = socketIO.of(`/${rawLab.id}`);
        this.io.use(this.ioMiddleware.bind(this));
        this.io.on('connection', this.onConnection.bind(this));
        this.allowOrigins = rawLab.allowOrigins || ['http://localhost:8080', 'http://localhost:9966'];
        this.beakers = rawLab.beakers.map(beakerId => {
            console.log(`        beaker id: ${beakerId}`);

            let collection = this.database.collection(beakerId);

            return {
                id: beakerId,
                rule: rules[beakerId] || {}
            }
        });
        this.beakerIdlist = this.beakers.map( beaker => beaker.id);
        this.changeStreams = {};
    }
    async ioMiddleware(socket, next) {
        console.log('middleware!!');
        if (socket.handshake.query.apiKey !== this.apiKey) {
            return next(new Error('API Key is not matched'));
        }

        if (!this.allowOrigins.includes(socket.handshake.headers.origin)) {
            return next(new Error('lab origin not allowed'));
        }

        let sessionId = socket.handshake.query.sessionId;
        if (sessionId) {
            /* TODO: find session table instead */
            try {
                socket.user = await this.userCollection.findOne({ _id: sessionId });
                if (user.expiredAt && user.expiredAt < Date.now()) {
                    socket.user = undefined;
                }
            } catch (err) {
                return next(err);
            }
        }
        next();
    }
    onConnection(socket) {
        console.log('onConnection! ' + socket.id);
        socket.on('register', this.register.bind(this, socket));
        socket.on('login', this.login.bind(this, socket));
        socket.on('logout', this.logout.bind(this, socket));
        socket.on('create', this.create.bind(this, socket));
        socket.on('find', this.find.bind(this, socket));
        socket.on('get', this.get.bind(this, socket))
        socket.on('update', this.update.bind(this, socket));
        socket.on('subscribe', this.subscribe.bind(this, socket));
        socket.on('unsubscribe', this.unsubscribe.bind(this, socket));
        socket.on('disconnect', this.onDisconnect.bind(this, socket));
    }
    onDisconnect(socket, reason) {
        console.log('on disconnect', socket);
        if (socket.changeStreams && socket.notifyHandlers) {
            let changeStream = socket.changeStreams.get(0);
            let handler = socket.notifyHandlers.get(0);
            if (changeStream && handler) {
                changeStream.removeListener('change', handler);
                console.log('remove listener');
            }
        }
        delete socket.notifyHandlers;
    }
    register() {

    }
    async login(socket, data, cb) {
        console.log('login!');
        if (typeof this.authMethods[data.method] === 'undefined') {
            return cb({ error: true, reason: 'authentication method is unsupported' })
        }
        let user;
        switch (data.method) {
            case 'email':
                user = await this.userCollection.findOne({ email: data.email });
                if (!user) return cb({ error: true, reason: 'user not found' });

                let isMatch = await bcrypt.compare(user.password, data.bassword);
                if (!isMatch) return cb({ error: true, reason: 'incorrect password' });

                socket.user = user;
                this.users[socket.id] = user._id;
                break;
            case 'ldap':
                user = await this.userCollection.findOne({ ldapUser: data.user });
                if (!user) return cb({ error: true, reason: 'ldap user not found' });

                socket.user = user;
                this.users[socket.id] = user._id;
            default:
                cb({ error: true, reason: 'authentication method is under development' });
                break;
        }
    }
    logout(socket) {
        delete socket.user;
    }
    checkRequest(request) {
        if (request && request.beakerId && !this.beakerIdlist.includes(request.beakerId)) {
            throw new Error('You do not has access to this beaker');
        }
    }
    async create(socket, request, cb) {
        try {
            this.checkRequest(request);
            /* TODO: rule validation */
            let collection = this.database.collection(request.beakerId);
            let compound = BSON.deserialize(Buffer.from(request.data));
            let response = await collection.insertOne(compound); /* insertOne has no raw option */
            if (response.result.n === 0) {
                throw new Error('Create compound failed. Write conflict?');
            }
            cb({
                error: false,
                data: BSON.serialize(response.ops[0]) /* so we need to serialize it */
            });
        } catch (err) {
            cb({ error: err });
        }
    }
    async find(socket, query, cb) {
        try {
            this.checkRequest(query);
            /* TODO: rule validation */
            let collection = this.database.collection(query.beakerId);
            query.options.raw = true;
            let result = await collection.find(BSON.deserialize(Buffer.from(query.condition)), query.options).toArray();

            cb({
                error: false,
                data: result
            });
        } catch (err) {
            cb({ error: err });
        }
    }
    async get(socket, request, cb) {
        try {
            this.checkRequest(request);
            let collection = this.database.collection(request.beakerId);
            let compound = await collection.findOne({ _id: ObjectID.createFromHexString(request._id) }, { raw: true });
            if (!compound) throw new Error('Compound does not exist');

            /* TODO: rule validation */
            cb({
                error: false,
                data: compound
            });
        } catch (err) {
            cb({ error: err });
        }
    }
    async update(socket, request, cb) {
        try {
            this.checkRequest(request);
            let collection = this.database.collection(request.beakerId);
            let queryById = { _id: ObjectID.createFromHexString(request._id) };
            let compound = await collection.findOne(queryById);
            if (!compound) throw new Error('Compound does not exist');

            /* TODO: rule validation & replace option */

            let update = {
                $set: BSON.deserialize(Buffer.from(request.data)) || {}
            };

            if (typeof compound.__version === 'number') {
                queryById.__version = compound.__version;
                update.$inc = { __version: 1 };
            } else {
                update.$set.__version = 0;
            }

            let response = await collection.updateOne(queryById, update, { upsert: false })

            console.error(response);
            if (response.result.n === 0) {
                throw new Error('Compound does not exist or have write conflict');
            }
            cb({
                error: false,
                data: response.result
            });
        } catch (err) {
            cb({ error: err });
        }
    }
    subscribe(socket, query, cb) {
        /* TODO: rule validation */
        this.checkRequest(query);
        const changeStream = this.getChangeStream(query.beakerId, query.condition)

        if (!changeStream.notifyHandlers) {
            changeStream.notifyHandlers = new Map();
        }

        const subscriptionId = changeStream.uniqueCounter ? ++changeStream.uniqueCounter : 0;

        let handler = (changeData) => {
            socket.emit('change' + subscriptionId, changeData);
        }

        changeStream.notifyHandlers.set(subscriptionId, handler);

        if (!changeStream.output) changeStream.output = [];
        changeStream.output.push(handler);


        changeStream.on('close', () => {
            socket.notifyHandlers.delete(subscriptionId);
        });
        cb({
            error: false, data: {
                subscriptionId: subscriptionId
            }
        });
    }
    unsubscribe(socket, request, cb) {
        try {
            this.this.checkRequest(request);
            const handler = socket.notifyHandlers.get(request.subscriptionId);
            if (!handler) throw new Error('Invalid subscription id');
            const stream = socket.changeStreams.get(request.subscriptionId);
            if (!stream) throw new Error('Invalid subscription id');

            stream.removeListener('change', handler);
            cb({ error: false });
        } catch (err) {
            cb({ error: err });
        }
    }
    getChangeStream(beakerId, condition) {
        const key = beakerId + JSON.stringify(condition);
        let changeStream = this.changeStreams[key];

        if (!changeStream) {
            const pipeline = { $match: condition };
            const options = {
                updateLookup: 'updateLookup'
            };
            
            changeStream = this.database.collection(beakerId).watch(pipeline, options);

            this.changeStreams[key] = changeStream;

            console.log(changeStream);
            changeStream.on('change', (changeData) => {
                if (changeData.operationType === 'update' && changeData.updateDescription.removedFields.length === 0) {
                    let fields = Object.keys(changeData.updateDescription.updatedFields);
                    if (fields.length === 1 && fields[0] === '__version') return;
                }
                let changeDataRaw = BSON.serialize(changeData);

                changeStream.output.forEach(output => {
                    setImmediate(() => output(changeDataRaw));
                });
            })
            changeStream.on('error', (err) => {
                console.error(err);
            });
            changeStream.on('close', () => {
                delete this.changeStreams[key];
            })
            //changeStream.setMaxListeners(1000);
        }
        return changeStream;
    }
}

module.exports = Lab;