const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs/promises");
const path = require("path");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BOOKING_BASE_URL = process.env.BOOKING_BASE_URL || `http://localhost:${PORT}`;
const OWNER_EMAIL = process.env.OWNER_EMAIL || "shah.chandrashekher@gmail.com";
const OWNER_PHONE = process.env.OWNER_PHONE || "214-606-7901";
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_USER || OWNER_EMAIL;
const DATA_PATH = path.join(__dirname, "data.json");
const CANCEL_RESCHEDULE_LOCK_HOURS = 2;

const BARBERS = [
  { id: "b1", name: "Raj" },
  { id: "b2", name: "Aman" },
  { id: "b3", name: "Sujan" },
  { id: "b4", name: "Dipesh" },
];

const SERVICES = [
  { id: "haircut", name: "Haircut", price: 35, durationMin: 30 },
  { id: "beard-trim", name: "Beard Trim", price: 18, durationMin: 20 },
  { id: "haircut-beard", name: "Haircut + Beard", price: 48, durationMin: 45 },
  { id: "kids-cut", name: "Kids Haircut", price: 28, durationMin: 25 },
  { id: "head-shave", name: "Head Shave", price: 30, durationMin: 30 },
  { id: "hot-towel-shave", name: "Hot Towel Shave", price: 32, durationMin: 35 },
  { id: "lineup", name: "Line Up / Edge Up", price: 15, durationMin: 15 },
];

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function ensureDataFile() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    const initial = { bookings: [], history: [] };
    await fs.writeFile(DATA_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readData() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function serviceById(serviceId) {
  return SERVICES.find((service) => service.id === serviceId);
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}

function toE164(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return null;
}

function isActiveBooking(booking) {
  return ["booked", "checked_in", "serving"].includes(booking.status);
}

function generateConfirmationCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function toDateTime(startIso, durationMin) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMin * 60000);
  return { start, end };
}

function overlaps(existingStartIso, existingDurationMin, requestedStartIso, requestedDurationMin) {
  const existing = toDateTime(existingStartIso, existingDurationMin);
  const requested = toDateTime(requestedStartIso, requestedDurationMin);
  return requested.start < existing.end && requested.end > existing.start;
}

function isBarberAvailable(bookings, barberId, startTime, durationMin, skipBookingId = null) {
  return !bookings.some((existing) => {
    if (skipBookingId && existing.id === skipBookingId) return false;
    if (!isActiveBooking(existing)) return false;
    if (existing.barberId !== barberId) return false;
    return overlaps(existing.startTime, existing.durationMin, startTime, durationMin);
  });
}

function findAvailableBarber(bookings, startTime, durationMin, skipBookingId = null) {
  return BARBERS.find((barber) =>
    isBarberAvailable(bookings, barber.id, startTime, durationMin, skipBookingId),
  );
}

function policyWindowPassed(startTimeIso) {
  const startTime = new Date(startTimeIso);
  const thresholdMs = CANCEL_RESCHEDULE_LOCK_HOURS * 60 * 60 * 1000;
  return startTime.getTime() - Date.now() < thresholdMs;
}

function isCentralTimeBetween(date, startHour, endHour) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= startHour * 60 && totalMinutes < endHour * 60;
}

async function sendNotifications(booking, type) {
  const manageLink = `${BOOKING_BASE_URL}/?code=${encodeURIComponent(booking.confirmationCode)}&phone=${encodeURIComponent(booking.customerPhone)}`;
  const message = `${type.toUpperCase()}\n` +
    `Customer: ${booking.customerName}\n` +
    `Phone: ${booking.customerPhone}\n` +
    `Email: ${booking.customerEmail || "Not provided"}\n` +
    `Service: ${booking.serviceName}\n` +
    `Barber: ${booking.barberName}\n` +
    `Time: ${new Date(booking.startTime).toLocaleString()}\n` +
    `Code: ${booking.confirmationCode}\n` +
    `Manage: ${manageLink}`;

  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_PORT
  ) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: OWNER_EMAIL,
        subject: `Himal Glow Studio - ${type}`,
        text: message,
      });
      console.log(`Email sent to ${OWNER_EMAIL} for ${type.toLowerCase()}.`);

      const customerTypesForEmail = /booked|rescheduled|cancelled|reminder/i;
      console.log(`Customer email branch: email=${booking.customerEmail}, type=${type}, allowed=${customerTypesForEmail.test(type)}`);
      if (booking.customerEmail && customerTypesForEmail.test(type)) {
        const customerSubject = `Your Himal Glow Studio booking: ${type}`;
        const customerMessage = `Hello ${booking.customerName},\n\n` +
          `Your booking details are below:\n` +
          `Service: ${booking.serviceName}\n` +
          `Barber: ${booking.barberName}\n` +
          `Time: ${new Date(booking.startTime).toLocaleString()}\n` +
          `Confirmation code: ${booking.confirmationCode}\n` +
          `Manage your booking: ${manageLink}\n\n` +
          `Thank you for choosing Himal Glow Studio.`;

        await transporter.sendMail({
          from: EMAIL_FROM,
          to: booking.customerEmail,
          subject: customerSubject,
          text: customerMessage,
        });
        console.log(`Email sent to customer ${booking.customerEmail} for ${type.toLowerCase()}.`);
      }
    } catch (error) {
      console.error("Email notification failed:", error.message);
    }
  } else {
    console.warn(`SMTP is not configured. Would notify ${OWNER_EMAIL}: ${message}`);
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const ownerDigits = OWNER_PHONE.replace(/\D/g, "");
      const ownerPhoneE164 = ownerDigits.length === 10 ? `+1${ownerDigits}` : `+${ownerDigits}`;
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_FROM_NUMBER,
        to: ownerPhoneE164,
      });

      const customerPhoneE164 = toE164(booking.customerPhone);
      const bookingTypesForCustomer = /booked|rescheduled|cancelled/i;
      if (customerPhoneE164 && bookingTypesForCustomer.test(type)) {
        const customerMessage = `${type} confirmed for ${booking.customerName}. ` +
          `Service: ${booking.serviceName} at ${new Date(booking.startTime).toLocaleString()}. ` +
          `Code: ${booking.confirmationCode}. Manage: ${manageLink}`;
        await client.messages.create({
          body: customerMessage,
          from: process.env.TWILIO_FROM_NUMBER,
          to: customerPhoneE164,
        });
        console.log(`SMS sent to customer ${customerPhoneE164} for ${type.toLowerCase()}.`);
      }
    } catch (error) {
      console.error("SMS notification failed:", error.message);
    }
  } else {
    console.log(`SMS not configured. Would notify ${OWNER_PHONE} and the customer: ${message}`);
  }
}

async function processReminders() {
  const data = await readData();
  const now = Date.now();
  let changed = false;

  for (const booking of data.bookings) {
    if (booking.status !== "booked") continue;
    const msUntil = new Date(booking.startTime).getTime() - now;
    if (msUntil <= 0) continue;
    booking.reminders = booking.reminders || { dayBefore: false, hourBefore: false };

    if (msUntil <= 24 * 60 * 60 * 1000 && !booking.reminders.dayBefore) {
      await sendNotifications(booking, "Reminder: appointment in 24 hours");
      booking.reminders.dayBefore = true;
      changed = true;
    }
    if (msUntil <= 60 * 60 * 1000 && !booking.reminders.hourBefore) {
      await sendNotifications(booking, "Reminder: appointment in 1 hour");
      booking.reminders.hourBefore = true;
      changed = true;
    }
  }

  if (changed) {
    await writeData(data);
  }
}

function ownerAuthorized(req) {
  const provided = req.headers["x-owner-pin"];
  const expected = process.env.OWNER_PIN || "1234";
  return provided === expected;
}

function sanitizeForCustomerView(booking) {
  const { customerPhone, ...rest } = booking;
  return rest;
}

app.get("/api/config", (_req, res) => {
  res.json({
    salon: {
      name: "Himal Glow Studio",
      address: "Euless, Texas",
      phone: "222-222-2222",
      note: "Walk-ins are always welcome.",
    },
    barbers: BARBERS,
    services: SERVICES,
  });
});

app.get("/api/bookings/upcoming", async (req, res) => {
  const data = await readData();
  const nowMs = Date.now();
  const phone = normalizePhone(req.query.phone);
  let upcoming = data.bookings
    .filter((booking) => new Date(booking.startTime).getTime() >= nowMs - 60000 && booking.status === "booked")
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  if (phone) {
    upcoming = upcoming.filter((booking) => normalizePhone(booking.customerPhone) === phone);
  }
  res.json(upcoming.map(sanitizeForCustomerView));
});

app.get("/api/bookings/currently-serving", async (_req, res) => {
  const data = await readData();
  const currentlyServing = data.bookings
    .filter((booking) => booking.status === "serving")
    .sort((a, b) => new Date(a.serviceStartedAt || a.startTime) - new Date(b.serviceStartedAt || b.startTime));
  res.json(currentlyServing.map(sanitizeForCustomerView));
});

app.post("/api/bookings", async (req, res) => {
  const { customerName, customerPhone, customerEmail, serviceId, barberId, startTime } = req.body;
  if (!customerName || !customerPhone || !customerEmail || !serviceId || !barberId || !startTime) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const normalizedCustomerPhone = normalizePhone(customerPhone);
  if (normalizedCustomerPhone.length !== 10) {
    return res.status(400).json({ error: "Invalid customer phone number." });
  }

  const normalizedCustomerEmail = String(customerEmail || "").trim().toLowerCase();
  if (!normalizedCustomerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedCustomerEmail)) {
    return res.status(400).json({ error: "Invalid customer email address." });
  }

  const service = serviceById(serviceId);
  if (!service) {
    return res.status(400).json({ error: "Invalid barber or service." });
  }

  const requestedStart = new Date(startTime);
  if (Number.isNaN(requestedStart.getTime())) {
    return res.status(400).json({ error: "Invalid booking time." });
  }
  const now = Date.now();
  const walkInWindowMs = 5 * 60 * 1000;
  const differenceMs = requestedStart.getTime() - now;
  if (differenceMs < -walkInWindowMs) {
    return res.status(400).json({ error: "Booking time must be in the future." });
  }
  if (Math.abs(differenceMs) <= walkInWindowMs && !isCentralTimeBetween(requestedStart, 8, 21)) {
    return res
      .status(400)
      .json({ error: "Walk-in booking must be between 8:00am-09:00pm CST." });
  }

  const data = await readData();
  let selectedBarber = null;
  const normalizedBarberId = String(barberId).trim().toLowerCase();
  if (normalizedBarberId === "any" || normalizedBarberId.includes("any")) {
    selectedBarber = findAvailableBarber(data.bookings, startTime, service.durationMin);
    if (!selectedBarber) {
      return res.status(409).json({
        error: "No barber is available at the selected time.",
      });
    }
  } else {
    selectedBarber = BARBERS.find((item) => item.id === barberId);
    if (!selectedBarber) {
      return res.status(400).json({ error: "Invalid barber or service." });
    }
    const conflict = !isBarberAvailable(data.bookings, selectedBarber.id, startTime, service.durationMin);
    if (conflict) {
      return res.status(409).json({
        error: "Time conflict: that barber is already booked for the selected time.",
      });
    }
  }

  const booking = {
    id: `bk_${Date.now()}`,
    customerName: customerName.trim(),
    customerPhone: normalizedCustomerPhone,
    customerEmail: normalizedCustomerEmail,
    confirmationCode: generateConfirmationCode(),
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    durationMin: service.durationMin,
    barberId: selectedBarber.id,
    barberName: selectedBarber.name,
    startTime: requestedStart.toISOString(),
    status: "booked",
    createdAt: new Date().toISOString(),
    checkedInAt: null,
    reminders: { dayBefore: false, hourBefore: false },
    serviceStartedAt: null,
  };

  const duplicateCustomerSlot = data.bookings.find((existing) => {
    if (!isActiveBooking(existing)) return false;
    if (normalizePhone(existing.customerPhone) !== booking.customerPhone) return false;
    return existing.startTime.slice(0, 16) === booking.startTime.slice(0, 16);
  });
  if (duplicateCustomerSlot) {
    return res
      .status(409)
      .json({ error: "This customer already has a booking at the same day and time." });
  }

  data.bookings.push(booking);
  await writeData(data);
  await sendNotifications(booking, "Booked");
  res.status(201).json(booking);
});

app.post("/api/bookings/manage", async (req, res) => {
  const { confirmationCode, customerPhone } = req.body;
  if (!confirmationCode || !customerPhone) {
    return res.status(400).json({ error: "Confirmation code and phone are required." });
  }
  const normalizedCustomerPhone = normalizePhone(customerPhone);
  if (normalizedCustomerPhone.length !== 10) {
    return res.status(400).json({ error: "Invalid phone number." });
  }
  const data = await readData();
  const booking = data.bookings.find(
    (item) =>
      item.confirmationCode === String(confirmationCode).trim().toUpperCase() &&
      normalizePhone(item.customerPhone) === normalizedCustomerPhone,
  );
  if (!booking) {
    return res.status(404).json({ error: "Booking not found for this code and phone." });
  }
  if (booking.status !== "booked") {
    return res.status(400).json({ error: "Only booked appointments can be managed." });
  }
  return res.json(booking);
});

app.post("/api/bookings/:id/reschedule", async (req, res) => {
  const { confirmationCode, customerPhone, newStartTime, barberId } = req.body;
  if (!confirmationCode || !customerPhone || !newStartTime || !barberId) {
    return res.status(400).json({ error: "Missing required fields for reschedule." });
  }
  const normalizedCustomerPhone = normalizePhone(customerPhone);
  if (normalizedCustomerPhone.length !== 10) {
    return res.status(400).json({ error: "Invalid phone number." });
  }
  const data = await readData();
  const booking = data.bookings.find((item) => item.id === req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (
    booking.confirmationCode !== String(confirmationCode).trim().toUpperCase() ||
    normalizePhone(booking.customerPhone) !== normalizedCustomerPhone
  ) {
    return res.status(403).json({ error: "Invalid booking credentials." });
  }
  if (booking.status !== "booked") {
    return res.status(400).json({ error: "Only booked appointments can be rescheduled." });
  }
  if (policyWindowPassed(booking.startTime)) {
    return res.status(400).json({ error: "Reschedule is locked within 2 hours of appointment." });
  }

  const requestedStart = new Date(newStartTime);
  if (Number.isNaN(requestedStart.getTime())) {
    return res.status(400).json({ error: "Invalid new booking time." });
  }
  if (requestedStart.getTime() <= Date.now()) {
    return res.status(400).json({ error: "New booking time must be in the future." });
  }

  let selectedBarber = null;
  const normalizedBarberId = String(barberId).trim().toLowerCase();
  if (normalizedBarberId === "any" || normalizedBarberId.includes("any")) {
    selectedBarber = findAvailableBarber(
      data.bookings,
      requestedStart.toISOString(),
      booking.durationMin,
      booking.id,
    );
    if (!selectedBarber) {
      return res.status(409).json({ error: "No barber is available at the selected time." });
    }
  } else {
    selectedBarber = BARBERS.find((item) => item.id === barberId);
    if (!selectedBarber) return res.status(400).json({ error: "Invalid barber." });
    if (
      !isBarberAvailable(
        data.bookings,
        selectedBarber.id,
        requestedStart.toISOString(),
        booking.durationMin,
        booking.id,
      )
    ) {
      return res.status(409).json({ error: "Time conflict: selected barber is already booked." });
    }
  }

  booking.startTime = requestedStart.toISOString();
  booking.barberId = selectedBarber.id;
  booking.barberName = selectedBarber.name;
  booking.reminders = { dayBefore: false, hourBefore: false };

  const duplicateCustomerSlot = data.bookings.find((existing) => {
    if (existing.id === booking.id) return false;
    if (existing.customerPhone !== booking.customerPhone) return false;
    return existing.startTime.slice(0, 16) === booking.startTime.slice(0, 16);
  });
  if (duplicateCustomerSlot) {
    return res
      .status(409)
      .json({ error: "This customer already has a booking at the same day and time." });
  }

  await writeData(data);
  await sendNotifications(booking, "Rescheduled");
  return res.json(booking);
});

app.post("/api/bookings/:id/cancel", async (req, res) => {
  const { confirmationCode, customerPhone } = req.body;
  if (!confirmationCode || !customerPhone) {
    return res.status(400).json({ error: "Confirmation code and phone are required." });
  }
  const normalizedCustomerPhone = normalizePhone(customerPhone);
  if (normalizedCustomerPhone.length !== 10) {
    return res.status(400).json({ error: "Invalid phone number." });
  }
  const data = await readData();
  const booking = data.bookings.find((item) => item.id === req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (
    booking.confirmationCode !== String(confirmationCode).trim().toUpperCase() ||
    normalizePhone(booking.customerPhone) !== normalizedCustomerPhone
  ) {
    return res.status(403).json({ error: "Invalid booking credentials." });
  }
  if (booking.status !== "booked") {
    return res.status(400).json({ error: "Only booked appointments can be cancelled." });
  }
  if (policyWindowPassed(booking.startTime)) {
    return res.status(400).json({ error: "Cancellation is locked within 2 hours of appointment." });
  }
  data.bookings = data.bookings.filter((item) => item.id !== booking.id);
  await writeData(data);
  await sendNotifications(booking, "Cancelled");
  return res.json({ message: "Booking cancelled." });
});

app.post("/api/bookings/:id/checkin", async (req, res) => {
  const bookingId = req.params.id;
  const { customerPhone } = req.body;
  const normalizedCustomerPhone = normalizePhone(customerPhone);
  if (normalizedCustomerPhone.length !== 10) {
    return res.status(400).json({ error: "Customer phone is required to check in." });
  }

  const data = await readData();
  const booking = data.bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (normalizePhone(booking.customerPhone) !== normalizedCustomerPhone) {
    return res.status(403).json({ error: "Invalid phone number for this booking." });
  }
  if (booking.status !== "booked") {
    return res.status(400).json({ error: "Booking cannot be checked in at this stage." });
  }

  booking.status = "checked_in";
  booking.checkedInAt = new Date().toISOString();
  data.history.push({ ...booking });
  await writeData(data);
  await sendNotifications(booking, "Checked in");
  res.json(booking);
});

app.post("/api/bookings/:id/start-service", async (req, res) => {
  if (!ownerAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized owner access." });
  }
  const data = await readData();
  const booking = data.bookings.find((item) => item.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "checked_in") {
    return res.status(400).json({ error: "Only checked-in bookings can be started." });
  }
  booking.status = "serving";
  booking.serviceStartedAt = new Date().toISOString();
  await writeData(data);
  return res.json(booking);
});

app.post("/api/bookings/:id/mark-served", async (req, res) => {
  if (!ownerAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized owner access." });
  }
  const data = await readData();
  const booking = data.bookings.find((item) => item.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "serving") {
    return res.status(400).json({ error: "Only currently serving bookings can be marked served." });
  }
  booking.status = "served";
  booking.servedAt = new Date().toISOString();
  await writeData(data);
  return res.json(booking);
});

app.get("/api/owner/dashboard", async (req, res) => {
  if (!ownerAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized owner access." });
  }

  const data = await readData();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const upcoming = data.bookings
    .filter((booking) => ["booked", "checked_in"].includes(booking.status))
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const currentlyServing = data.bookings
    .filter((booking) => booking.status === "serving")
    .sort((a, b) => new Date(a.serviceStartedAt || a.startTime) - new Date(b.serviceStartedAt || b.startTime));

  const todayCheckIns = data.history.filter((item) => item.checkedInAt?.startsWith(todayKey));
  const todayRevenue = todayCheckIns.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const totalUpcomingRevenue = upcoming.reduce((sum, item) => sum + Number(item.price || 0), 0);

  const serviceCounts = {};
  for (const item of data.history) {
    serviceCounts[item.serviceName] = (serviceCounts[item.serviceName] || 0) + 1;
  }
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const hourCounts = {};
  for (const booking of data.bookings) {
    const hour = new Date(booking.startTime).getHours();
    const label = `${hour.toString().padStart(2, "0")}:00`;
    hourCounts[label] = (hourCounts[label] || 0) + 1;
  }
  const busiest = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

  res.json({
    upcoming,
    currentlyServing,
    todayStats: {
      checkIns: todayCheckIns.length,
      revenue: todayRevenue,
      pendingBookings: upcoming.length + currentlyServing.length,
    },
    analytics: {
      projectedRevenue: totalUpcomingRevenue,
      topServices,
      busiestHour: busiest ? { hour: busiest[0], count: busiest[1] } : null,
    },
    services: SERVICES,
  });
});

app.get("/api/owner/history", async (req, res) => {
  if (!ownerAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized owner access." });
  }
  const data = await readData();
  const history = [...data.history].sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));
  res.json(history);
});

app.delete("/api/owner/history", async (req, res) => {
  if (!ownerAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized owner access." });
  }
  const data = await readData();
  data.history = [];
  await writeData(data);
  res.json({ message: "History cleared." });
});

app.delete("/api/owner/history/:id", async (req, res) => {
  if (!ownerAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized owner access." });
  }
  const data = await readData();
  const index = data.history.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "History entry not found." });
  }
  data.history.splice(index, 1);
  await writeData(data);
  res.json({ message: "History entry deleted." });
});

app.delete("/api/owner/bookings/:id", async (req, res) => {
  if (!ownerAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized owner access." });
  }
  const data = await readData();
  const before = data.bookings.length;
  data.bookings = data.bookings.filter((item) => item.id !== req.params.id);
  if (data.bookings.length === before) {
    return res.status(404).json({ error: "Booking not found." });
  }
  await writeData(data);
  res.json({ message: "Booking deleted." });
});

app.get("/api/test-email", async (_req, res) => {
  const testBooking = {
    customerName: "Test Customer",
    serviceName: "Test Service",
    barberName: "Test Barber",
    startTime: new Date().toISOString(),
    confirmationCode: "TEST123",
  };
  try {
    await sendNotifications(testBooking, "Test booking notification");
    res.json({ message: `Test email triggered to ${OWNER_EMAIL}.` });
  } catch (error) {
    res.status(500).json({ error: error.message || "Email test failed." });
  }
});

ensureDataFile().then(() => {
  setInterval(() => {
    processReminders().catch((error) => console.error("Reminder check failed:", error.message));
  }, 60 * 1000);

  app.listen(PORT, () => {
    console.log(`Himal Glow Studio app running at http://localhost:${PORT}`);
    const routeStack = app._router?.stack;
    if (routeStack) {
      const routeList = routeStack
        .filter((layer) => layer.route)
        .map((layer) => {
          const methods = Object.keys(layer.route.methods).join(",");
          return `${methods.toUpperCase()} ${layer.route.path}`;
        });
      console.log("Registered routes:", routeList.join(" | "));
    }
  });
});
