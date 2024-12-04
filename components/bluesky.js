/**
 * @fileoverview MyComponent is a component that does something.
 * this is just a suggestion on how to structure your code
 */

import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { tmpdir } from 'os';
const { NODE_ENV = "", BSKY_USER = "", BSKY_PASS = "" } = process.env;
if (!NODE_ENV) throw new Error("NODE_ENV is required");
if (!BSKY_USER) throw new Error("BSKY_USER is required");
if (!BSKY_PASS) throw new Error("BSKY_PASS is required");
let TEMP_DIR;
if (NODE_ENV === 'dev') TEMP_DIR = './tmp';
else TEMP_DIR = tmpdir();
TEMP_DIR = path.resolve(TEMP_DIR);
import u from 'ak-tools';
import fetch from "ak-fetch";
import { AtpAgent } from '@atproto/api';

const agent = new AtpAgent({
	service: 'https://bsky.social'
});
await agent.login({
	identifier: BSKY_USER,
	password: BSKY_PASS
});

const feedUri = 'at://did:plc:b2ieuihxha2357jjtowkx357/app.bsky.feed.generator/mixpanel';

const { data } = await agent.app.bsky.feed.getFeed({
	feed: feedUri,
});

debugger;


if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	//do some work locally 
	if (NODE_ENV === 'dev') debugger;
}