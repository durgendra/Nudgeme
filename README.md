# StakeUp - Goal Achievement with Financial Incentives

A React Native app (iOS & Android) that helps people achieve their goals through financial accountability. Users create goals with seed money, invite participants, and earn rewards for successful completion.

## Features

- **Goal Creation**: Create goals with seed money, deadlines, and verification criteria
- **Participation System**: Join others' goals with optional monetary contributions
- **AI Verification**: OpenAI Vision API verifies goal completion through image proof
- **In-App Wallet**: Secure wallet for deposits, contributions, and payouts
- **Stripe Integration**: Seamless payments for deposits and withdrawals
- **Social Sharing**: Share goals via links and social media
- **Push Notifications**: Stay updated on goal progress and payments

## How It Works

1. **Create a Goal**: Set a goal, add seed money from your wallet, and set a deadline
2. **Invite Participants**: Share your goal via link or social media
3. **Participants Join**: Friends can join with $0 or contribute money to increase the pot
4. **Complete & Verify**: Submit proof of completion (photo/data) for AI verification
5. **Get Rewarded**:
   - **Success**: Creator receives 95% of total pot (5% platform fee)
   - **Failure**: Participants get refunds + share of creator's seed money

## Tech Stack

### Frontend (Mobile)

- React Native with Expo
- TypeScript
- React Navigation
- Stripe React Native SDK
- Expo Notifications, Image Picker, Secure Store

### Backend

- Node.js + Express
- MongoDB with Mongoose
- JWT Authentication
- Stripe API
- OpenAI Vision API

## Project Structure

```
StakeUp/
├── mobile/                 # React Native app
│   ├── src/
│   │   ├── screens/        # Screen components
│   │   ├── components/     # Reusable components
│   │   ├── navigation/     # Navigation setup
│   │   ├── services/       # API services
│   │   ├── store/          # State management
│   │   ├── utils/          # Helper functions
│   │   └── types/          # TypeScript types
│   ├── App.tsx
│   └── package.json
├── backend/                # Node.js backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── models/         # MongoDB models
│   │   ├── middleware/     # Auth, validation
│   │   ├── services/       # Business logic
│   │   └── utils/          # Helpers
│   ├── server.js
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ (20+ recommended)
- MongoDB
- Stripe Account
- OpenAI API Key
- Expo CLI (`npm install -g expo-cli`)

### Backend Setup

1. Navigate to backend directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` file from example:

   ```bash
   cp env.example .env
   ```

4. Update `.env` with your credentials:

   ```
   MONGODB_URI=mongodb://localhost:27017/stakeup
   JWT_SECRET=your-secret-key
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   OPENAI_API_KEY=sk-...
   GOOGLE_CLIENT_ID=...
   PLATFORM_FEE_PERCENTAGE=5
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

### Mobile App Setup

1. Navigate to mobile directory:

   ```bash
   cd mobile
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` file from example:

   ```bash
   cp env.example .env
   ```

4. Update `.env` with your configuration:

   ```
   EXPO_PUBLIC_API_URL=http://localhost:3000/api
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

5. Start the Expo development server:

   ```bash
   npx expo start
   ```

6. Run on iOS simulator or Android emulator, or scan QR code with Expo Go app

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user

### Goals

- `POST /api/goals` - Create new goal
- `GET /api/goals` - List user's goals
- `GET /api/goals/:id` - Get goal details
- `POST /api/goals/:id/join` - Join a goal
- `GET /api/goals/:id/participants` - List participants

### Payments

- `GET /api/payments/wallet-balance` - Get wallet balance
- `POST /api/payments/add-funds` - Create Stripe payment intent
- `POST /api/payments/withdraw` - Request withdrawal
- `GET /api/payments/transactions` - Transaction history

### Verification

- `POST /api/verification/:goalId` - Submit completion proof
- `GET /api/verification/:goalId` - Get verification status

## Monetization

Platform fee of 5% (configurable) on successful goal completion:

| Scenario | Total Pot | Platform Fee | Creator Receives                 |
| -------- | --------- | ------------ | -------------------------------- |
| Success  | $100      | $5           | $95                              |
| Failure  | $100      | $0           | $0 (distributed to participants) |

## Environment Variables

### Backend

| Variable                  | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `NODE_ENV`                | Environment mode (`development` or `production`) |
| `MONGODB_URI`             | MongoDB connection string                        |
| `JWT_SECRET`              | Secret for JWT signing                           |
| `STRIPE_SECRET_KEY`       | Stripe secret key                                |
| `STRIPE_WEBHOOK_SECRET`   | Stripe webhook secret                            |
| `OPENAI_API_KEY`          | OpenAI API key                                   |
| `GOOGLE_CLIENT_ID`        | Google OAuth client ID                           |
| `PLATFORM_FEE_PERCENTAGE` | Platform fee (default: 5)                        |

## Development Mode

When `NODE_ENV=development`, the following features are enabled:

- **Add Funds without Stripe**: Funds are added directly to the wallet without processing a real Stripe transaction. This allows testing the app flow without needing actual payment credentials.

### Mobile

| Variable                             | Description            |
| ------------------------------------ | ---------------------- |
| `EXPO_PUBLIC_API_URL`                | Backend API URL        |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
