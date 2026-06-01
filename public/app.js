const state = {
  config: null,
  ownerPin: "",
};

const tabs = document.querySelectorAll(".tab");
const customerPanel = document.getElementById("customer");
const ownerPanel = document.getElementById("owner");
const bookingForm = document.getElementById("bookingForm");
const bookingMsg = document.getElementById("bookingMsg");
const checkinMsg = document.getElementById("checkinMsg");
const customerBookings = document.getElementById("customerBookings");
const currentlyServingList = document.getElementById("currentlyServingList");
const serviceSelect = document.getElementById("serviceSelect");
const barberSelect = document.getElementById("barberSelect");
const customerPhoneInput = document.getElementById("customerPhone");
const checkinPhoneInput = document.getElementById("checkinPhone");
const lookupBookingsBtn = document.getElementById("lookupBookingsBtn");
const bookingDateInput = document.getElementById("bookingDate");
const bookingTimeSelect = document.getElementById("bookingTime");
const walkinNote = document.getElementById("walkinNote");
const manageForm = document.getElementById("manageForm");
const manageCodeInput = document.getElementById("manageCode");
const managePhoneInput = document.getElementById("managePhone");
const rescheduleDateInput = document.getElementById("rescheduleDate");
const rescheduleTimeSelect = document.getElementById("rescheduleTime");
const rescheduleBarberSelect = document.getElementById("rescheduleBarber");
const ownerServingList = document.getElementById("ownerServingList");
const ownerAccessCard = document.getElementById("ownerAccessCard");
const findBookingBtn = document.getElementById("findBookingBtn");
const rescheduleBtn = document.getElementById("rescheduleBtn");
const cancelBookingBtn = document.getElementById("cancelBookingBtn");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const manageMsg = document.getElementById("manageMsg");
const ownerPinInput = document.getElementById("ownerPin");
const unlockOwnerBtn = document.getElementById("unlockOwnerBtn");
const ownerMsg = document.getElementById("ownerMsg");
const ownerSection = document.getElementById("ownerSection");
const stats = document.getElementById("stats");
const upcomingList = document.getElementById("upcomingList");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const priceList = document.getElementById("priceList");
const analyticsList = document.getElementById("analyticsList");

let selectedManagedBooking = null;

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

function buildLocalIso(date, time) {
  if (time === "walk-in") {
    return new Date().toISOString();
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  return localDate.toISOString();
}

function setTab(tab) {
  if (tab !== "owner") {
    lockOwnerSession();
  }
  tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  customerPanel.classList.toggle("hidden", tab !== "customer");
  ownerPanel.classList.toggle("hidden", tab !== "owner");
}

tabs.forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => setTab(tabBtn.dataset.tab));
});

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function lockOwnerSession() {
  state.ownerPin = "";
  ownerPinInput.value = "";
  ownerMsg.textContent = "";
  ownerSection.classList.add("hidden");
  if (ownerAccessCard) ownerAccessCard.classList.remove("hidden");
}

function populateTimeSlots(targetSelect, includeWalkIn = false) {
  targetSelect.innerHTML = "";
  if (includeWalkIn) {
    const walkOption = document.createElement("option");
    walkOption.value = "walk-in";
    walkOption.textContent = "Walk-in (arrive now)";
    targetSelect.append(walkOption);
  }
  for (let hour = 8; hour <= 21; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 21 && minute > 0) continue;
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");
      const value = `${hh}:${mm}`;
      const labelDate = new Date(`1970-01-01T${value}:00`);
      const label = labelDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${label} CST`;
      targetSelect.append(option);
    }
  }
}

function formatPhoneInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function applyQueryParams() {
  const search = new URLSearchParams(window.location.search);
  const code = search.get("code");
  const phone = search.get("phone");
  if (code || phone) {
    setTab("customer");
    if (code) manageCodeInput.value = code.trim().toUpperCase();
    if (phone) managePhoneInput.value = formatPhoneInput(phone);
    manageMsg.textContent = "Booking details are preloaded. Click Find booking to manage your appointment.";
  }
}

function updateWalkinHint() {
  if (!walkinNote) return;
  if (bookingTimeSelect.value === "walk-in") {
    walkinNote.textContent = "Walk-in means your appointment is recorded as arriving now; the salon will treat it as immediate arrival.";
  } else {
    walkinNote.textContent = 'Select a time or choose "Walk-in" for immediate arrival.';
  }
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

customerPhoneInput.addEventListener("input", () => {
  customerPhoneInput.value = formatPhoneInput(customerPhoneInput.value);
});
bookingTimeSelect.addEventListener("change", updateWalkinHint);
checkinPhoneInput.addEventListener("input", () => {
  checkinPhoneInput.value = formatPhoneInput(checkinPhoneInput.value);
});
lookupBookingsBtn.addEventListener("click", async () => {
  const phone = normalizePhone(checkinPhoneInput.value);
  if (phone.length !== 10) {
    checkinMsg.textContent = "Enter a valid 10-digit phone number.";
    customerBookings.innerHTML = '<div class="muted">Enter your phone number and click "Find my bookings" to check in.</div>';
    return;
  }
  checkinMsg.textContent = "";
  await loadCustomerBookings(phone);
});
managePhoneInput.addEventListener("input", () => {
  managePhoneInput.value = formatPhoneInput(managePhoneInput.value);
});

function renderConfig() {
  const anyOption = document.createElement("option");
  anyOption.value = "any";
  anyOption.textContent = "Any available barber";
  barberSelect.append(anyOption);
  rescheduleBarberSelect.append(anyOption.cloneNode(true));

  state.config.services.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = `${service.name} - $${service.price} (${service.durationMin} min)`;
    serviceSelect.append(option);
  });

  state.config.barbers.forEach((barber) => {
    const option = document.createElement("option");
    option.value = barber.id;
    option.textContent = barber.name;
    barberSelect.append(option);
    rescheduleBarberSelect.append(option.cloneNode(true));
  });

  priceList.innerHTML = "";
  state.config.services.forEach((service) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `<div class="item-title">${service.name}</div>
      <div class="muted">$${service.price} • ${service.durationMin} min</div>`;
    priceList.append(row);
  });
}

async function loadCustomerBookings(phone) {
  if (!customerBookings || !currentlyServingList) {
    return;
  }

  if (phone) {
    const bookings = await request(`/api/bookings/upcoming?phone=${encodeURIComponent(phone)}`);
    customerBookings.innerHTML = "";
    bookings.forEach((booking) => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="item-title">${booking.customerName} • ${booking.serviceName}</div>
        <div class="muted">${formatDate(booking.startTime)} with ${booking.barberName}</div>
        <div class="actions"><button data-id="${booking.id}">Check in</button></div>
      `;
      row.querySelector("button").addEventListener("click", async () => {
        const phone = checkinPhoneInput.value.trim();
        checkinMsg.textContent = "";
        if (!phone) {
          checkinMsg.textContent = "Enter your phone number to check in.";
          return;
        }
        try {
          await request(`/api/bookings/${booking.id}/checkin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerPhone: phone }),
          });
          checkinMsg.textContent = "Checked in successfully.";
          await loadCustomerBookings(normalizePhone(phone));
          if (ownerSection.classList.contains("hidden") === false) await loadOwnerDashboard();
        } catch (error) {
          checkinMsg.textContent = error.message;
        }
      });
      customerBookings.append(row);
    });

    if (!bookings.length) {
      customerBookings.innerHTML = '<div class="muted">No upcoming bookings right now.</div>';
    }
  } else {
    customerBookings.innerHTML = '<div class="muted">Enter your phone number and click "Find my bookings" to check in.</div>';
  }

  const serving = await request("/api/bookings/currently-serving");
  currentlyServingList.innerHTML = "";
  serving.forEach((booking) => {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="item-title">${booking.customerName} • ${booking.serviceName}</div>
      <div class="muted">Now serving with ${booking.barberName}</div>
    `;
    currentlyServingList.append(row);
  });
  if (!serving.length) {
    currentlyServingList.innerHTML = '<div class="muted">No one is currently being served.</div>';
  }
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  bookingMsg.textContent = "";
  const formData = new FormData(bookingForm);
  const bookingDate = formData.get("bookingDate");
  const bookingTime = formData.get("bookingTime");
  if (!bookingDate || !bookingTime) {
    bookingMsg.textContent = "All fields are mandatory.";
    return;
  }

  const payload = {
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail"),
    serviceId: formData.get("serviceId"),
    barberId: formData.get("barberId"),
    startTime: buildLocalIso(bookingDate, bookingTime),
  };

  try {
    const created = await request("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    bookingMsg.textContent = `Booking confirmed (CST). Your confirmation code is ${created.confirmationCode}.`;
    manageCodeInput.value = created.confirmationCode;
    managePhoneInput.value = payload.customerPhone;
    bookingForm.reset();
    bookingDateInput.value = new Date().toISOString().slice(0, 10);
    await loadCustomerBookings();
    if (ownerSection.classList.contains("hidden") === false) await loadOwnerDashboard();
  } catch (error) {
    bookingMsg.textContent = error.message;
  }
});

async function loadOwnerDashboard() {
  if (!state.ownerPin) return;
  try {
    const data = await request("/api/owner/dashboard", {
      headers: { "x-owner-pin": state.ownerPin },
    });
    stats.innerHTML = `
      <div class="stat"><h4>Today's check-ins</h4><strong>${data.todayStats.checkIns}</strong></div>
      <div class="stat"><h4>Today's revenue</h4><strong>$${data.todayStats.revenue}</strong></div>
      <div class="stat"><h4>Pending bookings</h4><strong>${data.todayStats.pendingBookings}</strong></div>
    `;
    analyticsList.innerHTML = `
      <div class="item"><div class="item-title">Projected upcoming revenue</div><div class="muted">$${data.analytics.projectedRevenue}</div></div>
      <div class="item"><div class="item-title">Top services</div><div class="muted">${(data.analytics.topServices || [])
        .map((item) => `${item.name} (${item.count})`)
        .join(", ") || "No history yet"}</div></div>
      <div class="item"><div class="item-title">Busiest hour</div><div class="muted">${
        data.analytics.busiestHour
          ? `${data.analytics.busiestHour.hour} (${data.analytics.busiestHour.count} bookings)`
          : "Not enough data"
      }</div></div>
    `;

    upcomingList.innerHTML = "";
    data.upcoming.forEach((booking) => {
      const row = document.createElement("div");
      row.className = "item";
      const startBtn =
        booking.status === "checked_in"
          ? `<button type="button" data-start-id="${booking.id}">Start service</button>`
          : "";
      const cancelBtn = `<button type="button" class="danger" data-cancel-id="${booking.id}">Cancel</button>`;
      row.innerHTML = `
        <div class="item-title">${booking.customerName} • ${booking.serviceName}</div>
        <div class="muted">${formatDate(booking.startTime)} with ${booking.barberName}</div>
        <div class="muted">Phone: ${booking.customerPhone} • Status: ${booking.status}</div>
        <div class="actions">${startBtn}${cancelBtn}</div>
      `;
      const startButton = row.querySelector("[data-start-id]");
      if (startButton) {
        startButton.addEventListener("click", async () => {
          try {
            await request(`/api/bookings/${booking.id}/start-service`, {
              method: "POST",
              headers: { "x-owner-pin": state.ownerPin },
            });
            await loadOwnerDashboard();
            await loadCustomerBookings();
          } catch (error) {
            ownerMsg.textContent = error.message;
          }
        });
      }
      const cancelButton = row.querySelector("[data-cancel-id]");
      cancelButton.addEventListener("click", async () => {
        if (!window.confirm("Cancel this upcoming booking?")) return;
        try {
          await request(`/api/owner/bookings/${booking.id}`, {
            method: "DELETE",
            headers: { "x-owner-pin": state.ownerPin },
          });
          await loadOwnerDashboard();
        } catch (error) {
          ownerMsg.textContent = error.message;
        }
      });
      upcomingList.append(row);
    });
    if (!data.upcoming.length) upcomingList.innerHTML = '<div class="muted">No upcoming bookings.</div>';

    ownerServingList.innerHTML = "";
    if (data.currentlyServing?.length) {
      data.currentlyServing.forEach((booking) => {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <div class="item-title">Currently Serving: ${booking.customerName} • ${booking.serviceName}</div>
          <div class="muted">${booking.barberName} • Started ${formatDate(
            booking.serviceStartedAt || booking.startTime,
          )}</div>
          <div class="actions">
            <button type="button" data-served-id="${booking.id}">Served</button>
          </div>
        `;
        row.querySelector("button").addEventListener("click", async () => {
          try {
            await request(`/api/bookings/${booking.id}/mark-served`, {
              method: "POST",
              headers: { "x-owner-pin": state.ownerPin },
            });
            await loadOwnerDashboard();
            await loadCustomerBookings(normalizePhone(checkinPhoneInput.value));
          } catch (error) {
            ownerMsg.textContent = error.message;
          }
        });
        ownerServingList.append(row);
      });
    } else {
      ownerServingList.innerHTML = '<div class="muted">No one is currently being served.</div>';
    }

    const history = await request("/api/owner/history", {
      headers: { "x-owner-pin": state.ownerPin },
    });
    historyList.innerHTML = "";
    history.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="item-title">${entry.customerName} • ${entry.serviceName}</div>
        <div class="muted">Checked in ${formatDate(entry.checkedInAt)} with ${entry.barberName} • $${entry.price}</div>
        <div class="actions"><button type="button" data-delete-history-id="${entry.id}">Delete</button></div>
      `;
      const deleteBtn = row.querySelector("[data-delete-history-id]");
      deleteBtn.addEventListener("click", async () => {
        if (!window.confirm("Delete this served customer record?")) return;
        try {
          await request(`/api/owner/history/${entry.id}`, {
            method: "DELETE",
            headers: { "x-owner-pin": state.ownerPin },
          });
          await loadOwnerDashboard();
        } catch (error) {
          ownerMsg.textContent = error.message;
        }
      });
      historyList.append(row);
    });
    if (!history.length) historyList.innerHTML = '<div class="muted">History is empty.</div>';
  } catch (error) {
    ownerMsg.textContent = error.message;
  }
}

async function unlockOwnerDashboard() {
  state.ownerPin = ownerPinInput.value.trim();
  ownerMsg.textContent = "";
  try {
    await loadOwnerDashboard();
    ownerSection.classList.remove("hidden");
    if (ownerAccessCard) ownerAccessCard.classList.add("hidden");
    ownerMsg.textContent = "Owner dashboard unlocked.";
  } catch (error) {
    ownerSection.classList.add("hidden");
    ownerMsg.textContent = error.message;
  }
}

unlockOwnerBtn.addEventListener("click", unlockOwnerDashboard);
ownerPinInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await unlockOwnerDashboard();
  }
});

findBookingBtn.addEventListener("click", async () => {
  manageMsg.textContent = "";
  selectedManagedBooking = null;
  if (!manageCodeInput.value.trim() || !managePhoneInput.value.trim()) {
    manageMsg.textContent = "Confirmation code and phone are required.";
    return;
  }
  try {
    const booking = await request("/api/bookings/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationCode: manageCodeInput.value.trim().toUpperCase(),
        customerPhone: managePhoneInput.value.trim(),
      }),
    });
    selectedManagedBooking = booking;
    rescheduleDateInput.value = booking.startTime.slice(0, 10);
    rescheduleTimeSelect.value = new Date(booking.startTime).toISOString().slice(11, 16);
    rescheduleBarberSelect.value = booking.barberId;
    manageMsg.textContent = `Booking found for ${booking.customerName}.`;
  } catch (error) {
    manageMsg.textContent = error.message;
  }
});

rescheduleBtn.addEventListener("click", async () => {
  manageMsg.textContent = "";
  if (!selectedManagedBooking) {
    manageMsg.textContent = "Find your booking first.";
    return;
  }
  if (!rescheduleDateInput.value || !rescheduleTimeSelect.value || !rescheduleBarberSelect.value) {
    manageMsg.textContent = "All reschedule fields are required.";
    return;
  }
  try {
    const updated = await request(`/api/bookings/${selectedManagedBooking.id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationCode: manageCodeInput.value.trim().toUpperCase(),
        customerPhone: managePhoneInput.value.trim(),
        newStartTime: buildLocalIso(rescheduleDateInput.value, rescheduleTimeSelect.value),
        barberId: rescheduleBarberSelect.value,
      }),
    });
    selectedManagedBooking = updated;
    manageMsg.textContent = "Booking rescheduled successfully.";
    await loadCustomerBookings();
    if (ownerSection.classList.contains("hidden") === false) await loadOwnerDashboard();
  } catch (error) {
    manageMsg.textContent = error.message;
  }
});

cancelBookingBtn.addEventListener("click", async () => {
  manageMsg.textContent = "";
  if (!selectedManagedBooking) {
    manageMsg.textContent = "Find your booking first.";
    return;
  }
  try {
    await request(`/api/bookings/${selectedManagedBooking.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationCode: manageCodeInput.value.trim().toUpperCase(),
        customerPhone: managePhoneInput.value.trim(),
      }),
    });
    selectedManagedBooking = null;
    manageForm.reset();
    rescheduleDateInput.value = new Date().toISOString().slice(0, 10);
    manageMsg.textContent = "Booking cancelled successfully.";
    await loadCustomerBookings();
    if (ownerSection.classList.contains("hidden") === false) await loadOwnerDashboard();
  } catch (error) {
    manageMsg.textContent = error.message;
  }
});

copyCodeBtn.addEventListener("click", async () => {
  const code = manageCodeInput.value.trim();
  if (!code) {
    manageMsg.textContent = "Enter or find a confirmation code first.";
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    manageMsg.textContent = "Confirmation code copied.";
  } catch (_error) {
    manageMsg.textContent = `Copy failed. Your code is: ${code}`;
  }
});

clearHistoryBtn.addEventListener("click", async () => {
  if (!state.ownerPin) return;
  if (!window.confirm("Clear all history records?")) return;
  try {
    await request("/api/owner/history", {
      method: "DELETE",
      headers: { "x-owner-pin": state.ownerPin },
    });
    await loadOwnerDashboard();
  } catch (error) {
    ownerMsg.textContent = error.message;
  }
});

async function init() {
  state.config = await request("/api/config");
  bookingDateInput.value = new Date().toISOString().slice(0, 10);
  rescheduleDateInput.value = new Date().toISOString().slice(0, 10);
  populateTimeSlots(bookingTimeSelect, true);
  populateTimeSlots(rescheduleTimeSelect);
  updateWalkinHint();
  renderConfig();
  await loadCustomerBookings();
  applyQueryParams();
}

document.addEventListener("DOMContentLoaded", init);
