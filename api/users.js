const {MongoError, ObjectId} = require("mongodb");
const {db} = require("./db-utils");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {sendSMS, authenticateCode, SMSError, AuthenticationError} =
	require("./2fa.js");
const router = require("express").Router();

const hashRounds = 12;
const jwtSecret = process.env.JWT_SECRET

router.post("/v1/users", async (req, res) => {
	const {username, password, number} = req.body;
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
			games: [],
			request_id: {},
			number
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

async function verifyToken(req, res, {hide=false, message="Unauthorized"}={}){
	const token = req.get("x-access-token");
	if(!token){
		res.status(401).json({error: "Invalid token"});
		return {auth: false, found: null};
	}
	try{
		const user = (await db).collection("users")
			.findOne({username: req.params.user});
		const claims = jwt.verify(token, jwtSecret);
		if(await user === null){
			res.status(404).end();
			return {auth: null, found: false};
		}
		else if(ObjectId((await claims).id).equals((await user)._id)){
			return {
				auth: true,
				found: true,
				claims: await claims,
				user: await user
			};
		}
		else if(hide){
			res.status(404).end();
			return {auth: false, found: true};
		}
		else{
			res.status(403).json({error: message});
			return {auth: false, found: true};
		}
	}
	catch(err){
		if(err instanceof jwt.JsonWebTokenError){
			res.status(401).json({error: err.message});
			return {auth: false, found: null}
		}
		throw err;
	}
}

router.put("/v1/users/:user", async (req, res) => {
	try{
		const {user} = await verifyToken(req, res,
			{message: "Cannot edit another user"});
		if(user){
			if(req.body.username && typeof req.body.username !== "string")
				return res.status(400).json({error: "Invalid request data"});
			let resp = {id: user._id.valueOf()};
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
		const {user} = await verifyToken(req, res,
			{message: "Cannot delete another user"});
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
		const {user} = await verifyToken(req, res,
			{message: "Cannot change the password of another user"});
		if(user && req.body.code && req.body.password){
			await authenticateCode(user._id, req.body.code, "password");
			const hash = bcrypt.hash(req.body.password, hashRounds);
			await (await db).collection("users").updateOne(
				{_id: user._id},
				{$set: {passwordHash: await hash}}
			);
			res.status(200).json({message: "Updated password"});
		}
		else if(user && (req.body.code || req.body.password)){
			res.status(400).json({error: "Code or password provided alone"});
		}
		else if(user){
			const number = user.number ? user.number : req.body.number;
			await sendSMS(user._id, "password", number);
			res.status(200).json({
				message: `Code send to number ending in ${number.slice(-2)}`
			});
		}
	}
	catch(err){
		if(err instanceof SMSError)
			res.status(503).json({error: "Could not send SMS message"});
		else if(err instanceof AuthenticationError)
			res.status(401).json({error: err.message});
		else if(err instanceof MongoError)
			res.status(503).json({error: "Error accessing database"});
		else{
			res.status(503).json({error: "Error with 2FA procedure"});
		}
	}
});

module.exports = router;