import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("NICE Proxy API running 🚀");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

async function getNiceToken() {
  const response = await fetch(
    `${process.env.NICE_AUTH_URL}/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.NICE_CLIENT_ID,
        client_secret: process.env.NICE_CLIENT_SECRET,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

app.get("/token", async (req, res) => {
  try {
    const token = await getNiceToken();
    res.json(token);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
