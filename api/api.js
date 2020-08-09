const express = require("express");

const router = express.Router();
router.use(express.json());

router.use(require("./users"));
router.use(require("./games"));

module.exports = router;