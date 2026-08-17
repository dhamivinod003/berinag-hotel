import { Router } from "express";
import {
  assignRoomHandler,
  assignRoomSchema,
  cancelReservationHandler,
  cancelReservationSchema,
  checkInHandler,
  checkOutHandler,
  confirmReservationHandler,
  confirmReservationSchema,
  createStaff,
  createStaffSchema,
  dashboardSummary,
  decideExtensionHandler,
  extensionDecisionSchema,
  extensionRequestSchema,
  getHero,
  getReservation,
  getSettings,
  housekeepingBoard,
  listAuditLog,
  listEnquiries,
  listOffers,
  listReservations,
  listRoles,
  listRoomTypes,
  listRooms,
  listStaff,
  moveRoomHandler,
  moveRoomSchema,
  refundPaymentHandler,
  refundPaymentSchema,
  requestExtensionHandler,
  getCalendarViewHandler,
  updateEnquiry,
  updateEnquirySchema,
  updateHero,
  updateHeroSchema,
  updateHkTask,
  updateHkTaskSchema,
  updateRoomStatus,
  updateSettings,
  updateSettingsSchema,
  updateStaff,
  updateStaffSchema,
  roomStatusSchema,
  listReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  reviewSchema,
  listNotifications,
  notificationUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  uploadFile,
  uploadMiddleware,
} from "../controllers/adminController.js";
import {
  exportGuests,
  getGuest,
  listGuests,
  updateGuest,
  updateGuestSchema,
} from "../controllers/guestsController.js";
import {
  getBookingsReport,
  getDashboardReport,
  getEnquiryReport,
  getOccupancyReport,
  getRevenueReport,
  getRoomPerformanceReport,
} from "../controllers/reportsController.js";
import {
  addGalleryImage,
  addGalleryImageSchema,
  addRoomPhoto,
  addRoomPhotoSchema,
  createRatePlan,
  deleteGalleryImage,
  deleteOffer,
  deleteRatePlan,
  deleteRoomPhoto,
  getOffer,
  listRatePlans,
  offerUpsertSchema,
  ratePlanSchema,
  updateRoomType,
  updateRoomTypeSchema,
  upsertOffer,
} from "../controllers/configController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { adminMutateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  createEnquiryHandler,
  createFromHoldHandler,
  createFromHoldSchema,
  createHoldHandler,
  createHoldSchema,
  getHoldHandler,
  releaseHoldHandler,
} from "../controllers/publicController.js";
import { holdLimiter } from "../middleware/rateLimit.js";

export const adminRouter = Router();

// All admin routes require auth.
adminRouter.use(requireAuth);

// Dashboard
adminRouter.get("/dashboard", requirePermission("REPORT_VIEW"), dashboardSummary);

// Staff
adminRouter.get("/staff", requirePermission("STAFF_VIEW"), listStaff);
adminRouter.post("/staff", requirePermission("STAFF_CREATE"), adminMutateLimiter, validate(createStaffSchema), createStaff);
adminRouter.patch("/staff/:id", requirePermission("STAFF_EDIT"), adminMutateLimiter, validate(updateStaffSchema), updateStaff);

// Roles & permissions
adminRouter.get("/roles", requirePermission("RBAC_EDIT"), listRoles);

// Reservations
adminRouter.get("/reservations", requirePermission("BOOKING_VIEW"), listReservations);
adminRouter.get("/reservations/:id", requirePermission("BOOKING_VIEW"), getReservation);
adminRouter.post(
  "/reservations/:id/confirm",
  requirePermission("BOOKING_CONFIRM"),
  adminMutateLimiter,
  validate(confirmReservationSchema),
  confirmReservationHandler
);
adminRouter.post(
  "/reservations/:id/cancel",
  requirePermission("BOOKING_CANCEL"),
  adminMutateLimiter,
  validate(cancelReservationSchema),
  cancelReservationHandler
);
adminRouter.post("/reservations/:id/check-in", requirePermission("BOOKING_CHECKIN"), adminMutateLimiter, checkInHandler);
adminRouter.post("/reservations/:id/check-out", requirePermission("BOOKING_CHECKOUT"), adminMutateLimiter, checkOutHandler);
adminRouter.post(
  "/reservations/:id/assign-room",
  requirePermission("BOOKING_ASSIGN_ROOM"),
  adminMutateLimiter,
  validate(assignRoomSchema),
  assignRoomHandler
);
adminRouter.post(
  "/reservations/:id/move-room",
  requirePermission("BOOKING_MOVE_ROOM"),
  adminMutateLimiter,
  validate(moveRoomSchema),
  moveRoomHandler
);
adminRouter.post(
  "/reservations/:id/extension",
  requirePermission("BOOKING_EXTEND"),
  adminMutateLimiter,
  validate(extensionRequestSchema),
  requestExtensionHandler
);
adminRouter.post(
  "/reservations/:id/extension/:extId/decision",
  requirePermission("BOOKING_EXTEND"),
  adminMutateLimiter,
  validate(extensionDecisionSchema),
  decideExtensionHandler
);

// Walk-in / phone / WhatsApp bookings
adminRouter.post(
  "/reservations/walk-in",
  requirePermission("BOOKING_CREATE_WALKIN"),
  adminMutateLimiter,
  validate(createFromHoldSchema),
  createFromHoldHandler
);
adminRouter.post(
  "/availability/hold",
  requirePermission("BOOKING_CREATE"),
  holdLimiter,
  validate(createHoldSchema),
  createHoldHandler
);
adminRouter.get("/availability/hold/:holdId", requirePermission("BOOKING_VIEW"), getHoldHandler);
adminRouter.delete("/availability/hold/:holdId", requirePermission("BOOKING_CREATE"), releaseHoldHandler);

// Payments
adminRouter.post(
  "/payments/:id/refund",
  requirePermission("BOOKING_REFUND"),
  adminMutateLimiter,
  validate(refundPaymentSchema),
  refundPaymentHandler
);

// Rooms
adminRouter.get("/room-types", requirePermission("ROOM_TYPE_VIEW"), listRoomTypes);
adminRouter.patch(
  "/room-types/:id",
  requirePermission("ROOM_TYPE_EDIT"),
  adminMutateLimiter,
  validate(updateRoomTypeSchema),
  updateRoomType
);
// Room type photos
adminRouter.post(
  "/room-types/:id/photos",
  requirePermission("ROOM_TYPE_EDIT"),
  adminMutateLimiter,
  validate(addRoomPhotoSchema),
  addRoomPhoto
);
adminRouter.delete(
  "/room-types/:id/photos/:photoId",
  requirePermission("ROOM_TYPE_EDIT"),
  deleteRoomPhoto
);
// Rate plans (seasonal/override pricing)
adminRouter.get(
  "/rate-plans",
  requirePermission("ROOM_TYPE_VIEW"),
  listRatePlans
);
adminRouter.post(
  "/rate-plans",
  requirePermission("ROOM_TYPE_EDIT"),
  adminMutateLimiter,
  validate(ratePlanSchema),
  createRatePlan
);
adminRouter.delete(
  "/rate-plans/:id",
  requirePermission("ROOM_TYPE_EDIT"),
  deleteRatePlan
);
// Gallery
adminRouter.post(
  "/gallery",
  requirePermission("CMS_GALLERY_UPLOAD"),
  adminMutateLimiter,
  validate(addGalleryImageSchema),
  addGalleryImage
);
adminRouter.delete(
  "/gallery/:id",
  requirePermission("CMS_GALLERY_UPLOAD"),
  deleteGalleryImage
);
adminRouter.get("/rooms", requirePermission("ROOM_VIEW"), listRooms);
adminRouter.patch(
  "/rooms/:id/status",
  requirePermission("ROOM_EDIT"),
  adminMutateLimiter,
  validate(roomStatusSchema),
  updateRoomStatus
);

// Enquiries
adminRouter.get("/enquiries", requirePermission("ENQUIRY_VIEW"), listEnquiries);
adminRouter.patch(
  "/enquiries/:id",
  requirePermission("ENQUIRY_CREATE"),
  adminMutateLimiter,
  validate(updateEnquirySchema),
  updateEnquiry
);

// Offers
adminRouter.get("/offers", requirePermission("OFFER_VIEW"), listOffers);
adminRouter.get("/offers/:id", requirePermission("OFFER_VIEW"), getOffer);
adminRouter.post(
  "/offers",
  requirePermission("OFFER_EDIT"),
  adminMutateLimiter,
  validate(offerUpsertSchema),
  upsertOffer
);
adminRouter.patch(
  "/offers/:id",
  requirePermission("OFFER_EDIT"),
  adminMutateLimiter,
  validate(offerUpsertSchema),
  upsertOffer
);
adminRouter.delete(
  "/offers/:id",
  requirePermission("OFFER_EDIT"),
  adminMutateLimiter,
  deleteOffer
);

// Housekeeping
adminRouter.get("/housekeeping/board", requirePermission("HOUSEKEEPING_VIEW"), housekeepingBoard);
adminRouter.patch(
  "/housekeeping/tasks/:id",
  requirePermission("HOUSEKEEPING_UPDATE"),
  adminMutateLimiter,
  validate(updateHkTaskSchema),
  updateHkTask
);

// Audit log
adminRouter.get("/audit-log", requirePermission("AUDIT_LOG_VIEW"), listAuditLog);

// Calendar
adminRouter.get("/calendar", requirePermission("BOOKING_VIEW"), getCalendarViewHandler);

// Reports
adminRouter.get(
  "/reports/dashboard",
  requirePermission("REPORT_VIEW"),
  getDashboardReport
);
adminRouter.get(
  "/reports/occupancy",
  requirePermission("REPORT_VIEW"),
  getOccupancyReport
);
adminRouter.get(
  "/reports/revenue",
  requirePermission("REVENUE_VIEW"),
  getRevenueReport
);
adminRouter.get(
  "/reports/bookings",
  requirePermission("REPORT_VIEW"),
  getBookingsReport
);
adminRouter.get(
  "/reports/room-performance",
  requirePermission("REVENUE_VIEW"),
  getRoomPerformanceReport
);
adminRouter.get(
  "/reports/enquiries",
  requirePermission("REPORT_VIEW"),
  getEnquiryReport
);

// Settings
adminRouter.get("/settings", requirePermission("SETTINGS_VIEW"), getSettings);
adminRouter.put(
  "/settings",
  requirePermission("SETTINGS_EDIT"),
  adminMutateLimiter,
  validate(updateSettingsSchema),
  updateSettings
);

// CMS hero
adminRouter.get("/cms/hero", requirePermission("CMS_HERO_EDIT"), getHero);
adminRouter.put(
  "/cms/hero",
  requirePermission("CMS_HERO_EDIT"),
  adminMutateLimiter,
  validate(updateHeroSchema),
  updateHero
);

// ─── Guests ────────────────────────────────────────────────────────────────
adminRouter.get("/guests", requirePermission("GUEST_VIEW"), listGuests);
adminRouter.get("/guests/export", requirePermission("GUEST_EXPORT"), exportGuests);
adminRouter.get("/guests/:id", requirePermission("GUEST_VIEW"), getGuest);
adminRouter.patch(
  "/guests/:id",
  requirePermission("GUEST_EDIT"),
  adminMutateLimiter,
  validate(updateGuestSchema),
  updateGuest
);

// ─── Reviews / Testimonials ────────────────────────────────────────────────
adminRouter.get("/reviews", requirePermission("CMS_REVIEW_EDIT"), listReviews);
adminRouter.get("/reviews/:id", requirePermission("CMS_REVIEW_EDIT"), getReview);
adminRouter.post(
  "/reviews",
  requirePermission("CMS_REVIEW_EDIT"),
  adminMutateLimiter,
  validate(reviewSchema),
  createReview
);
adminRouter.patch(
  "/reviews/:id",
  requirePermission("CMS_REVIEW_EDIT"),
  adminMutateLimiter,
  validate(reviewSchema),
  updateReview
);
adminRouter.delete(
  "/reviews/:id",
  requirePermission("CMS_REVIEW_EDIT"),
  adminMutateLimiter,
  deleteReview
);

// ─── Notifications ─────────────────────────────────────────────────────────
adminRouter.get("/notifications", requirePermission("NOTIFICATION_VIEW"), listNotifications);
adminRouter.get("/notifications/unread-count", requirePermission("NOTIFICATION_VIEW"), notificationUnreadCount);
adminRouter.patch("/notifications/:id/read", requirePermission("NOTIFICATION_VIEW"), markNotificationRead);
adminRouter.post("/notifications/read-all", requirePermission("NOTIFICATION_VIEW"), markAllNotificationsRead);
adminRouter.delete("/notifications/:id", requirePermission("NOTIFICATION_VIEW"), deleteNotification);

// ─── File Upload ──────────────────────────────────────────────────────────
adminRouter.post(
  "/upload",
  requirePermission("CMS_GALLERY_UPLOAD"),
  adminMutateLimiter,
  uploadMiddleware,
  uploadFile
);
