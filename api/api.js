const {MongoError, ObjectId} = require("mongodb");
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
	catch{
		res.status(503).json({error: "Error verifying credentials"});
	}
});

router.get("/v1/users/:user", async (req, res) => {
	try{
		const user = await (await db).collection("users").findOne({username: req.params.user});
		if(user === null){
			res.status(404).end();
		}
		else{
			res.json({
				id: user._id.valueOf(),
				username: user.username,
				games: user.games});
		}
	}
	catch{
		res.status(503).json({error: "Error retrieving user"});
	}
});

router.put("/v1/users/:user", async (req, res) => {
	const token = req.get("x-access-token");
	if(!token) return res.status(401).json({error: "Invalid token"});
	try{
		const {id} = jwt.verify(token, jwtSecret);
		const col = (await db).collection("users");
		const user = await col.findOne({username: req.params.user});
		if(user === null){
			res.status(404).end();
		}
		else if(typeof req.body.username !== "string" && typeof req.body.username !== "undefined"){
			res.status(400).json({error: "Invalid request data"});
		}
		else if(ObjectId(id).equals(user._id)){
			const resp = {}
			if(req.body.password) resp.warning = "Ignored request to change password";
			await col.updateOne(
				{_id: user._id, username: req.params.user},
				{$set: {username: req.body.username}},
				{ignoreUndefined: true});
			resp.id = id;
			resp.username = req.body.username || user.username;
			res.status(200).json(resp);
		}
		else{
			res.status(403).json({error: "Cannot edit another user"});
		}
	}
	catch(err){
		if(err instanceof jwt.JsonWebTokenError){
			res.status(401).json({error: err.message});
		}
		else if(err instanceof MongoError && err.code == 11000){
			res.status(409).json({error: "Requested username is in use"});
		}
		else if(err instanceof MongoError && err.code == 121){
			res.status(400).json({error: "Invalid request data"});
		}
		else{
			res.status(503).json({error: "Error editing user"});
		}
	}
});


router.delete("/v1/users/:user", async (req, res) => {
	const token = req.get("x-access-token");
	if(!token) return res.status(401).json({error: "Invalid token"});
	try{
		const {id} = jwt.verify(token, jwtSecret);
		const col = (await db).collection("users");
		const user = await col.findOne({username: req.params.user});
		if(user === null){
			res.status(404).end();
		}
		else if(ObjectId(id).equals(user._id)){
			const r = await col.deleteOne({username: req.params.user, _id: ObjectId(id)});
			res.status(204).end();
		}
		else{
			res.status(403).json({error: "Cannot delete another user"});
		}
	}
	catch(err){
		if(err instanceof jwt.JsonWebTokenError){
			res.status(401).json({error: err.message});
		}
		else{
			res.status(503).json({error: "Error deleting user"});
		}
	}
});

module.exports = router;