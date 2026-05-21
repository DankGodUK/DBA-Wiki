const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANGELOG_CHANNEL_ID;
const CHANGELOG_FILE = "docs/data/changelog.json";
const STATE_FILE = "docs/data/changelog-state.json";

async function run() {
  // Validate secrets are present before doing anything
  if (!TOKEN || !CHANNEL_ID) {
    throw new Error(
      "Missing required environment variables: DISCORD_TOKEN and/or CHANGELOG_CHANNEL_ID. " +
      "Check your repository secrets under Settings → Secrets → Actions."
    );
  }

  // Load existing changelog and last-seen message ID
  let changelog = [];
  let lastMessageId = null;

  if (fs.existsSync(CHANGELOG_FILE)) {
    changelog = JSON.parse(fs.readFileSync(CHANGELOG_FILE, "utf8"));
  }
  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    lastMessageId = state.lastMessageId ?? null;
  }

  // Build a set of already-known IDs so we never add duplicates
  const knownIds = new Set(changelog.map(e => e.id));

  // Fetch up to 100 messages after the last seen one
  let url = `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=100`;
  if (lastMessageId) {
    url += `&after=${lastMessageId}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bot ${TOKEN}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API error ${response.status}: ${body}`);
  }

  const messages = await response.json();

  if (!messages.length) {
    console.log("No new messages found.");
    return;
  }

  // Discord returns newest-first; reverse so we process oldest-first
  messages.reverse();

  // FIX 1: removed the !m.author.bot filter — in a dedicated changelog
  // channel every message is relevant. The old filter was checking a field
  // that is simply absent on normal user accounts, so it was doing nothing.
  // If you ever need to exclude someone specific, filter by m.author.id instead.
  const newEntries = messages
    .filter(m => m.content && m.content.trim() !== "") // skip empty/embed-only messages
    .filter(m => !knownIds.has(m.id))                  // FIX 2: skip duplicates
    .map(m => ({
      id: m.id,
      author: m.author.username,
      date: m.timestamp,
      content: m.content,
    }));

  if (!newEntries.length) {
    console.log("No new changelog entries after deduplication.");
    // Still update lastMessageId so we advance the cursor
    const latestId = messages[messages.length - 1].id;
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastMessageId: latestId }, null, 2));
    return;
  }

  // Prepend new entries (newest at top when rendered)
  changelog.unshift(...newEntries.reverse());

  // Persist both files
  fs.writeFileSync(CHANGELOG_FILE, JSON.stringify(changelog, null, 2));
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ lastMessageId: messages[messages.length - 1].id }, null, 2)
  );

  console.log(`Added ${newEntries.length} new entries.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1); // Non-zero exit so GitHub Actions marks the run as failed
});
