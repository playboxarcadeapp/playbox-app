# Playbox Plus: store setup

The app is already built for these exact IDs. Type them exactly as shown, or the app won't find the subscriptions.

| | Product ID (both stores) | Google base plan ID | Price | Free trial |
|---|---|---|---|---|
| Yearly | `playbox_plus_yearly` | `yearly` | $19.99 / year | 7 days |
| Monthly | `playbox_plus_monthly` | `monthly` | $2.99 / month | 7 days |

---

## Apple (App Store Connect)

### 1. Get paid (one time, about a day for Apple to approve)
1. **Business** (or "Agreements, Tax, and Banking") → accept the **Paid Apps Agreement**.
2. Add your **bank account** and fill in the **tax form** (W-9 in the US). The agreement must show **Active** before subscriptions work.
3. Apply for the **App Store Small Business Program** (developer.apple.com/app-store/small-business-program). Apple then takes 15% instead of 30%.

### 2. Create the subscriptions
1. **Apps → Playbox → Monetization → Subscriptions**.
2. **Create a subscription group.** Reference name: `Playbox Plus`. Under **App Store localization** set the display name to `Playbox Plus`.
3. In the group, **create a subscription**:
   - Reference name: `Playbox Plus Yearly` · Product ID: `playbox_plus_yearly`
   - Duration: **1 year** · Price: **$19.99** (let Apple set the other countries)
   - Localization: Display name `Playbox Plus (Yearly)`, Description `All levels, unlimited play, Swag Shop and daily gifts`
   - **Family Sharing: turn on.** (Once on, it can't be turned off. That's fine, it's a selling point.)
   - **Review information:** upload a screenshot of the Playbox Plus screen from your iPhone, and paste the review note below.
   - **Introductory offer:** Free · 1 week · all countries.
4. Create the second one the same way: `Playbox Plus Monthly` · `playbox_plus_monthly` · **1 month** · **$2.99** · Family Sharing on · 1-week free intro offer.
5. In the group, drag **Yearly above Monthly**. The top one counts as the "higher" plan for upgrades.

### 3. Test before submitting
- Install the new build from **TestFlight**. TestFlight purchases are free (sandbox), and renewals are sped up: monthly renews every 5 minutes and yearly every hour.
- Check that buying turns Plus on, **Restore purchases** works after deleting and reinstalling, and canceling (Settings → your name → Subscriptions) turns it off after the period ends.

### 4. Submit
- On the new app version's page, under **In-App Purchases and Subscriptions**, add **both subscriptions**. Your first subscriptions have to be reviewed together with an app version.
- Paste the updated description from `listing.md`. It includes the subscription details and the Terms of Use link that Apple requires.
- Upload the iPhone and iPad screenshots.
- **App Privacy:** stays **Data Not Collected**.
- **Review note:** "No login needed. Free play is limited to 2 new levels per game per day; Playbox Plus unlocks everything. The subscription screen is behind a parental gate: answer the times-table question (e.g. 'What is seven times eight?' = 56)."

---

## Google Play (Play Console)

### 1. Get paid
- **Setup → Payments profile:** create your merchant (payments) profile with bank and tax details. Google takes 15% on subscriptions.

### 2. Upload the new build first
- Google only lets you create subscriptions once a build that can take payments has been uploaded. Upload the new Android bundle from Codemagic to the **Internal testing** track.

### 3. Create the subscriptions
1. **Monetize with Play → Products → Subscriptions → Create subscription.**
2. Product ID `playbox_plus_monthly`, name `Playbox Plus Monthly`.
3. **Add base plan:** ID `monthly`, auto-renewing, billing period **1 month**, price **$2.99** (Google fills in other countries). **Activate** it.
4. **Add offer** on that base plan: offer ID `free-trial`, eligibility **New customer acquisition**, phase **Free trial, 7 days**. **Activate** it.
5. Repeat for `playbox_plus_yearly` with base plan `yearly`, **1 year**, **$19.99**, plus a `free-trial` offer.

### 4. Test
- **Setup → License testing:** add your Gmail address. Purchases from that account are free test purchases.
- Install from the Internal testing link and try buying, restoring and canceling.

### 5. Store listing and policy forms
- Paste the updated description from `listing.md`.
- **Data safety:** still no data collected or shared.
- **Ads:** No. The listing will show "Contains in-app purchases".
