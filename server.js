if(process.env.NODE_ENV !== "production"){
	require("dotenv").config();
}
const express = require("express");
const app = express();
const apiRouter = require("./api/api");
const {serveStatic} = require("lasso/middleware");
require("marko/node-require").install();
const signup = require("./src/views/sign-up.marko");
const login = require("./src/views/log-in.marko");

require("lasso").configure({
	plugins: ["lasso-marko"]
});

app.use("/api", apiRouter);

app.use(serveStatic());

app.get("/sign-up", (req, res) => {
	signup.render({}, res);
});

app.get("/login", (req, res) => {
	login.render({}, res);
});

if(process.env.NODE_ENV !== "test"){
	app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));
}

module.exports = app;