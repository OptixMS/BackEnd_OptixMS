const express = require('express');
const coreRouter = require('express/lib/router');

const router = express.Router();
const realRouter = coreRouter();

console.log('Express version:', require('express/package.json').version);
console.log('express.Router === require("express/lib/router"):', express.Router === coreRouter);
console.log('Router type:', typeof router);
console.log('Router instanceof coreRouter:', router instanceof coreRouter.constructor);
console.log('Real Router type:', typeof realRouter);
