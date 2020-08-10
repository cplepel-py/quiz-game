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
		board={}
	}={}){
	if(typeof title !== "string")
		throw new TypeError("title must be a string and is required");
	if(!Array.isArray(editors) ||
	   !editors.every(e => (/^[a-zA-Z0-9]{24}$/.test(e))))
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
	return {title, editors, isPrivate, tags, interval, board};
}

router.post("/v1/games", async (req, res) => {
	try{
		const {auth, claims} = await verifyToken(req.get("x-access-token"), res);
		if(auth){
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
		else if(err instanceof TypeError){
			res.status(400).json({error: err.message});
		}
		else{
			res.status(503).json({error: "Error creating game"});
		}
	}
});

router.put("/v1/games/:game([a-zA-Z0-9]{24})", async (req, res) => {
	try{
		const old = await (await db).collection("games")
			.findOne({_id: ObjectId(req.params.game)});
		if(old === null) return res.status(404).end();
		const {auth, claims} = await verifyToken(req.get("x-access-token"), res,
			{ids: old.editors});
		if(auth){
			const game = parseGame(req.body);
			if(game.editors.length < 1) return res.status(400).json({
				error: "Game must have at least one editor"
			});
			res.status(200).json({game});
		}
	}
	catch(err){
		if(err instanceof MongoError && err.code == 121)
			res.status(400).json({error: "Invalid data"});
		else if(err instanceof TypeError){
			res.status(400).json({error: err.message});
		}
		else
			res.status(503).json({error: "Error updating game"});
	}
});

module.exports = router;