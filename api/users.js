const {MongoError, ObjectId} = require("mongodb");
const {db, searchCollection} = require("./db-utils");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {verifyToken, check2FA, set2FA, unset2FA} = require("./auth.js");
const {otpauthURL} = require("speakeasy");
const router = require("express").Router();

const hashRounds = 12;
const jwtSecret = process.env.JWT_SECRET

router.post("/v1/users", async (req, res) => {
	const {username, password} = req.body;
	if(typeof username !== "string" || typeof password != "string"){
		res.status(400).json({
			error: "Username and password must both be strings"
		});
		return;
	}
	const hash = bcrypt.hash(password, hashRounds);
	const col = (await db).collection("users");
	try{
		await col.insertOne({
			username,
			passwordHash: await hash,
			games: []
		});
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
		res.status(400).json({
			error: "Username and password must both be strings"
		});
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
		const user = await (await db).collection("users")
			.findOne({username: req.params.user});
		if(user === null){
			return res.status(404).end();
		}
		const token = req.get("x-access-token");
		if(token){
			const {auth} = await verifyToken(token, res,
				{message: "Invalid Credentials", ids: [user._id.toString()]});
			if(auth) res.status(200).json({
				id: user._id.valueOf(),
				username: user.username,
				games: user.games,
				otpauth_url: user.otpauth ? otpauthURL({
					secret: await set2FA(user._id),
					label: req.params.user,
					issuer: "Quiz Game"
				}) : undefined
			});
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
	try{
		const user = await (await db).collection("users")
			.findOne({username: req.params.user});
		if(user === null) return res.status(404).end();
		const {auth} = await verifyToken(req.get("x-access-token"), res,
			{message: "Cannot edit another user", ids: [user._id.toString()]});
		if(auth){
			if(req.body.username && typeof req.body.username !== "string")
				return res.status(400).json({error: "Invalid request data"});
			let resp = {id: user._id};
			if(req.body.password)
				resp.warning = "Ignored request to change password";
			await (await db).collection("users").updateOne(
				{_id: user._id},
				{$set: {username: req.body.username}},
				{ignoreUndefined: true}
			);
			if(req.body.username)
				resp.username = req.body.username;
			res.status(200).json(resp);
		}
	}
	catch(err){
		if(err instanceof MongoError && err.code == 11000){
			res.status(409).json({error: "Requested username is in use"});
		}
		else if(err instanceof MongoError){
			res.status(503).json({
				error: "Database error or invalid request data"
			});
		}
		else{
			res.status(503).json({error: "Error updating user"});
		}
	}
});


router.delete("/v1/users/:user", async (req, res) => {
	try{
		const user = await (await db).collection("users")
			.findOne({username: req.params.user});
		if(user === null) return res.status(404).end();
		const {auth} = await verifyToken(req.get("x-access-token"), res,
			{message: "Cannot delete another user", ids: [user._id.toString()]});
		if(user){
			await (await db).collection("users").deleteOne({_id: user._id});
			res.status(204).end();
		}
	}
	catch{
		res.status(503).json({error: "Could not delete user"});
	}
});

router.post("/v1/users/:user/password", async (req, res) => {
	try{
		if(req.body.code && req.body.password){
			const {auth, error} = await check2FA(req.params.user, req.body.code);
			if(!auth) return res.status(401).json({error});
			const hash = bcrypt.hash(req.body.password, hashRounds);
			await (await db).collection("users").updateOne(
				{_id: user._id},
				{$set: {passwordHash: await hash}}
			);
			res.status(200).json({message: "Updated password"});
		}
		else{
			res.status(400).json({error: "Code and new password are required"});
		}
	}
	catch(err){
		if(err instanceof MongoError)
			res.status(503).json({error: "Error accessing database"});
		else{
			res.status(503).json({error: "Error with 2FA procedure"});
		}
	}
});

router.get("/v1/users", async (req, res) => {
	try{
		let {page=1, perPage=20, q="", regex=false, opts=""} = req.query;
		page = parseInt(page);
		perPage = parseInt(perPage);
		if(typeof q !== "string")
			return res.status(400).json({error: "Query (q) must be a string"});
		if(typeof opts !== "string")
			return res.status(400).json({error: "opts must be a string"});
		if(isNaN(page) || isNaN(perPage))
			return res.status(400).json({error: "page and perPage must be ints"});
		if(page < 1 || perPage < 1)
			return res.status(400).json({error: "Non-positive page or perPage"});
		regex = regex && regex !== "0" && regex !== "false";
		const query = regex ? {$regex: q, $options: opts} :
			{$regex: `(${q.split(/\W+/).join('|')})`, $options: "i"};
		const {result: users, ...data} = await searchCollection(
			"users",
			{username: query},
			{projection: {username: true}, page, perPage}
		);
		res.status(200).json({users, ...data});
	}
	catch{
		res.status(503).json({error: "Could not fetch users"});
	}
});

router.post("/v1/users/:user/2fa", async (req, res) => {
	try{
		const user = await (await db).collection("users")
			.findOne({username: req.params.user});
		if(user === null) return res.status(404).end();
		const {auth} = await verifyToken(req.get("x-access-token"), res,
			{message: "Cannot edit another user", ids: [user._id.toString()]});
		if(auth){
			const otpauth_url = otpauthURL({
				secret: await set2FA(user._id),
				label: req.params.user,
				issuer: "Quiz Game"
			});
			res.status(200).json({otpauth_url});
		}
	}
	catch(err){
		if(err instanceof MongoError)
			res.status(503).json({error: "Error accessing database"});
		else
			res.status(503).json({error: "Error enabling 2FA"});
	}
});

router.delete("/v1/users/:user/2fa", async (req, res) => {
	try{
		const user = await (await db).collection("users")
			.findOne({username: req.params.user});
		if(user === null) return res.status(404).end();
		const {auth} = await verifyToken(req.get("x-access-token"), res,
			{message: "Cannot edit another user", ids: [user._id.toString()]});
		if(auth){
			await unset2FA(user);
			res.status(204).send();
		}
	}
	catch(err){
		if(err instanceof MongoError)
			res.status(503).json({error: "Error accessing database"});
		else
			res.status(503).json({error: "Error enabling 2FA"});
	}
});

module.exports = router;