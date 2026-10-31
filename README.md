# AM Associates – Clinic Manager

A colourful, simple clinic dashboard (mini-CRM) for **Dr. Meraj Ahamed, MBBS – AM Associates**.
Built for a one-doctor clinic with no staff: every visit follows the same 6 steps, in order.

| Step | Section | What you do there |
|---|---|---|
| 1 | 👤 **Patient Details** | Register patient (auto ID `AM-0001`), age, gender, mobile, blood group, allergies, medical history |
| 2 | 🩺 **Diagnostics** | Complaints, vitals (BP, pulse, temp, SpO₂, weight, RBS…), examination, provisional diagnosis, tick the tests/X-rays advised |
| 3 | 🧪 **Results** | Enter lab / X-ray / ECG values with normal range; High/Low values are highlighted; printable report |
| 4 | 💊 **Prescriptions** | Medicines with frequency (1-0-1), timing and days, advice, next-visit date; prints on clinic letterhead |
| 5 | 📅 **Follow-ups** | Auto-created from the prescription's next-visit date; overdue/today lists; one-tap **WhatsApp reminder** & call |
| 6 | 🧾 **Consultation Bills** | Consultation, X-Ray, Diagnostic, Procedure, Medicines bills; quick-add price list, discount, Paid/Pending, printable receipt with amount in words |

Plus:
- **Dashboard** – today's patients, today's & monthly collection, pending dues, follow-ups due, 7-day collection chart, revenue by bill type.
- **Patient page** – full chronological timeline of every visit, and "New visit" buttons that walk you through steps 2 → 6. After each save a "Next step →" button appears.
- **Settings** – clinic name, address, phone, registration no., timings (used on printed letterheads) and an editable **service price list** (consultation fee, X-ray, ECG, lab tests…).
- **Backup / restore** (JSON) and **bills export to CSV** (opens in Excel).
- **🔒 PIN lock** – Settings → PIN lock: set a 4–6 digit PIN. The app asks for it every time it opens, auto-locks when idle (1–30 min, default 5), and the 🔒 button at the top locks it instantly. After 5 wrong tries it makes you wait (30 s, growing each time).
- Works on phone, tablet and computer.

## How to use

No installation, no server. Just open `index.html` in Chrome/Edge — or host it free on **GitHub Pages**:

1. Repository → **Settings → Pages**
2. Source: *Deploy from a branch* → choose the branch and `/ (root)` → Save
3. Open the link GitHub gives you (e.g. `https://<username>.github.io/meraj/`) and add it to the phone's home screen.

## ⚠️ Important about data

All patient data is stored **only in the browser of the device you use** (localStorage) — nothing is uploaded to any server, which keeps patient information private.
That also means:
- Use the **same device and browser** every day.
- Go to **Settings → Download backup** regularly (e.g. every week) and keep the file safe (Google Drive / email). Use **Restore** to move data to a new phone or computer.
- Clearing browser data / history will erase the records if you have no backup.
- The PIN lock is a **privacy screen** (stops someone who picks up the phone/computer from seeing records). It does not encrypt the stored data, so also keep the device itself protected with its own screen lock.
- A forgotten PIN **cannot be recovered**: "Forgot PIN?" erases the data on that device, and you then restore it from your backup file.

## Files

```
index.html      – app shell
css/style.css   – colourful theme + print layout (A4 letterhead)
js/app.js       – all logic (no external libraries)
```
