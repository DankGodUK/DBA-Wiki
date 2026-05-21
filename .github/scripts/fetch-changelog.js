const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANGELOG_CHANNEL_ID;

async function run() {
    const response = await fetch(
        `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=50`,
        {
            headers: {
                Authorization: `Bot ${TOKEN}`
            }
        }
    );

    const messages = await response.json();

    const changelog = messages
        .filter(m => !m.author.bot)
        .map(m => ({
            id: m.id,
            author: m.author.username,
            content: m.content,
            date: m.timestamp
        }));

    fs.writeFileSync(
        "docs/data/changelog.json",
        JSON.stringify(changelog, null, 2)
    );
}

run();
