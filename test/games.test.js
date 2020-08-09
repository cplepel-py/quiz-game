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

afterAll(async done => {
	client = await require("../api/db-utils").conn;
	await client.close();
	await require("../api/db-utils")._server.stop();
	done();
});