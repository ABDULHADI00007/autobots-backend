import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { stripeWebhook } from "./modules/orders/order.controller.js";

const app = express();

app.use(cors());

// Webhook — raw body required, must be before express.json()
app.post("/api/orders/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json());

app.use("/api", routes);

export default app;