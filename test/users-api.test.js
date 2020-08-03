const {clearCollection, mockDbUtils} = require("./test-utils");
jest.mock("../api/db-utils", () => mockDbUtils());
const app = require("../server");
const request = require("supertest");

describe("Get User API (GET /v1/users/:user)", () => {
	beforeAll(async done => {
		await clearCollection("users");
		await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"});
		done();
	});
	it("should return 404 if user does not exist", async done => {
		const res = await request(app).get("/api/v1/users/notARealUser").send();
		expect(res.statusCode).toBe(404);
		done();
	});
	it("should return 200 and a user object if the user exists", async done => {
		const res = await request(app).get("/api/v1/users/testUser").send();
		expect(res.statusCode).toBe(200);
		expect(res.body.id).toMatch(/^[a-z0-9]{24}$/);
		expect(res.body.games).toEqual([]);
		expect(res.body.username).toBe("testUser");
		done();
	});
});

describe("Update User API (PUT /v1/users/:user)", () => {
	beforeEach(async done => {
		await clearCollection("users");
		await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"});
		done();
	});
	describe("Authentication and Authorization Issues", () => {
		it("should return 401 if no token is provided", async done => {
			const res = await request(app).put("/api/v1/users/testUser")
				.send({username: "test-user"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).put("/api/v1/users/testUser")
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
			const res = await request(app).put("/api/v1/users/testUser")
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 403 if the token is for the wrong user", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			await request(app).post("/api/v1/users")
				.send({username: "testUser2", password: "testPass2"});
			const res = await request(app).put("/api/v1/users/testUser2")
				.set("x-access-token", token).send({username: "abc"});
			expect(res.statusCode).toBe(403);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Authorized Requests", () => {
		it("should return 404 if the user does not exist", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).put("/api/v1/users/notARealUser")
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(404);
			done();
		});
		it("should return 400 if the requested change is invalid", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).put("/api/v1/users/testUser")
				.set("x-access-token", token).send({username: 10});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 409 if the requested new username is in use", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			await request(app).post("/api/v1/users")
				.send({username: "testUser2", password: "testPass2"});
			const res = await request(app).put("/api/v1/users/testUser")
				.set("x-access-token", token).send({username: "testUser2"});
			expect(res.statusCode).toBe(409);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 200 if the token is valid and the change is accepted", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).put("/api/v1/users/testUser")
				.set("x-access-token", token).send({username: "newUsername"});
			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveProperty("id");
			expect(res.body.username).toBe("newUsername");
			done();
		});
		it("should return 200 with a warning if a password change is requested", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).put("/api/v1/users/testUser")
				.set("x-access-token", token)
				.send({username: "newUsername", password: "newPassword"});
			expect(res.body).toHaveProperty("warning");
			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveProperty("id");
			expect(res.body.username).toBe("newUsername");
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