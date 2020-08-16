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
	async function searchCollection(
			collection,
			query,
			{projection={}, page=1, perPage=0}={}){
		if(page < 0 || perPage < 0)
			throw ValueError("page and perPage must be >= 0");
		const cursor = await (await db).collection(collection).find(query)
			.project(projection);
		const count = cursor.count();
		const result = cursor.skip((page-1)*perPage).limit(perPage).map(game => {
			const {_id, ...data} = game;
			return {id: _id.toString(), ...data};
		}).toArray();
		const pages = perPage ? Math.ceil(await count / perPage) : 1
		return {pages, total: await count, result: await result};
	}
	return {db, conn, _server: server, searchCollection};
}

module.exports = {clearCollection, mockDbUtils};