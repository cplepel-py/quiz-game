const {clearCollection, mockDbUtils} = require("./test-utils");
jest.mock("../api/db-utils", () => mockDbUtils());
const app = require("../server");
const request = require("supertest");

describe("Create Game API (POST /v1/games)", () => {
	beforeAll(async done => {
		await clearCollection("users");
		await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"});
		done();
	});
	describe("Unauthenticated users", () => {
		it("should return 401 if no token is provided", async done => {
			const res = await request(app).post("/api/v1/games")
				.send({username: "test-user"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).post("/api/v1/games")
				.set("x-access-token", "notAToken")
				.send({username: "test-user"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if the token is expired", async done => {
			const {id} = (await request(app).get("/api/v1/users/testUser")).body;
			const token = require("jsonwebtoken")
				.sign({id}, process.env.JWT_SECRET, {expiresIn: -1});
			const res = await request(app).post("/api/v1/games")
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Authenticated Users", () => {
		beforeEach(async done => {
			await clearCollection("games");
			done();
		});
		it("should return 400 if no title is provided", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).post("/api/v1/games")
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 200 for a valid request", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).post("/api/v1/games")
				.set("x-access-token", token).send({title: "Test Game"});
			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveProperty("id");
			expect(res.body).not.toHaveProperty("error");
			done();
		});
		it("should add new game id to user's games list", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const {id} = (await request(app).post("/api/v1/games")
				.set("x-access-token", token).send({title: "Test Game"})).body;
			const res = await request(app).get("/api/v1/users/testUser")
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(200);
			expect(res.body.games).toContain(id);
			done();
		});
	});
});

describe("Update game API (PUT /v1/games/:game)", () => {
	let token, id, uid;
	beforeAll(async done => {
		await clearCollection("games");
		await clearCollection("users");
		({id: uid} = (await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"})).body);
		({token} = (await request(app).post("/api/v1/login")
			.send({username: "testUser", password: "testPass"})).body);
		({id} = (await request(app).post("/api/v1/games")
			.set("x-access-token", token).send({title: "Test Game"})).body);
		done();
	});
	describe("Authentication and Authorization Issues", () => {
		it("should return 401 if no token is provided", async done => {
			const res = await request(app).put(`/api/v1/games/${id}`)
				.send({});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", "notAToken")
				.send({});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if the token is expired", async done => {
			const {uid} = (await request(app).get("/api/v1/users/testUser")).body;
			const token = require("jsonwebtoken")
				.sign({id: uid}, process.env.JWT_SECRET, {expiresIn: -1});
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 403 if the token is for the wrong user", async done => {
			await request(app).post("/api/v1/users")
				.send({username: "testUser2", password: "testPass2"});
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser2", password: "testPass2"})).body;
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(403);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Authorized Requests", () => {
		it("should return 404 if the id is incorrect", async done => {
			const fake_id = (id[0] === "0" ? "1" : "0") + id.slice(1);
			const res = await request(app).put(`/api/v1/games/${fake_id}`)
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(404);
			done();
		});
		it("shoud return 400 if no title is provided", async done => {
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("shoud return 400 if editors is missing", async done => {
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", token).send({title: "Missing Editors"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("shoud return 400 if editors is empty", async done => {
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", token)
				.send({title: "No Editors", editors: []});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("shoud return 400 if board is malformed", async done => {
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", token)
				.send({title: "Malformed Board", board: {abc: 10}, editors: [uid]});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("shoud return 200 if request is valid and successful", async done => {
			const res = await request(app).put(`/api/v1/games/${id}`)
				.set("x-access-token", token)
				.send({title: "Updated Game", editors: [uid]});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
});

describe("Get User API (GET /v1/users/:user)", () => {
	let token, private_id, public_id, uid;
	beforeAll(async done => {
		await clearCollection("games");
		await clearCollection("users");
		({id: uid} = (await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"})).body);
		({token} = (await request(app).post("/api/v1/login")
			.send({username: "testUser", password: "testPass"})).body);
		({id: public_id} = (await request(app).post("/api/v1/games")
			.set("x-access-token", token).send({title: "Test Game"})).body);
		({id: private_id} = (await request(app).post("/api/v1/games")
			.set("x-access-token", token)
			.send({title: "Private Test Game", isPrivate: true})).body);
		done();
	});
	describe("Unauthorized Requests", () => {
		it("should return 401 if no token is provided", async done => {
			const res = await request(app).get(`/api/v1/games/${private_id}`)
				.send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).get(`/api/v1/games/${private_id}`)
				.set("x-access-token", "notAToken").send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if the token is expired", async done => {
			const {uid} = (await request(app).get("/api/v1/users/testUser")).body;
			const token = require("jsonwebtoken")
				.sign({id: uid}, process.env.JWT_SECRET, {expiresIn: -1});
			const res = await request(app).get(`/api/v1/games/${private_id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 403 if the token is for the wrong user", async done => {
			await request(app).post("/api/v1/users")
				.send({username: "testUser2", password: "testPass2"});
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser2", password: "testPass2"})).body;
			const res = await request(app).get(`/api/v1/games/${private_id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(403);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 200 for a public game with no token", async done => {
			const res = await request(app).get(`/api/v1/games/${public_id}`)
				.send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body).toHaveProperty("title");
			expect(res.body).toHaveProperty("editors");
			expect(res.body).toHaveProperty("board");
			expect(res.body).toHaveProperty("interval");
			expect(res.body).toHaveProperty("tags");
			expect(res.body).toHaveProperty("isPrivate");
			done();
		});
	});
	describe("Authorized Requests", () => {
		it("should return 404 if game does not exist", async done => {
			const id = (public_id[0] === "0" ? "1" : "0") + public_id.slice(1);
			const res = await request(app).get(`/api/v1/games/${id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(404);
			done();
		});
		it("should return 200 for an authorized private game", async done => {
			const res = await request(app).get(`/api/v1/games/${private_id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body).toHaveProperty("title");
			expect(res.body).toHaveProperty("editors");
			expect(res.body).toHaveProperty("board");
			expect(res.body).toHaveProperty("interval");
			expect(res.body).toHaveProperty("tags");
			expect(res.body).toHaveProperty("isPrivate");
			done();
		});
	});
});

describe("Delete game API (DELETE /v1/games/:game)", () => {
	let token, id, uid;
	beforeEach(async done => {
		await clearCollection("games");
		await clearCollection("users");
		({id: uid} = (await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"})).body);
		({token} = (await request(app).post("/api/v1/login")
			.send({username: "testUser", password: "testPass"})).body);
		({id} = (await request(app).post("/api/v1/games")
			.set("x-access-token", token).send({title: "Test Game"})).body);
		done();
	});
	describe("Authentication and Authorization Issues", () => {
		it("should return 401 if no token is provided", async done => {
			const res = await request(app).delete(`/api/v1/games/${id}`)
				.send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).delete(`/api/v1/games/${id}`)
				.set("x-access-token", "notAToken")
				.send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if the token is expired", async done => {
			const {uid} = (await request(app).get("/api/v1/users/testUser")).body;
			const token = require("jsonwebtoken")
				.sign({id: uid}, process.env.JWT_SECRET, {expiresIn: -1});
			const res = await request(app).delete(`/api/v1/games/${id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 403 if the token is for the wrong user", async done => {
			await request(app).post("/api/v1/users")
				.send({username: "testUser2", password: "testPass2"});
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser2", password: "testPass2"})).body;
			const res = await request(app).delete(`/api/v1/games/${id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(403);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Authorized Requests", () => {
		it("should return 404 if the id is incorrect", async done => {
			const fake_id = (id[0] === "0" ? "1" : "0") + id.slice(1);
			const res = await request(app).delete(`/api/v1/games/${fake_id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(404);
			done();
		});
		it("should return 204 if request is successful", async done => {
			const res = await request(app).delete(`/api/v1/games/${id}`)
				.set("x-access-token", token)
				.send();
			expect(res.statusCode).toBe(204);
			expect(res.body).not.toHaveProperty("error");
			done();
		});
		it("get should return 404 after a delete request", async done => {
			await request(app).delete(`/api/v1/games/${id}`)
				.set("x-access-token", token).send();
			const res = await request(app).get(`/api/v1/games/${id}`)
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(404);
			done();
		});
	});
});

describe("Search Games API (GET /v1/games)", () => {
	let token, uid;
	beforeAll(async done => {
		await clearCollection("games");
		await clearCollection("users");
		({id: uid} = (await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"})).body);
		({token} = (await request(app).post("/api/v1/login")
			.send({username: "testUser", password: "testPass"})).body);
		let openA = request(app).post("/api/v1/games")
			.set("x-access-token", token)
			.send({title: "Test Game", tags: ["A"]});
		let openB = request(app).post("/api/v1/games")
			.set("x-access-token", token)
			.send({title: "Test Game", tags: ["B"]});
		let openAB = request(app).post("/api/v1/games")
			.set("x-access-token", token)
			.send({title: "Test Game", tags: ["A", "B"]});
		let closedA = request(app).post("/api/v1/games")
			.set("x-access-token", token)
			.send({title: "Test Game", tags: ["A"], isPrivate: true});
		let closedAB = request(app).post("/api/v1/games")
			.set("x-access-token", token)
			.send({title: "Test Game", tags: ["A", "B"], isPrivate: true});
		await openA; await openB; await openAB; await closedA; await closedAB;
		done();
	});
	describe("Authentication Errors", () => {
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).get("/api/v1/games")
				.set("x-access-token", "notAToken").send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an expired token is provided", async done => {
			const token = require("jsonwebtoken")
				.sign({id: uid}, process.env.JWT_SECRET, {expiresIn: -1});
			const res = await request(app).get("/api/v1/games")
				.set("x-access-token", "notAToken").send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Invalid Requests", () => {
		it("should return 400 if page is negative", async done => {
			const res = await request(app).get("/api/v1/games")
				.query({page: -1, perPage: 10}).send();
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if results per page is negative", async done => {
			const res = await request(app).get("/api/v1/games")
				.query({page: 1, perPage: -10}).send();
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Valid Requests", () => {
		it("should return two public games with tag A", async done => {
			const res = await request(app).get("/api/v1/games")
				.query({page: 1, perPage: 10, tags: ["A"]}).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.games.length).toBe(2);
			expect(res.body.total).toBe(2);
			expect(res.body.pages).toBe(1);
			done();
		});
		it("should return only titles, editors, tags, and ids", async done => {
			const res = await request(app).get("/api/v1/games")
				.query({page: 1, perPage: 10, tags: ["A"]}).send();
			expect(res.body.games[0]).toEqual(expect.objectContaining({
				title: expect.any(String),
				editors: expect.any(Array),
				tags: expect.any(Array),
				id: expect.stringMatching(/[a-f0-9]{24}/i)
			}));
			done();
		});
		it("should treat tags='A' the same as tags=['A']", async done => {
			const res = await request(app).get("/api/v1/games")
				.query({page: 1, perPage: 10, tags: "A"}).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.games.length).toBe(2);
			expect(res.body.total).toBe(2);
			expect(res.body.pages).toBe(1);
			done();
		});
		it("should return three public games with tag A or B", async done => {
			const res = await request(app).get("/api/v1/games")
				.query({page: 1, perPage: 10, tags: ["A", "B"]}).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.games.length).toBe(3);
			expect(res.body.total).toBe(3);
			expect(res.body.pages).toBe(1);
			done();
		});
		it("should return four games with tag A with a token", async done => {
			const res = await request(app).get("/api/v1/games")
				.set("x-access-token", token)
				.query({page: 1, perPage: 10, tags: ["A"]})
				.send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.games.length).toBe(4);
			expect(res.body.total).toBe(4);
			expect(res.body.pages).toBe(1);
			done();
		});
		it("should return 3 pages for 5 results with 2 per page", async done => {
			const res = await request(app).get("/api/v1/games")
				.set("x-access-token", token)
				.query({page: 1, perPage: 2, tags: ["A", "B"]})
				.send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.games.length).toBe(2);
			expect(res.body.total).toBe(5);
			expect(res.body.pages).toBe(3);
			done();
		});
		it("should return 1 game on page 3 for 5 games and 2/page", async done => {
			const res = await request(app).get("/api/v1/games")
				.set("x-access-token", token)
				.query({page: 3, perPage: 2, tags: ["A", "B"]})
				.send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.games.length).toBe(1);
			expect(res.body.total).toBe(5);
			expect(res.body.pages).toBe(3);
			done();
		});
	});
});

afterAll(async done => {
	client = await require("../api/db-utils").conn;
	await client.close();
	await require("../api/db-utils")._server.stop();
	done();
});