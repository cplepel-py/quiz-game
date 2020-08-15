const {MongoError, ObjectId} = require("mongodb");
const {db} = require("./db-utils.js");
const {verifyToken} = require("./auth.js");
const router = require("express").Router();

function verifyBoard(board){
	let length = undefined;
	for(let [k, cat] in Object.entries(board)){
		if(typeof k !== "string")
			throw new TypeError("All board keys (category names) must be strings");
		if(!Array.isArray(cat))
			throw new TypeError("Each category must be an array of questions");
		if(length === undefined)
			length = cat.length
		else if(length !== cat.length)
			throw new TypeError("Each category must have the same number of questions");
		if(cat.some(q => 
			typeof q.question !== "string" || typeof q.answer !== "string"
		)) throw new TypeError("Each question have string question and answers");
	}
	return length;
}

function parseGame({
		title,
		editors=[],
		isPrivate=false,
		tags=[],
		interval=100,
		board={},
		owner
	}={}){
	if(typeof title !== "string")
		throw new TypeError("title must be a string and is required");
	if(typeof owner !== "string")
		throw new TypeError("owner must be a string and is required");
	if(!Array.isArray(editors) || editors.some(e => !/^[a-f0-9]{24}$/i.test(e)))
		throw new TypeError("editors must be an array of user ids");
	if(typeof isPrivate !== "boolean")
		throw new TypeError("isPrivate must be a boolean");
	if(!Array.isArray(tags) || !tags.every(e => typeof e === "string"))
		throw new TypeError("tags must be an array of strings");
	if(typeof interval !== "number")
		throw new TypeError("interval must be a number");
	if(typeof board !== "object" || board === null)
		throw new TypeError("board must be a non-null object");
	verifyBoard(board);
	return {title, editors, isPrivate, tags, interval, board, owner};
}

router.post("/v1/games", async (req, res) => {
	try{
		const {auth, claims} = await verifyToken(req.get("x-access-token"), res);
		if(auth){
			req.body.owner = req.body.owner || claims.id;
			const game = parseGame(req.body);
			game.editors.push(claims.id);
			const {insertedId} = await (await db).collection("games")
				.insertOne(game);
			await (await db).collection("users").updateOne(
				{_id: ObjectId(claims.id)},
				{$addToSet: {games: insertedId}}
			);
			res.status(200).json({id: insertedId.valueOf()});
		}
	}
	catch(err){
		if(err instanceof MongoError && err.code == 121)
			res.status(400).json({error: "Invalid data"});
		else if(err instanceof TypeError)
			res.status(400).json({error: err.message});
		else
			res.status(503).json({error: "Error creating game"});
	}
});

router.put("/v1/games/:game([a-f0-9]{24})", async (req, res) => {
	try{
		const _id = ObjectId(req.params.game);
		const old = await (await db).collection("games").findOne({_id});
		if(old === null) return res.status(404).end();
		const {auth} = await verifyToken(req.get("x-access-token"), res,
			{ids: [old.owner, ...old.editors]});
		if(auth){
			const game = parseGame(req.body);
			await (await db).collection("games").replaceOne({_id}, game);
			res.status(200).json({game});
		}
	}
	catch(err){
		if(err instanceof MongoError && err.code == 121)
			res.status(400).json({error: "Invalid data"});
		else if(err instanceof TypeError)
			res.status(400).json({error: err.message});
		else
			res.status(503).json({error: "Error updating game"});
	}
});

router.get("/v1/games/:game([a-f0-9]{24})", async (req, res) => {
	try{
		const game = await (await db).collection("games")
			.findOne({_id: ObjectId(req.params.game)});
		if(game === null) return res.status(404).end();
		const auth = !game.isPrivate || (await verifyToken(
			req.get("x-access-token"), res, {ids: [game.owner, ...game.editors]}
		)).auth;
		if(auth) res.status(200).json(game);
	}
	catch{
		res.status(503).json({error: "Encountered an unexpected error"});
	}
});

router.delete("/v1/games/:game([a-f0-9]{24})", async (req, res) => {
	try{
		const _id = ObjectId(req.params.game);
		const game = await (await db).collection("games").findOne({_id});
		if(game === null) return res.status(404).end();
		const {auth} = await verifyToken(req.get("x-access-token"), res,
			{ids: [game.owner, ...game.editors]});
		if(auth){
			await (await db).collection("games").deleteOne({_id});
			res.status(204).end();
		}
	}
	catch(err){
		res.status(503).json({error: "Could not delete game"});
	}
});

router.get("/v1/games", async (req, res) => {
	try{
		let {page=1, perPage=20, tags=[]} = req.query;
		page = parseInt(page);
		perPage = parseInt(perPage);
		if(isNaN(page) || isNaN(perPage))
			return res.status(400).json({error: "page and perPage must be ints"});
		if(page < 1 || perPage < 1)
			return res.status(400).json({error: "Non-positive page or perPage"});
		if(typeof tags === "string") tags = [tags];
		if(!Array.isArray(tags) || tags.some(e => typeof e !== "string"))
			return res.status(400).json({error: "tags must be a string array"});
		const token = req.get("x-access-token");
		const access = {$or: [{isPrivate: false}]};
		if(token){
			const {auth, claims} = await verifyToken(token, res);
			if(!auth) return;
			access.$or.push({editors: claims.id});
		}
		query = {$and: [access, {$or: tags.map(tag => ({tags: tag}))}]};
		const cursor = await (await db).collection("games").find(query)
			.project({
				title: true,
				editors: true,
				tags: true
			});
		const count = cursor.count();
		const games = cursor.skip(perPage*(page-1)).limit(perPage).map(game => {
			const {_id, ...data} = game;
			return {id: _id.toString(), ...data};
		}).toArray();
		const pages = Math.ceil(await count / perPage);
		res.status(200).json({games: await games, total: await count, pages});
	}
	catch(err){
		res.status(503).json({error: "Could not fetch games"});
	}
});

module.exports = router;