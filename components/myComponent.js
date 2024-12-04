/**
 * @fileoverview MyComponent is a component that does something.
 * this is just a suggestion on how to structure your code
 */

import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { tmpdir } from 'os';
const { NODE_ENV = "" } = process.env;
if (!NODE_ENV) throw new Error("NODE_ENV is required");
let TEMP_DIR;
if (NODE_ENV === 'dev') TEMP_DIR = './tmp';
else TEMP_DIR = tmpdir();
TEMP_DIR = path.resolve(TEMP_DIR);
import u from 'ak-tools';
import fetch from "ak-fetch";


export async function doAThing() {
	try {



		return 'done';
	}
	catch (e) {
		if (NODE_ENV === 'dev') debugger;
		throw e;
	}
}




if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	//do some work locally 
	if (NODE_ENV === 'dev') debugger;
}