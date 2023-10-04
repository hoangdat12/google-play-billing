const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();
const { default: helmet } = require('helmet');
const compression = require('compression');

const key = require('./service-account-key.json');
const { Database } = require('./init.mysql');

const app = express();

// MIDDLE WARE
app.use(express.json());
// Bao ve thong tin rieng tu cua header
app.use(helmet());
// Giam bang thong
app.use(compression);

// CONNECT DB
Database.getInstance('psql');

// CODE
const jwtClient = new google.auth.JWT(key.client_email, null, key.private_key, [
  'https://www.googleapis.com/auth/androidpublisher',
]);

const DATABASE_NAME = process.env.DATABASE_NAME;

app.post('/verify-purchase', async (req, res) => {
  const { purchaseToken, userId } = req.body;

  try {
    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth: jwtClient,
    });

    const result = await androidPublisher.purchases.products.get({
      packageName: process.env.PACKAGE_NAME,
      productId: process.env.PRODUCT_ID,
      token: purchaseToken,
    });

    const queryStringFindUser = {
      text: `SELECT * FROM "${DATABASE_NAME}" where userId = '${userId}'`,
    };
    const foundTransaction = await query(queryStringFindUser);

    // Save database
    /**
     * userId: ID
     * purchaseToken: string
     * responseData: {
     * // Loai giao dich
        "kind": string,
        "startTimeMillis": date,
        "expiryTimeMillis": date,
        // Tu dong gia han hay khong
        "autoRenewing": boolean,
        "priceCurrencyCode": number,
        "priceAmountMicros": "amount_in_micros",
        "countryCode": "US",
        "developerPayload": "your_developer_payload",
        "orderId": "your_order_id",
        "purchaseType": 0 // 0 for new, 1 for buy again
      }
     * quantity_purchase: number
     * createdAt: Date
     * updatedAt: Date
     */
    const queryString = {
      text: `
          INSERT INTO "${DATABASE_NAME}" (userId, purchaseToken, responseData, quantity_purchase, createdAt, updatedAt)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *;
        `,
      values: [
        userId,
        purchaseToken,
        result.data,
        foundTransaction ? foundTransaction.quantity_purchase : 0,
        new Date(),
        new Date(),
      ],
    };
    const data = await query(queryString);

    res.status(200).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/time-purchase/:userId', async (req, res) => {
  try {
    const userId = req.params('userId');
    const queryString = {
      text: `SELECT * FROM "${DATABASE_NAME}" where userId = '${userId}'`,
    };

    const foundTransaction = await query(queryString);
    if (!foundTransaction) return res.status(400).json({ error: 'Not found!' });

    const createdAt = new Date(foundTransaction.createdAt);
    const now = new Date();

    const timeDifference = now - createdAt;

    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor(
      (timeDifference % (1000 * 60 * 60)) / (1000 * 60)
    );

    return res
      .status(200)
      .json({ time: `${days} days ${hours} hours ${minutes} minus` });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// CREATE TABLE purchases (
//   id SERIAL PRIMARY KEY,
//   userId INTEGER,
//   purchaseToken VARCHAR(255),
//   responseData JSONB,
//   createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );
