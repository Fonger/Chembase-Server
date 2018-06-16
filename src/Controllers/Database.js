const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017/?replicaSet=mongo-repl';
const mainDBName = 'main';
const options = { poolSize: 1000 };

let _mongoClient;

async function init() {
    _mongoClient = await MongoClient.connect(url, options);
    return _mongoClient;
}

module.exports = {
    init: init,
    get MongoClient() {
        return _mongoClient;
    },
    get MainDB() {
        return _mongoClient.db(mainDBName);
    }
}
