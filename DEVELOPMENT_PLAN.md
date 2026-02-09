# Development Plan: Skill-Based PvP Tank Battle with Betting System

## 1. Game Overview

**Game Name:** Skill-Based PvP Tank Battle  
**Reference Game:** diep.io (FFA mode mechanics)

### Purpose
This game merges PvP tank combat with a betting system, where players wager money (fake currency in alpha, SOL cryptocurrency in beta) to participate in free-for-all (FFA) multiplayer tank battles. Players earn rewards by eliminating opponents (90% of victim's stake per kill) and leveling up through pellets/bots. The game is skill-based—rewards depend on player actions, not random chance. The arena runs continuously with no match end or winner—players can join/leave anytime.

---

## 2. Vision

Create a fun, fast-paced, skill-based multiplayer experience where players can enjoy PvP combat and bet money on their skills. The game will initially use fake currency (Test Coins) in the alpha version and later transition to real-money payments using SOL cryptocurrency.

---

## 3. Technical Stack

### Frontend
- **Engine:** HTML5 Canvas
- **Language:** JavaScript/TypeScript
- **Framework:** Vanilla JS or lightweight framework (if needed)
- **Target:** Desktop (alpha), Desktop + Mobile Responsive (beta)

### Backend
- **Runtime:** Node.js
- **WebSocket:** Socket.io
- **Framework:** Express.js (for REST API endpoints)
- **Language:** JavaScript/TypeScript

### Database
- **Type:** SQL (PostgreSQL recommended, or MySQL)
- **Schema:** Users, Matches, Transactions, Economy, Admin Actions

### Hosting
- **Alpha:** Vercel (frontend + serverless functions)
- **Beta:** Consider dedicated server for WebSocket connections (Vercel has limitations for persistent connections)

### Development Tools
- **Version Control:** Git
- **Package Manager:** npm or yarn
- **Linting:** ESLint
- **Formatting:** Prettier
- **Testing:** Jest (unit tests), Playwright (E2E tests)
- **CI/CD:** GitHub Actions (optional for alpha)

---

## 4. Game Features & Mechanics

### 4.1 Core Gameplay (Based on diep.io)

**Tank Movement & Controls:**
- WASD/Arrow keys for movement
- Mouse for aiming
- Click/Spacebar for shooting

**Tank Stats (Same as diep.io):**
- 8 upgradeable stats: Health Regen, Max Health, Body Damage, Bullet Speed, Bullet Penetration, Bullet Damage, Reload, Movement Speed
- Level up by gaining XP from pellets and killing players
- Allocate stat points on level up

**Projectiles:**
- Same mechanics as diep.io
- Speed, damage, penetration based on tank stats
- Collision detection with tanks and arena boundaries

**Arena:**
- Same logic as diep.io FFA arena
- Scattered pellets (polygons) for XP farming
- No base or team mechanics—pure FFA

**Collision:**
- Tank vs Tank collision
- Tank vs Bullet collision
- Tank vs Pellet collision
- Same physics as diep.io

### 4.2 Match Flow (Continuous Arena)

**FFA Mode:**
- Players join rooms based on stake ($1, $5, or $10)
- Match starts when 10+ players are in the room
- Players compete individually—no teams
- **No match end or winner**—continuous arena gameplay
- Players can enter/exit anytime using kill button

**Pre-Match Lobby:**
- Players wait in lobby until 10+ players join
- Chat available while waiting
- All players start at level 1 when match begins
- Early joiners cannot farm XP before match starts (prevents unfair advantage)

**Respawn:**
- Once killed by another player, player loses their entire stake
- Player must choose a room again and rejoin (with new wager)
- If insufficient balance, player must deposit funds before joining
- No respawn within the same match—must rejoin from lobby

**Disconnect Handling:**
- If player disconnects mid-match:
  - Wagered money is refunded to account
  - Player is removed from room
  - Other players continue the match

**Continuous Gameplay:**
- Arena runs continuously as long as players are present
- Players can join/leave at any time
- No "match end" event—players play until they leave or are killed

### 4.3 Kill Button

**Functionality:**
- Players can voluntarily kill themselves using the kill button
- **Penalty:** Player loses **10% of their wager** (sent to server/platform)
- **Refund:** Player receives **90% of their wager** back to their account
- Available at any time during the match (mid-match exit)
- Player is removed from match immediately
- Player can rejoin a room after exiting

**Example:**
- Player wagers $10 to join room
- Player presses kill button mid-match
- **Result:** Player loses $1 (10% to server), receives $9 refund (90%)
- Player's balance: -$1 from original wager

**Use Cases:**
- Quick exit from match (with small penalty)
- Strategy reset (costs 10% of stake)
- Emergency exit (better than losing 100% if about to die)
- Testing/debugging

**Comparison:**
- **Killed by opponent:** Lose 100% of stake (killer gets 90%, server gets 10%)
- **Kill button:** Lose 10% of stake (server gets 10%, player refunded 90%)
- **Disconnect:** Full refund (100% returned to account)

### 4.4 Betting System

**Currency:**
- **Alpha:** Test Coins (fake currency)
- **Beta:** SOL cryptocurrency only

**Initial Balance:**
- Alpha: $100 Test Coins on account creation

**Room Logic:**
- Players select stake level: $1, $5, or $10
- **Rooms are segregated by stake amount**—players can only compete against others with the same stake
  - $1 Room: Only players who wagered $1
  - $5 Room: Only players who wagered $5
  - $10 Room: Only players who wagered $10
- Each player wagers their stake when joining the room
- **Fair competition:** All players in a room have the same stake, ensuring fairness
- **No shared pool**—rewards are per-kill, not match-based

**Per-Kill Reward System:**
- When Player A kills Player B (both in the same stake room):
  - Player A receives **90% of Player B's stake** (e.g., in $5 room: Player A gets $4.50)
  - Server receives **10% of Player B's stake** (e.g., in $5 room: Server gets $0.50)
  - Player B loses **their entire stake** (e.g., in $5 room: Player B loses $5)
- Rewards are distributed immediately upon kill
- Each kill is a micro-transaction—no match end required

**Exit Scenarios Summary:**
| Scenario | Player's Loss | Refund | Killer Reward | Server Fee |
|----------|---------------|--------|--------------|------------|
| **Killed by opponent** | 100% of stake | $0 | 90% of victim's stake | 10% of victim's stake |
| **Kill button (self-exit)** | 10% of stake | 90% of stake | $0 | 10% of player's stake |
| **Disconnect** | 0% | 100% (full refund) | $0 | $0 |

**Example ($5 Room):**
- Player A wagers $5, Player B wagers $5, Player C wagers $5 (all in $5 room)
- Player A kills Player B → Player A gets $4.50, Server gets $0.50, Player B loses $5
- Player C kills Player A → Player C gets $4.50, Server gets $0.50, Player A loses $5
- No "winner" or "match end"—continuous gameplay
- **Note:** Players from $1 or $10 rooms cannot join $5 room—complete segregation

**Partial Matches:**
- If only 1 player in room: Player can wait, but match doesn't start
- Match requires minimum 10 players to begin
- Players in lobby cannot farm XP before match starts

**Cash-Out:**
- Available only when not in a match/room
- Disabled during active gameplay (must use kill button to exit first)
- Players can withdraw their balance at any time (when not in room)
- Minimum cash-out: TBD (recommend $0.01 SOL or equivalent)

### 4.5 Account & Payment

**Authentication:**
- Wallet-first approach (connect wallet to play)
- Alpha: Simulated wallet (no real blockchain)
- Beta: Real Solana wallet connection

**Wallet Integration:**
- **Alpha:** Simulated deposit/withdrawal flows (fake Test Coins)
- **Beta:** Privy.io recommended (supports multiple wallets, good UX)

**Payment Flow:**
- Deposit: Player sends SOL to platform wallet
- Withdrawal: Platform sends SOL to player wallet
- All transactions stored in database with transaction signatures (beta)

---

## 5. Admin System

### 5.1 Features

**Tier 1 - Core (Phase 3):**
- User Management: Search/view players, ban/suspend accounts
- Transaction Oversight: View all deposits, withdrawals, bets, payouts
- Server Currency Status: Total platform balance, fees collected, pending payouts
- User Currency Status: Per-user balance, transaction history, net P&L
- Audit Log: All admin actions logged (who, what, when)

**Tier 2 - Game Operations (Phase 4):**
- Game Configuration: Platform fee %, stake amounts, XP/level tuning
- Room Monitoring: Spectate live rooms, view kill history, player activity logs
- Announcements: Server notices, maintenance windows

**Tier 3 - Advanced (Phase 5):**
- Anti-Cheat Dashboard: Flagged players, reports, investigation tools
- Support Tools: View tickets, issue refunds, account corrections
- Detailed Analytics: Charts, retention, kill rates, economy health, average earnings per player

### 5.2 Access Control

**Roles:**
- **Super-Admin:** Full access (manage admins, critical configs, all actions)
- **Admin:** User management, transactions, monitoring (no critical config changes)
- **Support:** View accounts/transactions, small refunds (<$10), no bans/config

**Admin UI:**
- Framework: React (separate from game frontend)
- Authentication: Strong auth + 2FA required
- IP restrictions: Optional (limit to known networks)

### 5.3 Security

**Anti-Cheat:**
- Server-side validation: Movement/aim validation, speed limits
- Rate limiting on critical actions
- CAPTCHA on suspicious behavior

**2FA:**
- Required for: Login, Cash-out
- Optional for: Other actions

**Transaction Verification:**
- Store Solana transaction signatures (tx IDs) in database
- Provide "View on Solscan" links in UI
- Admin can verify any transaction on-chain
- Transaction history shows: Amount, Type, Status, Solscan link, Timestamp

---

## 6. Multiplayer & Netcode

### 6.1 Architecture

**Authority Model:**
- Dedicated server (Node.js backend) is authoritative
- Clients send input (movement, shooting)
- Server validates, simulates, broadcasts state
- Prevents cheating (critical for betting system)

**Tick Rate:**
- Target: 30-60 ticks per second
- Start with 30 ticks/sec (33ms per tick)
- Increase to 60 if performance allows

**Reconciliation:**
- Client-side prediction for responsiveness
- Server sends authoritative state
- Client reconciles differences (rollback if needed)
- Example: Client moves forward → Server says "hit" → Client shows hit animation

**Latency:**
- Target: <150ms for good experience
- Show ping indicator in UI
- Consider regional servers if needed (beta)

**Scale:**
- Start: 20 players per match
- Scale to: 50+ players per match
- Admin can configure max players per room

---

## 7. Performance Targets

**FPS:**
- Desktop: 60 FPS
- Mobile: 30+ FPS

**Network:**
- 30-60 updates per second (tick rate)

**Load Times:**
- Initial load: <3 seconds
- Room join: <1 second

**Optimization:**
- Object pooling for bullets/projectiles
- Cull off-screen entities
- Compress WebSocket messages
- Delta updates (send only changes)

**Target Browsers:**
- Chrome, Firefox, Safari, Edge (desktop)
- Mobile Safari, Chrome Mobile (beta)

---

## 8. Development Phases & Timeline

### Phase 1: Core Gameplay and Bot Logic (Week 1-2)

**Objective:** Set up basic gameplay mechanics and kill button functionality.

**Tasks:**
1. **Tank Movement & Shooting:**
   - Implement WASD/Arrow key movement
   - Mouse aiming and shooting controls
   - Projectile firing mechanics
   - Tank collision detection (tank vs tank, tank vs bullet, tank vs pellet)
   - **Tank rendering:** Draw tanks programmatically using Canvas API (circle body + rotating barrel)
   - **Bullet rendering:** Draw bullets programmatically (small circles with optional trails)

2. **Canvas Setup:**
   - Initialize HTML5 Canvas
   - Set up game loop (requestAnimationFrame)
   - Render tanks, bullets, pellets, arena
   - **Note:** Tanks and bullets will be drawn programmatically (no sprite images needed)

3. **FFA Mode:**
   - Basic continuous arena structure (no teams)
   - Player spawn system
   - Game start logic (no end—continuous)

4. **Kill Button:**
   - Implement kill button UI
   - Self-kill functionality (10% penalty, 90% refund)
   - Remove player from match on self-kill
   - Process refund: 90% to player account, 10% to server

5. **Basic Economy (Fake):**
   - Simple balance tracking (in-memory for now)
   - Room selection UI ($1, $5, $10)
   - Basic wagering logic

**Deliverables:**
- Playable single-player or local multiplayer prototype
- Basic tank movement and shooting
- Kill button working

---

### Phase 2: Account System and Payment Integration (Week 3-4)

**Objective:** Develop account creation and fake currency payment system.

**Tasks:**
1. **Account System:**
   - User registration/login (wallet-first, simulated for alpha)
   - User profile storage (balance, wager history, XP)
   - Database schema: Users table

2. **Payment System (Fake Currency):**
   - Test Coins system (fake currency)
   - Initial balance: $100 Test Coins on signup
   - Deposit/withdrawal flows (simulated)
   - Database schema: Transactions table

3. **Multiplayer Integration:**
   - Set up Socket.io server
   - Real-time player synchronization
   - Room management (lobby system)
   - **Room segregation:** Separate rooms for $1, $5, and $10 stakes
   - Players can only join room matching their selected stake
   - Match start logic (10+ players required in same stake room)

4. **Pre-Match Lobby:**
   - Lobby UI (waiting for players)
   - Chat functionality
   - Player count display
   - Match start when 10+ players

**Deliverables:**
- Account system working
- Fake currency deposit/withdrawal flows
- Multiplayer with 2+ players
- Lobby system functional

---

### Phase 3: Bot Mechanics Refinement and Multiplayer Testing (Week 5-6)

**Objective:** Refine multiplayer stability, balance reward systems, and implement admin basics.

**Tasks:**
1. **Multiplayer Testing:**
   - Test with 10+ players
   - Network synchronization refinement
   - Handle disconnects (refund wager, remove from room)
   - Respawn flow (choose room again, check balance)

2. **Player Reward System:**
   - Per-kill reward system: When Player A kills Player B
     - Player A gets 90% of Player B's stake
     - Server gets 10% of Player B's stake
     - Player B loses entire stake
   - Kill button refund system: When player uses kill button
     - Player loses 10% of stake (to server)
     - Player receives 90% refund to account
   - Disconnect refund system: When player disconnects
     - Player receives 100% refund (full wager returned)
   - Immediate reward distribution on each kill
   - Immediate refund processing on kill button/disconnect
   - No match end or winner—continuous arena
   - Database: Track each kill, rewards, fees, refunds per transaction

3. **Admin System (Tier 1):**
   - Admin UI (React) - separate from game
   - User Management: Search/view players, ban/suspend
   - Transaction Oversight: View deposits, withdrawals, bets
   - Server Currency Status: Platform balance, fees, pending payouts
   - User Currency Status: Per-user balance, transaction history
   - Audit Log: Log all admin actions

4. **Game Balance:**
   - Test economy (ensure fees work correctly)
   - Balance XP gains from pellets vs kills
   - Test kill button penalty (10% to server, 90% refund)
   - Verify refund system works correctly

**Deliverables:**
- Stable multiplayer (10+ players)
- Reward system working correctly
   - Basic Admin dashboard (Tier 1 features)

---

### Phase 4: Feedback Collection and Iteration (Week 7-8)

**Objective:** Gather feedback, address issues, refine game.

**Tasks:**
1. **Test Gameplay:**
   - Extensive playtests with multiple players
   - Identify bugs and gather feedback
   - Refine core mechanics based on feedback

2. **Bug Fixing:**
   - Multiplayer synchronization issues
   - Kill button logic (10% penalty, 90% refund)
   - Disconnect handling (full refund)
   - Economy/reward bugs (per-kill rewards, kill button refunds)

3. **Admin System (Tier 2):**
   - Game Configuration: Platform fee %, stake amounts
   - Room Monitoring: Spectate live rooms, kill history, player activity
   - Announcements: Server notices

4. **Optimization:**
   - Performance optimization (FPS, network)
   - Object pooling
   - Message compression
   - Delta updates

**Deliverables:**
- Bug-free alpha version
- Admin system (Tier 2) functional
- Optimized performance

---

### Phase 5: Real-Money Payment Integration (Beta Version - Week 9-10)

**Objective:** Implement SOL cryptocurrency payment integration and prepare for beta launch.

**Tasks:**
1. **Payment Integration (SOL):**
   - Integrate Privy.io (or chosen wallet solution)
   - Connect Solana wallet
   - Deposit SOL to platform wallet
   - Withdraw SOL to player wallet

2. **Blockchain Verification:**
   - Store transaction signatures (tx IDs) in database
   - Implement "View on Solscan" links
   - Transaction history with verification
   - Admin can verify transactions on-chain

3. **Admin System (Tier 3):**
   - Anti-Cheat Dashboard: Flagged players, reports
   - Support Tools: Refunds, account corrections
   - Detailed Analytics: Charts, retention, win rates

4. **Security Hardening:**
   - 2FA implementation (login, cash-out)
   - Server-side anti-cheat validation
   - Rate limiting
   - CAPTCHA on suspicious actions

5. **Final Testing:**
   - Beta testing with real SOL (small amounts)
   - Test all payment flows
   - Verify transaction transparency
   - Test admin tools

**Deliverables:**
- Real-money payment system working
- Blockchain verification functional
   - Complete Admin system (all tiers)
   - Secure, production-ready beta version

---

## 9. Database Schema (High-Level)

### Users Table
- id, wallet_address, balance, created_at, updated_at

### Rooms Table
- id, room_stake, start_time, status (active/closed), player_count

### Transactions Table
- id, user_id, type (deposit/withdrawal/wager/kill_reward/kill_fee/kill_button_refund/kill_button_fee/disconnect_refund), amount, status, related_kill_id (if kill-related), related_room_id, tx_signature (beta), created_at

### Kills Table
- id, room_id, killer_id, victim_id, victim_stake, killer_reward, platform_fee, timestamp

### Room_Participants Table
- room_id, user_id, wager_amount, join_time, leave_time, final_level, total_kills, total_earned

### Admin_Actions Table
- id, admin_id, action_type, target_user_id, details, created_at

---

## 10. API/WebSocket Messages (High-Level)

### WebSocket Events (Client → Server)
- `join_room` (stake_level: 1, 5, or 10)
  - Player joins room matching their stake level
  - Server validates balance and stake amount
  - Player can only join room with same stake as their wager
- `leave_room`
- `player_move` (x, y, angle)
- `player_shoot` (angle)
- `kill_self`
- `disconnect`

### WebSocket Events (Server → Client)
- `room_joined` (room_id, player_count, your_stake)
- `match_start` (players, arena_info)
- `player_update` (player_id, x, y, angle, level, stats)
- `bullet_spawn` (bullet_id, x, y, angle, owner_id)
- `player_killed` (killer_id, victim_id, reward_amount, platform_fee)
- `player_left` (player_id, reason: kill_button/disconnect)
- `room_update` (player_count, active_players)

### REST API Endpoints
- `POST /api/auth/wallet-connect`
- `GET /api/user/balance`
- `POST /api/user/deposit` (alpha: fake, beta: SOL)
- `POST /api/user/withdraw` (alpha: fake, beta: SOL)
- `GET /api/user/transactions`
- `GET /api/admin/users` (admin only)
- `GET /api/admin/transactions` (admin only)
- `GET /api/admin/server-stats` (admin only)

---

## 11. Security Considerations

### Blockchain Transparency
- All SOL transactions processed through Solana blockchain
- Transactions are provably fair and transparent
- Players can verify transactions on Solscan.io

### Payment Gateway Security
- SSL encryption for all transactions
- 2FA required for login and cash-out
- Rate limiting on deposit/withdrawal

### Anti-Cheat and Bot Detection
- Server-side validation (movement, aim, speed)
- Rate limiting on actions
- CAPTCHA on suspicious behavior
- Admin tools for investigation

### Admin Security
- Strong authentication + 2FA for admin accounts
- IP restrictions (optional)
- Audit log for all admin actions
- Role-based access control

---

## 12. Future Enhancements (Post-Beta)

- Team-based matches
- Chat functions
- Advanced matchmaking (skill-based)
- Mobile responsive design (if not in beta)
- Additional game modes
- Leaderboards
- Achievements

---

## Conclusion

This development plan provides a comprehensive roadmap for building a skill-based PvP tank battle game with a betting system. The phased approach allows for iterative development, testing, and refinement before launching with real-money transactions.
