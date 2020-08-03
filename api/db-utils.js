const {MongoClient} = require("mongodb");
const dbUser = encodeURIComponent(process.env.DB_USER);
const dbPass = encodeURIComponent(process.env.DB_PASS);
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.NODE_ENV === "test" ? (process.env.TEST_DB || process.env.DB_NAME) : process.env.DB_NAME;
const client = new MongoClient(`mongodb://${dbUser}:${dbPass}@${dbHost}:${dbPort}`, {useUnifiedTopology: true});
const conn = client.connect();
const db = conn.then(() => client.db(dbName));

module.exports = {db, conn};