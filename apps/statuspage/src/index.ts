import { CronJob } from "cron";
import debug from "debug";
import ky from "ky";
import StatuspageApi from "statuspage.ts";

if (process.env.NODE_ENV === undefined) {
	const { config } = await import("dotenv");

	config({ path: "../../../.env" });
}

const log = debug("statuspage");
debug.enable("statuspage*");

if (process.env.STATUSPAGE_API_TOKEN === undefined)
	throw new Error("STATUSPAGE_API_TOKEN is not defined in .env file!");
if (process.env.STATUSPAGE_PAGE_ID === undefined)
	throw new Error("STATUSPAGE_PAGE_ID is not defined in .env file!");

const statuspage = new StatuspageApi(process.env.STATUSPAGE_API_TOKEN);

let pingResultsLast5Minutes: { timestamp: number; value: number }[] = [];

const pingJob = new CronJob("*/30 * * * * *", async () => {
	let duration = 0;

	const result = await ky.get("https://api.premid.app/ping", {
		hooks: {
			beforeRequest: [
				() => {
					duration = performance.now();
				},
			],
			afterResponse: [
				(_, _1, result) => {
					if (result.ok) duration = Math.floor(performance.now() - duration);
				},
			],
		},
		timeout: 5000,
		throwHttpErrors: false,
	});

	if (!result.ok)
		return log("Failed to ping API! %d %s", result.status, result.statusText);

	pingResultsLast5Minutes.push({
		timestamp: Math.floor(Date.now() / 1000),
		value: duration,
	});

	log("Successfully pinged API! %dms", duration);
});

new CronJob("*/5 * * * *", async () => {
	//* Temporarily suspend the job
	pingJob.stop();

	const results = pingResultsLast5Minutes;
	pingResultsLast5Minutes = [];

	//TODO It's down.
	if (results.length === 0) return;

	const result = await statuspage.metrics.addDataPoints(
		process.env.STATUSPAGE_PAGE_ID || "",
		{
			"21gnbqvy6126": results,
		}
	);

	if (result.isOk) log("Successfully submitted metric data!");
	else log("Failed to submit metric data! %O", result.error);

	//* Start job again
	pingJob.start();
}).start();

//* Start job
pingJob.start();
