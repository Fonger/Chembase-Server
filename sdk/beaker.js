var Query = require('./cquery');
var Compound = require('./compound');
var EJSON = require('mongodb-extended-json');
var BSON = require('bson');
var bson = new BSON();

function Beaker(lab, beakerId) {
    if (!(this instanceof Beaker))
        return new Beaker(lab, beakerId);
    if (!lab || lab.constructor.name !== 'Lab')
        throw new TypeError('Must specify a valid lab');
    if (!beakerId)
        throw new Error('Must specify beaker id');

    this.beakerId = beakerId;
    this._lab = lab;
    this._subscriptionId = undefined;
    this._changeHandler = undefined;
    Query.call(this);
}

/*!
 * inherit cquery
 */

Beaker.prototype = Object.create(Query.prototype);
Beaker.prototype.constructor = Beaker;



/**
 * Create a compound with given object.
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.create({ name: 'Jennifer', age: 23 })
 *     query.create({ name: 'Jennifer', age: 23 }', callback)
 *
 * @param {Object} data compound data
 * @param {Function} [callback]
 * @return {Promise<Compound>} compound
 * @api public
 */

Beaker.prototype.create = function (data, callback) {
    var self = this;

    var request = {
        beakerId: this.beakerId,
        data: bson.serialize(data)
    }
    var promise = new Promise(function (resolve, reject) {
        self._lab.socket.emit('create', request, function (result) {
            if (result.error) return reject(result.error)
            if (!result.data) return reject(new Error('This compound no longer exist'));
            var compound = new Compound(self, result.data);
            resolve(compound);
        });
    });

    if (callback) {
        return promise.then(function (result) {
            callback(null, result)
        }, function (err) {
            callback(err);
        });
    }
    return promise;
}

/**
 * Find compounds.
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.find()
 *     query.find(callback)
 *
 * @param {Object} [criteria] mongodb selector
 * @param {Function} [callback]
 * @return {Query} this
 * @api public
 */

Beaker.prototype.find = function (callback) {
    this.op = 'find';

    if (!callback) return this;


    var query = {
        beakerId: this.beakerId,
        condition: bson.serialize(this._conditions),
        options: this.options
    };
    var self = this;
    this._lab.socket.emit('find', query, function (result) {
        if (result.error) return callback(result.error);
        if (!result.data) return callback(new Error('No data'));

        var compounds = result.data.map(function (doc) {
            return new Compound(self, doc);
        });
        callback(null, compounds);
    });

    return this;
}

/**
 * Get a compound with given id.
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.get('myid')
 *     query.get('myid', callback)
 *
 * @param {String} id compound id
 * @param {Function} [callback]
 * @return {Promise<Compound>} compound
 * @api public
 */

Beaker.prototype.get = function (id, callback) {
    var self = this;

    var request = {
        beakerId: this.beakerId,
        _id: id
    }
    var promise = new Promise(function (resolve, reject) {
        self._lab.socket.emit('get', request, function (result) {
            if (result.error) return reject(result.error)
            if (!result.data) return reject(new Error('This compound no longer exist'));
            var compound = new Compound(self, result.data);
            resolve(compound);
        });
    });

    if (callback) {
        return promise.then(function (result) {
            callback(null, result)
        }, function (err) {
            callback(err);
        });
    }
    return promise;
}

/**
 * Executes the query returning a `Promise` which will be
 * resolved with either the molecular(s) or rejected with the error.
 *
 * @param {Function} [resolve]
 * @param {Function} [reject]
 * @return {Promise}
 * @api public
 */

Beaker.prototype.then = function (resolve, reject) {
    if (!this.op) throw new Error('No operation specify.')
    var self = this;
    var promise = new Promise(function (success, fail) {
        self[self.op](function (err, result) {
            if (err) return fail(err);
            success(result);
        });
        self = null;
    });
    return promise.then(resolve, reject);
}

/**
 * subscribe query compounds
 *
 * Passing a `callback` executes the query.
 *
 * ####Example
 *
 *     query.subscribe(callback)
 *
 * @param {Function} callback change event callback
 * @return {Promise<SubscriptionResult>} return a promise resolved with SubscriptionResult
 * @api public
 */

Beaker.prototype.subscribe = function (callback) {
    if (!callback) throw new Error('Must have a callback');
    if (this._subscriptionId) throw new Error('This beaker has a subscription already. Only one subscription per beaker is allowed.')

    var query = {
        beakerId: this.beakerId,
        condition: this._conditions,
    };

    var self = this;

    var promise = new Promise(function (resolve, reject) {
        self._lab.socket.emit('subscribe', query, function (result) {
            if (result.error) throw new Error(result.error);
            if (!result.data) throw new Error('No data');
            self._subscriptionId = result.data.subscriptionId;
            self._changeHandler = function(change) {
                callback(bson.deserialize(Buffer.from(change)));
            }
            self._lab.socket.on('change' + self._subscriptionId, self._changeHandler);
            resolve(result.data);
        });
    });

    return promise;
}

Beaker.prototype.unsubscribe = function (callback) {
    if (typeof this._subscriptionId === 'undefined') throw new Error('This beaker does not have a subscription');

    if (!callback) return this;

    this.op = 'unsubscribe';

    var request = {
        beakerId: this.beakerId,
        subscriptionId: this._subscriptionId
    };

    var self = this;
    self._lab.socket.removeListener('change' + self._subscriptionId, self._changeHandler);
    self._subscriptionId = undefined;

    var promise = new Promise(function (resolve, reject) {
        self._lab.socket.emit('unsubscribe', request, function (result) {
            if (result.error) throw reject(result.error);
            resolve(result.data);
        });
    });

    return this;
}

module.exports = Beaker;