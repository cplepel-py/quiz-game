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

afterAll(done => {
	require("../api/db-utils").client.close();
	done()
});