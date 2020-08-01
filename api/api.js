const MongoError = require("mongodb").MongoError;
const {db} = require("./db-utils");
const express = require("express");
const bcrypt = require("bcrypt");

const router = express.Router();
router.use(express.json());

const hashRounds = 12;

router.post("/v1/users", async (req, res) => {
	const {username, password} = req.body;
	if(typeof username !== "string" || typeof password != "string"){
		res.status(400).json({error: "Username and password must both be supplied and both be strings"});
		return;
	}
	const hash = bcrypt.hash(password, hashRounds);
	const col = (await db).collection("users");
	try{
		await col.insertOne({username, passwordHash: await hash, games: []});
	}
	catch(err){
		if(err instanceof MongoError && err.code == 11000){
			res.status(409).json({error: "User already exists"});
		}
		else if(err instanceof MongoError && err.code == 121){
			res.status(400).json({error: "Invalid username or password"});
		}
		else{
			res.status(503).json({error: "Error creating user"});
		}
		return;
	}
	res.status(201).json({username, games: []});
});

module.exports = router;