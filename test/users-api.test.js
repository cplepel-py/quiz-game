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

describe("Delete User API (DELETE /v1/users/:user)", () => {
	beforeEach(async done => {
		await clearCollection("users");
		await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"});
		done();
	});
	describe("Authentication and Authorization Issues", () => {
		it("should return 401 if no token is provided", async done => {
			const res = await request(app).delete("/api/v1/users/testUser")
				.send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).delete("/api/v1/users/testUser")
				.set("x-access-token", "notAToken").send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if the token is expired", async done => {
			const {id} = (await request(app).get("/api/v1/users/testUser")).body;
			const token = require("jsonwebtoken")
				.sign({id}, process.env.JWT_SECRET, {expiresIn: -1});
			const res = await request(app).delete("/api/v1/users/testUser")
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 403 if the token is for the wrong user", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			await request(app).post("/api/v1/users")
				.send({username: "testUser2", password: "testPass2"});
			const res = await request(app).delete("/api/v1/users/testUser2")
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(403);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Authorized Requests", () => {
		it("should return 404 if the user does not exist", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).delete("/api/v1/users/notARealUser")
				.set("x-access-token", token).send({});
			expect(res.statusCode).toBe(404);
			done();
		});
		it("should return 204 if the token is valid", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).delete("/api/v1/users/testUser")
				.set("x-access-token", token).send({username: "newUsername"});
			expect(res.statusCode).toBe(204);
			done();
		});
	});
});

describe("Change Password API (POST /v1/users/:user/password)", () => {
	beforeEach(async done => {
		await clearCollection("users");
		await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"});
		done();
	});
	describe("Authorized Requests", () => {
		it("should return 400 if a password and no code is sent", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app)
				.post("/api/v1/users/testUser/password")
				.set("x-access-token", token)
				.send({password: "newPassword"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if a code and no password is sent", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app)
				.post("/api/v1/users/testUser/password")
				.set("x-access-token", token)
				.send({code: "11235"});
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an unexpected code is provided", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app)
				.post("/api/v1/users/testUser/password")
				.set("x-access-token", token)
				.send({code: "112358", password: "newPassword"});
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
});

describe("Search Games API (GET /v1/games)", () => {
	beforeAll(async done => {
		await clearCollection("users");
		const user1 = request(app).post("/api/v1/users")
			.send({username: "user1", password: "password"});
		const user2 = request(app).post("/api/v1/users")
			.send({username: "user2", password: "password"});
		const tester = request(app).post("/api/v1/users")
			.send({username: "tester", password: "password"});
		const testuser = request(app).post("/api/v1/users")
			.send({username: "testuser", password: "password"});
		const test_user = request(app).post("/api/v1/users")
			.send({username: "test-user", password: "password"});
		await user1; await user2; await tester; await testuser; await test_user;
		done();
	});
	describe("Invalid Requests", () => {
		it("should return 400 if page is negative", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: -1, perPage: 10}).send();
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 400 if results per page is negative", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: 1, perPage: -10}).send();
			expect(res.statusCode).toBe(400);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Valid Requests", () => {
		it("should return users with names containing text query", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: 1, perPage: 10, q: "test"}).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.users.length).toBe(3);
			expect(res.body.total).toBe(3);
			expect(res.body.pages).toBe(1);
			done();
		});
		it("should return users with names matching regex query", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: 1, perPage: 10, q: "^user\\d$", regex: "true"})
				.send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.users.length).toBe(2);
			expect(res.body.total).toBe(2);
			expect(res.body.pages).toBe(1);
			done();
		});
		it("should match any word of multi-word text queries", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: 1, perPage: 10, q: "test user"}).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.users.length).toBe(5);
			expect(res.body.total).toBe(5);
			expect(res.body.pages).toBe(1);
			done();
		});
		it("should return 3 pages for 5 results with 2 per page", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: 1, perPage: 2, q: "test user"}).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.users.length).toBe(2);
			expect(res.body.total).toBe(5);
			expect(res.body.pages).toBe(3);
			done();
		});
		it("should return 1 game on page 3 for 5 games and 2/page", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: 3, perPage: 2, q: "test user"}).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).not.toHaveProperty("error");
			expect(res.body.users.length).toBe(1);
			expect(res.body.total).toBe(5);
			expect(res.body.pages).toBe(3);
			done();
		});
		it("should return only usernames", async done => {
			const res = await request(app).get("/api/v1/users")
				.query({page: 1, perPage: 10, q: "test user"}).send();
			expect(res.body.users[0]).toEqual(expect.objectContaining({
				username: expect.any(String),
				id: expect.stringMatching(/[a-f0-9]{24}/i)
			}));
			done();
		});
	});
});

describe("Enable 2FA API (POST /v1/users/:user/2fa)", () => {
	beforeAll(async done => {
		await clearCollection("users");
		await request(app).post("/api/v1/users")
			.send({username: "testUser", password: "testPass"});
		done();
	});
	describe("Authentication and Authorization Issues", () => {
		it("should return 401 if no token is provided", async done => {
			const res = await request(app).post("/api/v1/users/testUser/2fa")
				.send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if an invalid token is provided", async done => {
			const res = await request(app).post("/api/v1/users/testUser/2fa")
				.set("x-access-token", "notAToken").send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 401 if the token is expired", async done => {
			const {id} = (await request(app).get("/api/v1/users/testUser")).body;
			const token = require("jsonwebtoken")
				.sign({id}, process.env.JWT_SECRET, {expiresIn: -1});
			const res = await request(app).post("/api/v1/users/testUser/2fa")
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(401);
			expect(res.body).toHaveProperty("error");
			done();
		});
		it("should return 403 if the token is for the wrong user", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			await request(app).post("/api/v1/users")
				.send({username: "testUser2", password: "testPass2"});
			const res = await request(app).post("/api/v1/users/testUser2/2fa")
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(403);
			expect(res.body).toHaveProperty("error");
			done();
		});
	});
	describe("Authorized Requests", () => {
		it("should return 200 with the OTPAuth URL", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			const res = await request(app).post("/api/v1/users/testUser/2fa")
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveProperty("otpauth_url");
			done();
		});
		it("should return a different OTPAuth URL each time", async done => {
			const {token} = (await request(app).post("/api/v1/login")
				.send({username: "testUser", password: "testPass"})).body;
			let res = await request(app).post("/api/v1/users/testUser/2fa")
				.set("x-access-token", token).send();
			let oldUrl = res.body.otpauth_url;
			res = await request(app).post("/api/v1/users/testUser/2fa")
				.set("x-access-token", token).send();
			expect(res.statusCode).toBe(200);
			expect(oldUrl).not.toEqual(res.body.otpauth_url);
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