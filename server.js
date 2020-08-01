if(process.env.NODE_ENV !== "production"){
	require("dotenv").config();
}
const express = require("express");
const app = express();
const apiRouter = require("./api/api");
app.use("/api", apiRouter);

if(process.env.NODE_ENV !== "test"){
	app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));
}

module.exports = app;