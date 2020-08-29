const {MongoError} = require("mongodb");
const {db} = require("./db-utils");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");

const jwtSecret = process.env.JWT_SECRET;

async function set2FA(user){
	const query = typeof user === "string" ? {username: user} : {_id: user};
	const otpauth = speakeasy.generateSecret({name: "Quiz Game"}).base32;
	await (await db).collection("users").updateOne(query, {$set: {otpauth}});
	return otpauth;
}

async function unset2FA(user){
	const query = typeof user === "string" ? {username: user} : {_id: user};
	await (await db).collection("users")
		.updateOne(query, {$set: {otpauth: undefined}});
	return true;
}

async function check2FA(user, code){
	const query = typeof user === "string" ? {username: user} : {_id: user};
	const res = await (await db).collection("users")
		.findOne(query, {projection: {otpauth: true, _id: false}});
	if(res === null) return {auth: false, error: "User not found"};
	if(!res.otpauth) return {auth: false, error: "2FA not enabled"};
	const valid = speakeasy.totp.verify({
		secret: res.otpauth,
		encoding: "base32",
		token: code
	});
	if(valid) return {auth: true};
	return {auth: false, error: "Incorrect code"};
}

async function verifyToken(token, res, {ids=null, message="Unauthorized"}={}){
	if(typeof token !== "string"){
		if(res) res.status(401).json({error: "Missing token"});
		return {valid: false, auth: false, code: 401, message: "Missing Token"};
	}
	try{
		const claims = await jwt.verify(token, jwtSecret);
		const claim_id = claims.id.toLowerCase();
		if(ids === null || ids.some(id => id.toLowerCase() === claim_id)){
			return {valid: true, auth: true, claims, code: 200};
		}
		else if(message){
			if(res) res.status(403).json({error: message});
			return {valid: true, auth: false, claims, code: 403, message};
		}
		else{
			if(res) res.status(404).end();
			return {valid: true, auth: false, claims, code: 404};
		}
	}
	catch(err){
		if(err instanceof jwt.JsonWebTokenError){
			if(res) res.status(401).json({error: err.message});
			return {valid: false, auth: false, code: 401, message: err.message};
		}
		throw err;
	}
}

module.exports = {
	verifyToken, set2FA, unset2FA, check2FA
};