
import dotenv from 'dotenv';
dotenv.config();
const { NODE_ENV = ""} = process.env;
if (!NODE_ENV) throw new Error("NODE_ENV is required");
import {  } from './function.js';
import u from 'ak-tools';


async function main() {
	try {

		return 'done';
	} catch (error) {
		debugger;
	}
};


await main();
debugger;




