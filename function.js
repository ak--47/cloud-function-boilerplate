import { http } from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import { sLog, uid, timer, details } from 'ak-tools';
import dotenv from 'dotenv';
dotenv.config();
const { NODE_ENV = "" } = process.env;
if (!NODE_ENV) throw new Error("NODE_ENV is required");
import path from 'path';
import { tmpdir } from 'os';
let TEMP_DIR;
if (NODE_ENV === 'dev') TEMP_DIR = './tmp';
else TEMP_DIR = tmpdir();
TEMP_DIR = path.resolve(TEMP_DIR);
const SERVICE_NAME = 'my-service';

import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
const loggingWinston = new LoggingWinston({ prefix: NODE_ENV });
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp(),  // Add timestamps
		winston.format.errors({ stack: true }),  // Log error stack traces
		winston.format.json()  // Structured JSON logging
	),
	transports: []
});

if (NODE_ENV === 'production') logger.add(loggingWinston);
if (NODE_ENV !== 'production') logger.add(new winston.transports.Console({
	format: winston.format.colorize({ all: true })
}));




/**
 * @typedef {Object} Params
 * @property {string} [foo] - Description of foo
 * @typedef {Params & Record<string, any>} Param any other key value pair
 */


/** @typedef {'/' | '/ping' | '/icon.ico' | string} Endpoints  */


// http entry point
// ? https://cloud.google.com/functions/docs/writing/write-http-functions
http('entry', async (req, res) => {
	const runId = uid();
	const reqData = { url: req.url, method: req.method, headers: req.headers, body: req.body, query: req.query, runId };
	const log = createLogger({ reqData });
	delete reqData.headers.authorization;
	let response = {};

	try {

		/** @type {Endpoints} */
		const path = req.path || '/';
		const { method } = req;

		//serve a UI
		if (method === "GET") return await serveUI(path, res);

		/** @type {Params} */
		const body = req.body || {};

		//add query params to body
		for (const key in req.query || {}) {
			const value = req.query[key];
			let cleanValue;
			if (value === 'true') cleanValue = true;
			else if (value === 'false') cleanValue = false;
			else if (value === 'null') cleanValue = null;
			else if (value === 'undefined') cleanValue = undefined;
			else cleanValue = value;
			body[key] = cleanValue;
		}


		const t = timer('job');
		t.start();
		log.info(`${req.path} START`);


		//setup the job
		const [job] = route(path);

		const result = await job(body);
		t.end();

		const { delta, human } = t.report(false);
		log.info(`${req.path} FINISH`, { duration: delta, time: human });
		
		//finished
		res.status(200);
		response = result;


	} catch (e) {
		log.error(`${req.path} ERROR`, { error: e });
		res.status(500);
		response = { error: e };
	}
	res.send(JSON.stringify(response));
});


async function pong(data) {
	return Promise.resolve({ status: "ok", message: "service is alive", echo: data });
}

async function serveUI(path, res) {
	let requestPath = path;
	const cwd = process.cwd();
	const assets = (await details('./assets'))
		.files
		.map(f => {
			const { name, path } = f;
			const fullPath = "." + path.replace(cwd, '');
			return { name, path: fullPath };
		});

	if (path === "/") requestPath = 'index.html';
	if (path.startsWith('/')) requestPath = path.slice(1);

	const file = assets.find(f => f.name === requestPath);
	if (file) {
		res.set('Cache-Control', 'no-cache');
		res.status(200).sendFile(file.path, { root: process.cwd() });
		return true;
	}
	else {
		res.status(404);
		res.send(JSON.stringify({ error: `${path} Not Found` }));
		return false;
	}
}

async function main(data) {
	return {};
}

function createLogger(data) {
	const { runId = null, ...rest } = data;
	const result = logger.child({
		trace: {
			runId,
			service: SERVICE_NAME
		},
		...rest
	});
	return result;
}

/**
 * determine routes based on path in request
 * @param  {Endpoints} path
 */
function route(path) {
	switch (path) {
		case "/":
			return [main];
		case "/ping":
			return [pong];
		default:
			throw new Error(`Invalid path: ${path}`);
	}
}

