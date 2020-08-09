const {MongoError, ObjectId} = require("mongodb");
const {db} = require("./db-utils.js");
const {verifyToken} = require("./auth.js");
const router = require("express").Router();

router.post("/v1/games", async (req, res) => {
	try{
		const {auth, claims} = await verifyToken(req.get("x-access-token"), res);
		if(auth){
			const {title, editors, isPrivate, tags, interval, board} = req.body;
			if(typeof title !== "string")
				return res.status(400).json({error: "title must be a string"})
			const {insertedId} = await (await db).collection("games").insertOne({
				title,
				editors: (editors || []).push(claims.id),
				isPrivate: isPrivate || false,
				tags: tags || [],
				interval: interval || 100,
				board: board || {}
			});
			await (await db).collection("users").updateOne(
				{_id: ObjectId(claims.id)},
				{$push: {games: insertedId}}
			);
			res.status(200).json({id: insertedId.valueOf()});
		}
	}
	catch(err){
		if(err instanceof MongoError && err.code == 121)
			res.status(400).json({error: "Invalid data"});
		else{
			console.error("Error here: ", err);
			res.status(503).json({error: "Error creating game"});
		}
	}
});

module.exports = router;