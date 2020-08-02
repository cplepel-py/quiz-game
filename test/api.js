process.env.NODE_ENV = "test";
const app = require("../server.js");
const request = require("supertest");

beforeAll(async done => {
	(await require("../api/db-utils").db).collection("users").deleteMany({});
	done();
});

describe("Registration API (POST /v1/users)", () => {
	describe("Malformed Requests", () => {
		it("should return 400 if request is empty", async done => {
			const res = await request(app).post("/api/v1/users").send({});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no password", async done => {
			const res = await request(app).post("/api/v1/users").send({username: "testUser"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no username", async done => {
			const res = await request(app).post("/api/v1/users").send({password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if username is not a string", async done => {
			const res = await request(app).post("/api/v1/users").send({username: 10, password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if password is not a string", async done => {
			const res = await request(app).post("/api/v1/users").send({username: "testUser", password: 10});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Valid Requests", () => {
		it("should return 201 if request succeeds", async done => {
			const res = await request(app).post("/api/v1/users").send({username: "testUser", password: "testPass"});
			expect(res.statusCode).toBe(201);
			expect(res.body).not.toHaveProperty("error");
			done();
		});
		it("should return 409 if username is in use", async done => {
			const res = await request(app).post("/api/v1/users").send({username: "testUser", password: "testPass2"});
			expect(res.statusCode).toBe(409);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
});

describe("Login API (POST /v1/login)", () => {
	describe("Malformed Requests", () => {
		it("should return 400 if request is empty", async done => {
			const res = await request(app).post("/api/v1/login").send({});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no password", async done => {
			const res = await request(app).post("/api/v1/login").send({username: "testUser"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no username", async done => {
			const res = await request(app).post("/api/v1/login").send({password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if username is not a string", async done => {
			const res = await request(app).post("/api/v1/login").send({username: 10, password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if password is not a string", async done => {
			const res = await request(app).post("/api/v1/login").send({username: "testUser", password: 10});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Valid Requests", () => {
		it("should return 401 if username does not exist", async done => {
			const res = await request(app).post("/api/v1/login").send({username: "notARealUser", password: "testPass"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if password is incorrect", async done => {
			const res = await request(app).post("/api/v1/login").send({username: "testUser", password: "wrongPassword"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 200 and a token if username and password are correct", async done => {
			const res = await request(app).post("/api/v1/login").send({username: "testUser", password: "testPass"});
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body).toHaveProperty("token");
			done();
		});
	});
});

describe("Get User API (GET /v1/user/:user)", () => {
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

afterAll(done => {
	require("../api/db-utils").client.close();
	done()
});