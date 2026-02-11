# Project Structure

This document describes the organization of the U_Diep project.

## Directory Structure

```
U_Diep/
├── server/              # Server-side code (Node.js)
│   ├── server.js        # Main server entry point (Express + Socket.io)
│   └── GameServer.js    # Game server logic (room management, player sync)
│
├── public/              # Client-side code (served statically)
│   ├── index.html       # Main HTML file
│   ├── js/              # Client JavaScript files
│   │   ├── game.js      # Main game class
│   │   ├── Tank.js      # Tank entity
│   │   ├── Bullet.js    # Bullet entity
│   │   ├── Bot.js       # Bot/pellet entity
│   │   ├── NetworkManager.js  # Socket.io client communication
│   │   └── ...          # Other game logic files
│   ├── css/             # Stylesheets
│   │   └── style.css
│   └── assets/          # Game assets (images, fonts, etc.)
│
├── package.json         # Node.js dependencies and scripts
├── .gitignore          # Git ignore rules
└── README.md           # Project documentation
```

## Server Code (`server/`)

- **`server.js`**: Main HTTP server using Express. Serves static files from `public/` and initializes Socket.io.
- **`GameServer.js`**: Handles multiplayer game logic:
  - Room management (by stake: $1, $5, $10)
  - Player synchronization
  - Input processing
  - Game state broadcasting

## Client Code (`public/`)

All client-side code is served statically by the Express server:
- **`index.html`**: Entry point for the game
- **`js/`**: All client-side JavaScript files
- **`css/`**: Stylesheets
- **`assets/`**: Game assets (sprites, fonts, etc.)

## Running the Server

```bash
# Install dependencies (first time only)
npm install

# Start the server
npm start
# or
node server/server.js
```

The server will start on `http://localhost:3000` by default.

## Development Notes

- **Server is authoritative**: All game state (player positions, bullets, etc.) is managed by the server
- **Client sends input**: Client sends player input (keys, mouse) to server
- **Server broadcasts state**: Server broadcasts game state to all clients at 60 ticks/second
- **Static file serving**: All files in `public/` are served as static assets
