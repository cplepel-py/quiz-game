const MongoError = require("mongodb").MongoError;
const {db} = require("./db-utils");
const express = require("express");
const bcrypt = require("bcrypt");

const router = express.Router();
router.use(express.json());

const hashRounds = 12;

router.post("/v1/users", async (req, res) => {
	const {username, password} = req.body;
	if(!(username && password)){
		res.status(400).json({error: "Missing username or password"});
		return;
	}
	const hash = bcrypt.hash(password, hashRounds);
	const col = (await db).collection("users");
	try{
		await col.insertOne({username, passwordHash: await hash, games: []});
	}
	catch(err){
		if(err instanceof MongoError){
			res.status(409).json({error: "User already exists"});
			return;
		}
	}
	res.status(201).end();
});

module.exports = router;