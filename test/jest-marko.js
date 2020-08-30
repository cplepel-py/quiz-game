const marko = require("marko/compiler");

module.exports = {
	process(src, filename){
		return marko.compileFile(filename);
	}
}