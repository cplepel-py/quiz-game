process.env.NODE_ENV = "test";

async function clearCollection(col){
	await (await require("../api/db-utils").db).collection(col).deleteMany({});
}

function mockDbUtils(){
	const {MongoMemoryServer} = require("mongodb-memory-server");
	const {MongoClient} = require("mongodb");
	const server = new MongoMemoryServer();
	const clientPromise = server.getUri().then(uri => {return new MongoClient(uri, {useUnifiedTopology: true})});
	const conn = (async () => {
		client = await clientPromise;
		return await client.connect();
	})();
	const dbName = process.env.TEST_DB || process.env.DB_NAME;
	const db = conn.then(client => {
		const _db = client.db(dbName);
		_db.collection("users").createIndex({username: 1}, {unique: true});
		return _db;
	});
	return {db, conn, _server: server};
}

module.exports = {clearCollection, mockDbUtils};