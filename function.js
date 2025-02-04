//ENV
import dotenv from 'dotenv';
dotenv.config();
const { NODE_ENV = "" } = process.env;
if (!NODE_ENV) throw new Error("NODE_ENV is required");
const SERVICE_NAME = process.env.SERVICE_NAME || 'my-service';

//DEPS
import { http } from '@google-cloud/functions-framework';
import { uid, timer } from 'ak-tools';
import path from 'path';
import { tmpdir } from 'os';

//TEMP DIR
let TEMP_DIR;
if (NODE_ENV === 'dev') TEMP_DIR = './tmp';
else TEMP_DIR = tmpdir();
TEMP_DIR = path.resolve(TEMP_DIR);


//LOGGING
import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
const loggingCloud = new LoggingWinston({ prefix: NODE_ENV, logName: SERVICE_NAME, level: 'info' });
const loggingLocal = new winston.transports.Console({ level: 'debug' });
const loggingFile = new winston.transports.File({ filename: './tests/app.log', level: 'debug' });
const loggingFormats = [
	winston.format.timestamp(),
	winston.format.errors({ stack: true }),
	NODE_ENV === 'production' ? winston.format.json() : winston.format.prettyPrint(),
];
if (NODE_ENV !== 'production') loggingFormats.push(winston.format.colorize({ all: true }));

const logger = winston.createLogger({
	format: winston.format.combine(...loggingFormats),
	transports: []
});

if (NODE_ENV === 'production') logger.add(loggingCloud);
if (NODE_ENV !== 'production') logger.add(loggingLocal);
if (NODE_ENV === 'test') logger.add(loggingFile);

const createLogger = function (data) {
	const { runId = null, traceId = null, ...rest } = data;
	const result = logger.child({
		trace: {
			runId,
			traceId,
			service: SERVICE_NAME
		},
		...rest
	});
	return result;
};



/**
 * params for the service
 * @typedef {Object} Params
 * @property {string} [foo] - Description of foo
 * @typedef {Params & Record<string, any>} Param any other key value pair
 */

/**
 * service routes
 * @typedef {'/' | string} Endpoints
 */


// http entry point
http('entry', async (req, res) => {
	const runId = uid();
	const reqData = { url: req.url, method: req.method, headers: req.headers, body: req.body, query: req.query, runId };
	const traceContext = req.header('X-Cloud-Trace-Context');
	const traceId = traceContext && traceContext.includes('/') ? traceContext.split('/')[0] : null;
	reqData.traceId = traceId;
	const auth = req.headers?.authorization?.toString(); //todo: validate auth if necessary
	delete reqData.headers.authorization;
	const log = createLogger({ reqData });
	let response = {};
	let status = 200;
	const t = timer('job');
	t.start();

	try {

		/** @type {Endpoints} */
		const path = req.path || '/';
		const { method } = req;


		/** @type {Params} */
		const body = req.body || {};

		//add query params to body allowing params to be passed in either body or query
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

		log.info(`${req.path} START`);

		//setup the job
		const [job] = route(path);

		const result = await job(body);
		t.end();

		const { delta, human } = t.report(false);
		log.info(`${req.path} FINISH (${human})`, { duration: delta, status });

		//finished
		res.status(status);
		response = result;


	} catch (e) {
		t.end();
		const { delta, human } = t.report(false);
		status = 500;

		log.error(`${req.path} ERROR (${human})`, {
			error: e.message,
			stack: e.stack,
			code: e.code || 'INTERNAL_ERROR',
			duration: delta,
			status,
			request: reqData
		});

		response = {
			error: {
				message: e.message,
				code: e.code || 'INTERNAL_ERROR'
			}
		};
		res.status(status);
	}
	res.send(JSON.stringify(response));
});


async function pong(data) {
	return Promise.resolve({ status: "ok", message: "service is alive", echo: data });
}


/**
 * determine routes based on path in request
 * @param  {Endpoints} path
 */
function route(path) {
	switch (path) {
		case "/":
			return [pong];
		default:
			throw new Error(`Invalid path: ${path}`);
	}
}

