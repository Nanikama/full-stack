# Skillbrzee Backend API

Node.js + Express + MongoDB backend that powers the Skillbrzee frontend — handling auth, Razorpay payments, course management, and enrollment emails.

---

## 📁 Project Structure

```
skillbrzee-backend/
├── server.js               ← Entry point
├── .env.example            ← Environment variable template
├── package.json
├── models/
│   ├── User.js             ← User schema (auth + enrollments)
│   ├── Payment.js          ← Payment records
│   └── Course.js           ← Course catalogue
├── routes/
│   ├── auth.js             ← /api/auth  (register, login, me)
│   ├── courses.js          ← /api/courses
│   └── payments.js         ← /api/payments (create-order, verify)
├── middleware/
│   └── auth.js             ← JWT protect + admin guard
└── utils/
    └── mailer.js           ← Nodemailer enrollment emails
```

---

## ⚙️ Setup

### 1. Install dependencies
```bash
cd skillbrzee-backend
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in every value:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB local or Atlas connection string |
| `JWT_SECRET` | Long random string (e.g. `openssl rand -hex 32`) |
| `RAZORPAY_KEY_ID` | From Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Same as above |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | [Gmail App Password](https://myaccount.google.com/apppasswords) |
| `FRONTEND_URL` | Where your HTML file is served from |

### 3. Start MongoDB
```bash
# Local MongoDB (macOS/Linux)
mongod --dbpath /data/db

# OR use MongoDB Atlas (free tier) and paste the URI in .env
```

### 4. Run the server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Server starts on **http://localhost:5000**

---

## 🔌 Frontend Connection

In the HTML file, the `API_BASE` constant is already set:
```js
const API_BASE = 'http://localhost:5000/api';
```

For production, change it to your server domain:
```js
const API_BASE = 'https://api.skillbrzee.in/api';
```

---

## 📡 API Reference

### Auth

| Method | Endpoint | Auth | Body |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | `name, email, phone, password` |
| POST | `/api/auth/login` | ❌ | `email, password` |
| GET | `/api/auth/me` | ✅ Bearer | — |

**Register response:**
```json
{ "accessToken": "...", "user": { "id", "name", "email", "phone", "role" } }
```

---

### Courses

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/courses` | ❌ Public |
| POST | `/api/courses` | ✅ Admin |
| PUT | `/api/courses/:id` | ✅ Admin |
| DELETE | `/api/courses/:id` | ✅ Admin |

---

### Payments

| Method | Endpoint | Auth | Body |
|---|---|---|---|
| POST | `/api/payments/create-order` | ✅ Bearer | `packageId` |
| POST | `/api/payments/verify` | ✅ Bearer | `razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId` |
| GET | `/api/payments/my-payments` | ✅ Bearer | — |

**Full payment flow:**
1. User fills modal → POST `/api/auth/register` → get token
2. POST `/api/payments/create-order` with `packageId` → get `orderId`
3. Razorpay Checkout opens in browser → user pays
4. Frontend receives `handler(response)` → POST `/api/payments/verify`
5. Backend verifies HMAC signature → enrolls user → sends email

---

### Health Check
```
GET /api/health
→ { "status": "ok", "db": "connected" }
```

---

## 📦 Package Prices (matches frontend)

| ID | Name | Price |
|---|---|---|
| 1 | STARTER PACKAGE | ₹500 |
| 2 | BASIC PACKAGE | ₹1,499 |
| 3 | SILVER PACKAGE | ₹2,999 |
| 4 | GOLD PACKAGE | ₹5,499 |
| 5 | DIAMOND PACKAGE | ₹9,999 |
| 6 | PREMIUM PACKAGE | ₹14,999 |

---

## 🚀 Deployment (Render / Railway / VPS)

1. Push code to GitHub
2. Set all environment variables in dashboard
3. Set **Start Command**: `node server.js`
4. Set **Build Command**: `npm install`
5. Update `API_BASE` in frontend HTML to your live domain
6. Add your live domain to `allowedOrigins` in `server.js`

---

## 🔐 Security Notes

- Passwords are hashed with **bcrypt** (12 rounds)
- JWT tokens expire in **7 days**
- Razorpay signature is verified using **HMAC-SHA256** before any enrollment
- CORS is restricted to known origins only

---

*Developed for Skillbrzee — India's Trusted Learning Platform*
