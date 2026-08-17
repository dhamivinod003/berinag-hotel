import { Router } from "express";
import {
  availabilityHandler,
  createEnquiryHandler,
  createFromHoldHandler,
  createHoldHandler,
  createPaymentOrderHandler,
  getAggregateRating,
  getAmenities,
  getAttractions,
  getGallery,
  getHoldHandler,
  getOffers,
  getPaymentConfigHandler,
  getResort,
  getReviews,
  getRoomTypeBySlug,
  getRoomTypes,
  lookupHandler,
  releaseHoldHandler,
  verifyPaymentHandler,
} from "../controllers/publicController.js";
import { availabilityLimiter, holdLimiter, paymentLimiter, enquiryLimiter } from "../middleware/rateLimit.js";

export const publicRouter = Router();

// Content
publicRouter.get("/resort", getResort);
publicRouter.get("/rooms", getRoomTypes);
publicRouter.get("/rooms/:slug", getRoomTypeBySlug);
publicRouter.get("/offers", getOffers);
publicRouter.get("/reviews", getReviews);
publicRouter.get("/reviews/aggregate", getAggregateRating);
publicRouter.get("/gallery", getGallery);
publicRouter.get("/nearby", getAttractions);
publicRouter.get("/amenities", getAmenities);

// Availability
publicRouter.get("/availability", availabilityLimiter, availabilityHandler);
publicRouter.post("/availability/hold", holdLimiter, createHoldHandler);
publicRouter.get("/availability/hold/:holdId", getHoldHandler);
publicRouter.delete("/availability/hold/:holdId", releaseHoldHandler);

// Booking
publicRouter.post("/bookings", createFromHoldHandler);
publicRouter.get("/bookings/lookup", availabilityLimiter, lookupHandler);

// Payments
publicRouter.get("/payments/config", getPaymentConfigHandler);
publicRouter.post("/payments/orders", paymentLimiter, createPaymentOrderHandler);
publicRouter.post("/payments/verify", paymentLimiter, verifyPaymentHandler);

// Enquiries
publicRouter.post("/enquiries", enquiryLimiter, createEnquiryHandler);
