const {MongoError} = require("mongodb");
const {db} = require("./db-utils");

class SMSError extends Error{};
class AuthenticationError extends Error{};

const nexmo = new (require("nexmo"))({
	apiKey: process.env.NEXMO_API_KEY,
	apiSecret: process.env.NEXMO_API_SECRET
});

async function sendSMS(user, number=undefined){
	query = typeof user === "string" ? {username: user} : {_id: user};
	tel = number || (await (await db).collection("users").findOne(query)).number
	return await new Promise((resolve, reject) => {
		nexmo.verify.request({
			number: tel,
			brand: "QuizGame",
			length: 6,
			workflow_id: 6
		}, async (err, result) => {
			if(err) reject(err);
			else if(result.status == "0"){
				db.then(conn => {
					conn.collection("users").updateOne(
						query,
						{$set: {request_id: result.request_id}}
					).then(() => resolve(result.request_id)).catch(reject);
				}).catch(reject);
			}
			else reject(new SMSError(`Nexmo error ${result.status}`));
		});
	});
}

async function authenticateCode(user, code){
	query = typeof user === "string" ? {username: user} : {_id: user};
	request_id = (await (await db).collection("users").findOne(query)).request_id;
	return await new Promise((resolve, reject) => {
		nexmo.verify.check({request_id, code}, (err, result) => {
			if(err) reject(err);
			else if(result.status == "0"){
				db.then(conn => {
					conn.collection("users").updateOne(
						query,
						{$set: request_id: null}
					).then(() => resolve(request_id)).catch(reject);
				}).catch(reject);
			}
			else reject(new AuthenticationError(
				`Nexmo error ${result.status}: ${result.error_text}`
			));
		});
	});
}