const {MongoClient} = require("mongodb");
const dbUser = encodeURIComponent(process.env.DB_USER);
const dbPass = encodeURIComponent(process.env.DB_PASS);
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.NODE_ENV === "test" ? (process.env.TEST_DB || process.env.DB_NAME) : process.env.DB_NAME;
const client = new MongoClient(`mongodb://${dbUser}:${dbPass}@${dbHost}:${dbPort}`, {useUnifiedTopology: true});
const conn = client.connect();
const db = conn.then(() => client.db(dbName));

async function searchCollection(
		collection,
		query,
		{projection={}, page=1, perPage=0}={}){
	if(page < 0 || perPage < 0) throw ValueError("page and perPage must be >= 0");
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

module.exports = {db, conn, searchCollection};