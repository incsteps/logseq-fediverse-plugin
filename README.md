# Logseq Fediverse Plugin

An integration plugin for [Logseq](https://logseq.com) that connects your graph directly to the Fediverse (GoToSocial, Mastodon, and other Mastodon-API compatible platforms).

Publish individual blocks or entire nested block structures as connected threads, and import remote statuses directly into your notes.

---

## Features

- **Publish Single Block:** Send any block as a status update to your Fediverse account.
- **Publish Thread:** Convert a block and all its nested sub-blocks into a sequential thread, automatically chained using `in_reply_to_id`.
- **Smart Chunking:** Reads your instance's maximum character limit via the API (`/api/v1/instance`) and splits long text blocks seamlessly without truncating or cutting off words.
- **Import Status:** Paste any Toot URL and import its content and author metadata as structured child blocks into your graph.
- **Simple Setup:** Works out-of-the-box using direct API Access Tokens—no complex OAuth2 flows required.

---

## Installation

### Manual Installation (Development / Pre-Release)

1. Download the latest `package.zip` from the [Releases](../../releases) page.
2. Unzip the contents into a local folder.
3. Open Logseq and go to **Settings** > **Advanced** > enable **Developer Mode**.
4. Open the **Plugins** menu (`Plugins` in the top right or `Cmd/Ctrl + Shift + P`).
5. Click **Load dev plugin** and select the directory where you extracted the files.

---

## Configuration

1. Open the Logseq Slash Command menu in any block by typing `/Fediverse: Settings` (or go to the plugin settings via the Logseq Plugin Manager).
2. Enter your instance information:
    - **Instance URL:** The full base URL of your GoToSocial/Mastodon instance (e.g., `https://social.example.com`).
    - **Access Token:** An API access token generated from your instance account settings with `read` and `write` scopes.

---

## Usage

### 1. Publishing a Single Block
- Write your content in a block.
- Type `/Fediverse: Publish` within the block or click the block bullet context menu (`...`) and select **Publish to Fediverse**.
- Once sent, the block will automatically receive a `fediverse-url::` property linking to your published post.

### 2. Publishing a Thread
- Create a parent block with nested sub-blocks representing your thread.
- Type `/Fediverse: Publish Thread` in the parent block.
- The plugin will traverse all child blocks, handle text length checks based on your server limits, upload any embedded media, and post the chain sequentially.
- The parent block will receive a `fediverse-thread::` property pointing to the root toot.

### 3. Importing a Status
- Paste the full URL of a toot into an empty block (e.g., `https://mastodon.social/@user/123456789`).
- Type `/Fediverse: Import` in that block.
- The plugin resolves the remote URL through your instance search API and appends the author and toot text as structured child blocks under the URL.

---

## Development

```bash
# Clone the repository
git clone [https://github.com/incsteps/logseq-fediverse-plugin.git](https://github.com/incsteps/logseq-fediverse-plugin.git)
cd logseq-fediverse-plugin

# Install dependencies
npm install

# Build for production (outputs to dist/)
npm run build
```

To test locally in Logseq during development, point the Load dev plugin option to the project root after running npm run build.

