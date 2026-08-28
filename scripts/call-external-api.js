// POC: sends the generated payload to an external API using a Jira-style
// bearer token, standing in for a real Jira issue-update call. Swapping in
// real Jira later is just EXTERNAL_API_URL + JIRA_ACCESS_TOKEN.
const fs = require("fs");

const API_URL = process.env.EXTERNAL_API_URL || "https://jsonplaceholder.typicode.com/posts";
const TOKEN = process.env.JIRA_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("JIRA_ACCESS_TOKEN is not set");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync("payload.json", "utf8"));

async function main() {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  console.log(`Response status: ${res.status}`);
  console.log("Response body:");
  console.log(JSON.stringify(body, null, 2));

  if (!res.ok) {
    process.exit(1);
  }
}

main();
