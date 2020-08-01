const MongoError = require("mongodb").MongoError;
const {db} = require("./db-utils");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();
router.use(express.json());

const hashRounds = 12;
const jwtSecret = process.env.JWT_SECRET

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

router.post("/v1/login", async (req, res) => {
	const {username, password} = req.body;
	if(typeof username !== "string" || typeof password !== "string"){
		res.status(400).json({error: "Username and password must both be supplied and both be strings"});
		return;
	}
	try{
		const user = await (await db).collection("users").findOne({username});
		if(user === null){
			res.status(401).json({error: "Incorrect username or password"});
		}
		else if(await bcrypt.compare(password, user.passwordHash)){
			res.status(200).json({
				token: jwt.sign(
					{id: user._id.valueOf()},
					jwtSecret,
					{expiresIn: "1d"}
				)
			});
		}
		else{
			res.status(401).json({error: "Incorrect username or password"});
		}
	}
	catch(err){
		console.error("Error here: ", err);
		res.status(503).json({error: "Error verifying credentials"});
	}
});

module.exports = router;