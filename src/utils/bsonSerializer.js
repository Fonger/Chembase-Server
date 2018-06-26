const BSON = require('bson-ext');

const bsonSerializer = new BSON([
    BSON.Binary,
    BSON.Code,
    BSON.DBRef,
    BSON.Decimal128,
    BSON.Double,
    BSON.Int32,
    BSON.Long,
    BSON.Map,
    BSON.MaxKey,
    BSON.MinKey,
    BSON.ObjectId,
    BSON.BSONRegExp,
    BSON.Symbol,
    BSON.Timestamp
]);

// export all the properties from BSON. so that we can have BSON.ObjectId, BSON.Long ... etc
Object.keys(BSON).forEach(typeName => bsonSerializer[typeName] = BSON[typeName]);

module.exports = bsonSerializer;
