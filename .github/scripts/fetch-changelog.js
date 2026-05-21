const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANGELOG_CHANNEL_ID;

const CHANGELOG_FILE = "docs/data/changelog.json";
const STATE_FILE = "docs/data/changelog-state.json";

async function run() {

    let changelog = [];
    let lastMessageId = null;

    if (fs.existsSync(CHANGELOG_FILE)) {
        changelog = JSON.parse(
            fs.readFileSync(CHANGELOG_FILE, "utf8")
        );
    }

    if (fs.existsSync(STATE_FILE)) {
        const state = JSON.parse(
            fs.readFileSync(STATE_FILE, "utf8")
        );

        lastMessageId = state.lastMessageId;
    }

    let url =
        `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=100`;

    if (lastMessageId) {
        url += `&after=${lastMessageId}`;
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bot ${TOKEN}`
        }
    });

    if (!response.ok) {
        throw new Error(
            `Discord API error ${response.status}`
        );
    }

    const messages = await response.json();
    console.log(JSON.stringify(messages[0], null, 2));
    if (!messages.length) {
        console.log("No new changelog entries.");
        return;
    }

    messages.reverse();

    const newEntries = messages
        .filter(m => !m.author.bot)
        .map(m => ({
            id: m.id,
            author: m.author.username,
            date: m.timestamp,
            content: m.content
                .replace(/```/g, '')
                .trim()
        }));

    changelog.unshift(...newEntries.reverse());

    fs.writeFileSync(
        CHANGELOG_FILE,
        JSON.stringify(changelog, null, 2)
    );

    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({
            lastMessageId:
                messages[messages.length - 1].id
        }, null, 2)
    );

    console.log(
        `Added ${newEntries.length} new entries`
    );
}

run().catch(console.error);
