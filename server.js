if(process.env.NODE_ENV !== "production"){
	require("dotenv").config();
}
const express = require("express");
const app = express();
const apiRouter = require("./api/api");
const {serveStatic} = require("lasso/middleware");
require("marko/node-require").install();

require("lasso").configure({
	plugins: ["lasso-marko"]
});

app.use("/api", apiRouter);

app.use(serveStatic());

if(process.env.NODE_ENV !== "test"){
	app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));
}

module.exports = app;