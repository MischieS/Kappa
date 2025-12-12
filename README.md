# Kappa - Tarkov Tracker

Kappa is an open-source, self-hostable Escape From Tarkov progression tracker. It provides a dashboard to track your quests, items needed for the Collector quest (Kappa container), and Hideout upgrades.

This is a fan project designed for small groups of friends to host personally.

## Features

- **Quest Dashboard**: Track progress on all trader quests.
- **Kappa Items**: Automatically tracks which "Found in Raid" items you still need for the Collector quest.
- **Hideout Tracking**: Track items needed for hideout upgrades.
- **Team/Group Support**: Create teams and invite friends.
- **Interactive Maps**: (Integration with Tarkov.dev/Reemr maps).
- **Self-Hosted**: Runs on a lightweight Node.js server with SQLite.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **Styling**: TailwindCSS
- **Data Source**: Tarkov.dev GraphQL API

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MischieS/Kappa.git
   cd Kappa
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`. The SQLite database will be created automatically on the first run.

## Credits & Acknowledgements

This is a community fan project and is not affiliated with Battlestate Games.

- **Game Data**: Powered by [tarkov.dev](https://tarkov.dev/) API.
- **Maps**: High-quality maps provided by [Reemr](https://reemr.se/).
- **Wiki Info**: Additional data references from the [Official Tarkov Wiki](https://escapefromtarkov.fandom.com/).

Game content and materials are trademarks and copyrights of Battlestate Games.
