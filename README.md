# Analysis Journal

Analysis Journal is a small full-stack Node app for saving market analysis screenshots, writing what went well and what went badly, and sharing selected entries on a public profile.

## Features

- User signup and login with cookie-based sessions
- Private and public analysis entries per account
- Screenshot upload with client-side resizing
- Auto summary of repeated good and bad patterns
- Public share page at `/u/<username>`

## Run locally

1. Open a terminal in this folder.
2. Run `node server.js`
3. Open `http://127.0.0.1:3000`

The app stores data in `data/store.json`. That file is created automatically on first run.

## Deploy publicly

Deploy it on any Node host that can run `node server.js`.

Important:

- Mount persistent storage for the `data/` folder so users and entries are not lost on restart.
- Set `PORT` if your hosting provider requires it.
- This app uses a simple JSON file store, which is fine for small projects and demos. For a larger public app, move the same auth and entry model to a database.
