const {clearCollection, mockDbUtils} = require("./test-utils");
jest.mock("../api/db-utils", () => mockDbUtils());
const app = require("../server");
const request = require("supertest");

describe("Registration API (POST /v1/users)", () => {
	describe("Malformed Requests", () => {
		beforeEach(async done => {
			await clearCollection("users");
			done();
		});
		it("should return 400 if request is empty", async done => {
			const res = await request(app).post("/api/v1/users").send({});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no password", async done => {
			const res = await request(app).post("/api/v1/users")
				.send({username: "testUser"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no username", async done => {
			const res = await request(app).post("/api/v1/users")
				.send({password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if username is not a string", async done => {
			const res = await request(app).post("/api/v1/users")
				.send({username: 10, password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if password is not a string", async done => {
			const res = await request(app).post("/api/v1/users")
				.send({username: "testUser", password: 10});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Valid Requests", () => {
		beforeAll(async done => {
			await clearCollection("users");
			done();
		});
		it("should return 201 if request succeeds", async done => {
			const res = await request(app).post("/api/v1/users")
				.send({username: "testUser", password: "testPass"});
			expect(res.statusCode).toBe(201);
			expect(res.body).not.toHaveProperty("error");
			done();
		});
		it("should return 409 if username is in use", async done => {
			const res = await request(app).post("/api/v1/users")
				.send({username: "testUser", password: "testPass2"});
			expect(res.statusCode).toBe(409);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
});

describe("Login API (POST /v1/login)", () => {
	beforeAll(async done => {
		await clearCollection("users");
		await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"});
		done();
	});
	describe("Malformed Requests", () => {
		it("should return 400 if request is empty", async done => {
			const res = await request(app).post("/api/v1/login").send({});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no password", async done => {
			const res = await request(app).post("/api/v1/login")
				.send({username: "testUser"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if request has no username", async done => {
			const res = await request(app).post("/api/v1/login")
				.send({password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if username is not a string", async done => {
			const res = await request(app).post("/api/v1/login")
				.send({username: 10, password: "testPass"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if password is not a string", async done => {
			const res = await request(app).post("/api/v1/login")
				.send({username: "testUser", password: 10});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Valid Requests", () => {
		it("should return 401 if username does not exist", async done => {
			const res = await request(app).post("/api/v1/login")
				.send({username: "notARealUser", password: "testPass"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if password is incorrect", async done => {
			const res = await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "wrongPassword"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 200 and a token for valid login", async done => {
			const res = await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"});
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body).toHaveProperty("token");
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