# Himal Glow Studio – Booking & Check-In App

This is a practical salon web app designed for both desktop and mobile browsers.

## Business profile included

- Salon: **Himal Glow Studio**
- Address: **Euless, Texas**
- Phone: **222-222-2222**
- Walk-in note: **Walk-ins are always welcome**
- Barbers (4 total): **Raj, Aman, Sujan, Dipesh**

## Customer experience

- Customers can only use:
  - Booking
  - Check-in
- Customers choose:
  - Service
  - Barber
  - Date/time
- The app prevents time conflicts for each barber based on service duration.

## Salon dashboard (owner only)

- PIN-protected owner view
- Upcoming bookings with customer names
- Customer phone numbers are not shown on dashboard/history
- Service price list on dashboard
- Today’s summary cards:
  - Check-ins
  - Revenue
  - Pending bookings
- Full check-in history
- Clear-all history button

## Services and market-style pricing

- Haircut — $35
- Beard Trim — $18
- Haircut + Beard — $48
- Kids Haircut — $28
- Head Shave — $30
- Hot Towel Shave — $32
- Line Up / Edge Up — $15

## Notifications for owner

When booking is created, checked in, rescheduled, cancelled, and for reminders, app attempts notifications to:

- Email: `shah.chandrashekher@gmail.com`
- Text: `214-606-7901`

If SMTP/Twilio are not configured, the app logs what would have been sent.

## Setup

```bash
cd ~/Desktop/cursor-learning
npm install
cp .env.example .env
npm start
```

Open:

`http://localhost:3000`

Owner PIN defaults to `1234` (change in `.env`).

## Practical market-ready improvements already included

- Mobile-friendly UI
- Fast check-in from booking list
- Role separation (customer vs owner dashboard)
- Conflict handling for limited staff (4 barbers)
- Daily revenue visibility
- `Any available barber` booking option
- Confirmation code for customer self-service
- Customer reschedule/cancel with 2-hour policy window
- Automated reminder triggers (24 hours and 1 hour before)
- Owner dashboard analytics (projected revenue, top services, busiest hour)

## Suggested next upgrades (optional)

- No-show tracking
- Barber-specific calendar export
- Payment status (paid/unpaid/tip)
