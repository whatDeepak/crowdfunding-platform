# Sample Campaigns for Testing

Copy-paste these into the campaign creation form.
Expected trust scores are based on the **mock AI** (no AI service running).
With the real AI service, scores will differ based on actual ML analysis.

**Mock scoring formula:**
- Description < 30 words → text score 5 | 30–60 → 12 | 60–150 → 18 | 150+ → 22
- Amount ≤ 2 ETH → amount score 25 | ≤ 10 → 20 | ≤ 50 → 10 | > 50 → 3
- Semantic score fixed at 18, image score fixed at 12 (mock)
- Trust = text + semantic + amount + image → status: ≥ 70 active | 40–69 pending_verification | < 40 pending_review

---

## HIGH TRUST — Auto-approved (score ≥ 70, status: active)

---

### Campaign 1 — Medical (Expected: ~77, active)

| Field | Value |
|---|---|
| **Title** | Urgent Kidney Surgery for Riya Sharma, 8 |
| **Category** | Medical |
| **Target Amount** | 1.5 ETH |
| **Duration** | 30 days |

**Description (copy exactly):**
```
Riya Sharma is an 8-year-old girl from Nagpur who was recently diagnosed with chronic kidney disease requiring an immediate transplant. Her family — daily wage labourers — cannot afford the surgery which is estimated to cost ₹4.5 lakhs at a government-empanelled hospital.

Riya's condition has been deteriorating over the past three months. Without the transplant within the next 6–8 weeks, her kidneys will fail completely. Her treating nephrologist at Government Medical College Nagpur, Dr. Priya Kulkarni, has confirmed the urgency in writing.

All funds raised will go directly to the hospital's patient account and disbursed in two tranches — one before surgery for pre-operative tests and preparation, and one after surgery for post-operative care and medication. Any surplus will be refunded to donors proportionally.

We are a family that has never asked for help before. This is our last option.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | Pre-operative Tests & Preparation | 0.5 ETH | Blood tests, HLA typing, anaesthesia evaluation, hospital admission deposit |
| 2 | Surgery & ICU Stay | 0.7 ETH | Transplant procedure, 5-day ICU monitoring, surgeon and anaesthetist fees |
| 3 | Post-operative Medication & Discharge | 0.3 ETH | Immunosuppressant drugs for 3 months, follow-up consultations |

---

### Campaign 2 — Education (Expected: ~77, active)

| Field | Value |
|---|---|
| **Title** | Engineering College Fees for First-Generation Graduate |
| **Category** | Education |
| **Target Amount** | 0.8 ETH |
| **Duration** | 45 days |

**Description:**
```
My name is Arjun Meena and I am the first person in my family of farmers to be accepted into an engineering college. I have secured admission to the Computer Science programme at MNIT Jaipur — one of the top National Institutes of Technology in India — through the JEE Advanced examination.

My family cultivates 2 acres of land in Sawai Madhopur district, Rajasthan. The annual household income is approximately ₹1.1 lakh, which is insufficient to cover the semester fees, hostel, and study materials totalling around ₹2.4 lakhs per year.

I have already applied for a scholarship from the National Scholarship Portal and am awaiting results. This campaign covers the first-year gap until scholarship disbursement begins. I will share all fee receipts publicly on this platform after each milestone release.

My goal is to return to my community after graduation and contribute to agricultural technology. This education is not just for me — it is for my village.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | First Semester Fees & Hostel | 0.5 ETH | Tuition fee payment to MNIT, hostel booking deposit, mess advance |
| 2 | Study Materials & Laptop | 0.3 ETH | Required textbooks, scientific calculator, second-hand laptop for coursework |

---

### Campaign 3 — Disaster (Expected: ~77, active)

| Field | Value |
|---|---|
| **Title** | Flood Relief — Rebuilding 12 Homes in Silchar, Assam |
| **Category** | Disaster |
| **Target Amount** | 2.0 ETH |
| **Duration** | 21 days |

**Description:**
```
The July 2024 floods in the Barak Valley region of Assam destroyed 12 homes in Tarapur village, Silchar. Forty-three residents — including 11 children and 6 elderly people — have been living in a temporary relief camp for the past 19 days with no end date confirmed by local authorities.

The damage assessment conducted by the local panchayat and verified by the District Collector's office estimates reconstruction cost at approximately ₹6 lakhs per household for basic single-room concrete structures with a roof, one door, and two windows — the minimum standard for flood-resistant construction in this area.

This campaign will fund the reconstruction of the worst-affected 3 homes as a first phase. Priority has been given to households with young children and elderly members with no other family to stay with. All procurement will be handled by a registered local NGO (Barak Valley Relief Trust, Reg. No. AS-2019-0081) with full accounts published monthly.

Phase 2 for the remaining 9 homes will be launched separately once phase 1 is complete and accounts are published.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | Materials — Foundation & Walls | 1.2 ETH | Cement, bricks, steel rods, sand for 3 homes. Procurement receipts published to IPFS. |
| 2 | Roof, Doors, Windows & Labour | 0.8 ETH | Corrugated iron sheets, timber, doors, windows, local mason wages for 3 weeks |

---

### Campaign 4 — Community (Expected: ~77, active)

| Field | Value |
|---|---|
| **Title** | Solar Panels for Government Primary School in Barmer |
| **Category** | Community |
| **Target Amount** | 0.5 ETH |
| **Duration** | 60 days |

**Description:**
```
Government Primary School No. 7 in Ramsar block, Barmer district, Rajasthan has 214 students and no electricity connection. The school runs classes from 7 AM to 1 PM during summer to avoid afternoon heat, but the lack of fans and lighting in winter months significantly reduces learning time.

The Rajasthan Electricity Board has estimated a 14-month wait for a grid connection. A 2 kW solar panel system with battery backup — sufficient for 6 ceiling fans, 12 LED lights, and one computer — can be installed in 10 days at a cost of approximately ₹1.5 lakhs.

This campaign is backed by the school's headmistress, Mrs. Sunita Rathore, and has been approved by the Block Education Officer. The installation will be done by a government-empanelled vendor (Raj Solar, MSME Reg. RA-41193) with a 5-year maintenance warranty included.

We will publish the installation completion certificate and energy production logs monthly after completion.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | Solar Panels & Inverter Purchase | 0.35 ETH | 2 kW panel array, 3 kVA inverter, 150Ah battery bank — vendor invoice published |
| 2 | Installation, Wiring & Commissioning | 0.15 ETH | Installation labour, electrical wiring, earthing, final commissioning and handover |

---

## MEDIUM TRUST — Needs verifier endorsement (score 40–69, status: pending_verification)

---

### Campaign 5 — Medical (Expected: ~68, pending_verification)

| Field | Value |
|---|---|
| **Title** | Help Cover My Father's Cancer Treatment |
| **Category** | Medical |
| **Target Amount** | 8 ETH |
| **Duration** | 30 days |

**Description (keep to ~65 words):**
```
My father has been diagnosed with stage 3 lung cancer and requires six cycles of chemotherapy. The treatment is available at a private hospital in our city. We have already sold our two-wheeler and borrowed from relatives but still need funds for the remaining four cycles. Each cycle costs approximately ₹60,000. I will share all medical bills and receipts after each withdrawal. Please help us.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | Chemotherapy Cycles 3 & 4 | 4 ETH | Two chemotherapy sessions, medications, blood tests |
| 2 | Chemotherapy Cycles 5 & 6 | 4 ETH | Final two sessions, PET scan, follow-up consultation |

---

### Campaign 6 — Disaster (Expected: ~63, pending_verification)

| Field | Value |
|---|---|
| **Title** | Cyclone Shelter Repair — Coastal Village Tamil Nadu |
| **Category** | Disaster |
| **Target Amount** | 5 ETH |
| **Duration** | 25 days |

**Description (~55 words):**
```
Cyclone Michaung damaged the community shelter in our village that 300 people use during storm season. The roof collapsed partially and the drainage is blocked. Repair work needs to happen before the next monsoon season in June. Local contractor has given a written estimate. Village council has approved the project. Funds will go directly to contractor after each stage is completed.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | Roof Repair & Waterproofing | 3 ETH | Replace damaged roof sections, apply waterproofing membrane |
| 2 | Drainage & Structural Fixes | 2 ETH | Clear and rebuild drainage channels, repair load-bearing wall cracks |

---

### Campaign 7 — Community (Expected: ~67, pending_verification)

| Field | Value |
|---|---|
| **Title** | Clean Drinking Water Pump for Tribal Hamlet |
| **Category** | Community |
| **Target Amount** | 0.9 ETH |
| **Duration** | 30 days |

**Description (~70 words):**
```
Our hamlet of 80 families in Dahanu taluka, Palghar district has no piped water. Women walk 3 km daily to fetch water from a seasonal stream that dries in April. A borewell with a submersible pump and a 5,000-litre overhead tank will serve the entire hamlet year-round. The local gram panchayat has given written permission for the borewell site. We have three contractor quotes and will use the lowest.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | Borewell Drilling | 0.5 ETH | 150-ft borewell drilling, casing pipe, electrical connection to motor |
| 2 | Overhead Tank & Distribution Pipes | 0.4 ETH | 5,000-litre PVC tank, stand construction, pipes to 8 community taps |

---

## LOW TRUST — Admin review required (score < 40, status: pending_review)

---

### Campaign 8 — Medical (Expected: ~38, pending_review)

| Field | Value |
|---|---|
| **Title** | Medical Emergency Please Help |
| **Category** | Medical |
| **Target Amount** | 80 ETH |
| **Duration** | 7 days |

**Description (< 30 words — intentionally vague to trigger low score):**
```
My mother is very sick and needs urgent surgery. The hospital requires payment immediately. Please help us. God bless you.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | Surgery Costs | 80 ETH | Medical treatment |

---

### Campaign 9 — Education (Expected: ~38, pending_review)

| Field | Value |
|---|---|
| **Title** | Need Fees Urgently Act Now |
| **Category** | Education |
| **Target Amount** | 60 ETH |
| **Duration** | 3 days |

**Description (< 30 words — fraud keyword "act now" + vague):**
```
I need money urgently for my college fees. Act now before the deadline. I guarantee I will use it for education only. Please help.
```

**Milestones:**
| # | Title | Amount | Description |
|---|---|---|---|
| 1 | College Fees | 60 ETH | Various education expenses |

---

## Quick Reference

| # | Title (short) | Category | ETH | Expected Score | Status |
|---|---|---|---|---|---|
| 1 | Riya's Kidney Surgery | Medical | 1.5 | ~77 | ✅ active |
| 2 | Arjun's Engineering Fees | Education | 0.8 | ~77 | ✅ active |
| 3 | Silchar Flood Rebuild | Disaster | 2.0 | ~77 | ✅ active |
| 4 | Barmer School Solar | Community | 0.5 | ~77 | ✅ active |
| 5 | Father's Cancer Chemo | Medical | 8.0 | ~68 | 🟡 pending_verification |
| 6 | Cyclone Shelter Repair | Disaster | 5.0 | ~63 | 🟡 pending_verification |
| 7 | Tribal Hamlet Water Pump | Community | 0.9 | ~67 | 🟡 pending_verification |
| 8 | Medical Emergency (vague) | Medical | 80 | ~38 | 🔴 pending_review |
| 9 | Need Fees Urgently | Education | 60 | ~38 | 🔴 pending_review |

**Demo script suggestion:**
1. Create Campaign 1 → show auto-approval flow
2. Create Campaign 5 → show verifier endorsement flow  
3. Create Campaign 8 → show admin manual review flow
4. Donate to Campaign 1 → show donation + MetaMask tx
5. Submit withdrawal on Campaign 1 → show admin approval → ETH release
